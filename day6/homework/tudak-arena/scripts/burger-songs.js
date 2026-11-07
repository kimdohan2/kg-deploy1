// 투닥버거 주문 랩(burger/songs.json)을 ElevenLabs Music으로 만들어 public/burger/songs/<곡>.mp3로 저장한다.
// 한 번에 2곡(ElevenLabs 동시 요청 한도), 이미 있는 곡은 건너뜀. 다시 만들려면 그 mp3를 지우고 실행.
// 사용법: npm run burger-songs [곡 id...]   예) npm run burger-songs duo-4 duo-5
// 20초 곡 하나에 약 250크레딧. .env의 ELEVENLABS_API_KEY에 Music Generation 권한이 있어야 함.
import { readFileSync, writeFileSync, renameSync, mkdirSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url)).replace(/\/$/, '');
const only = process.argv.slice(2);
const env = Object.fromEntries(readFileSync(`${root}/.env`, 'utf8').split('\n').filter(l => l.includes('=') && !l.trim().startsWith('#'))
  .map(l => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim().replace(/^["']|["']$/g, '')]));
const H = { 'xi-api-key': env.ELEVENLABS_API_KEY, 'Content-Type': 'application/json' };
const { songs, genreStyles } = JSON.parse(readFileSync(`${root}/burger/songs.json`, 'utf8'));
const outDir = `${root}/public/burger/songs`;
mkdirSync(outDir, { recursive: true });

// 둘이 부르는 곡은 비트 하나로 끝까지 (목소리만 바뀜)
const DUO_BEAT = {
  '드릴 배틀': ['UK drill', '142 bpm', 'sliding 808', 'dark piano'],
  '트랩': genreStyles.lovey.beat,
  '하이퍼 + 붐뱁': ['hip hop', '110 bpm', 'punchy boom bap drums', 'glitchy synth stabs'],
  '붐뱁 + 하이퍼': ['hip hop', '110 bpm', 'punchy boom bap drums', 'glitchy synth stabs'],
};
const FEMALE = new Set(['coco']);

function spec(s) {
  const beat = s.customers.length > 1 ? DUO_BEAT[s.genre] : genreStyles[s.customers[0]].beat;
  const bothMale = s.customers.length > 1 && s.customers.every(c => !FEMALE.has(c));
  const chunks = s.parts.map(p => {
    if (!p.lines.length) {
      return { text: `[${p.part}]\n{instrumental intro}`, duration_ms: p.ms, positive_styles: [...beat, 'instrumental intro'], negative_styles: ['vocals'] };
    }
    let voice = [...genreStyles[p.who].voice];
    if (bothMale && p.who === s.customers[1]) voice[0] = 'different young male rapper with a deeper calmer voice';
    const hook = p.part === 'Hook';
    return {
      text: `[${p.part}]\n${p.lines.join('\n')}`,
      duration_ms: p.ms,
      positive_styles: [...beat, hook ? 'catchy rap hook' : 'rap verse', ...voice],
      negative_styles: [FEMALE.has(p.who) ? 'male vocals' : 'female vocals', 'mumbling'],
    };
  });
  return { model_id: 'music_v2_5', composition_plan: { chunks } };
}

const credits = async () => {
  try {
    const j = await (await fetch('https://api.elevenlabs.io/v1/user/subscription', { headers: H })).json();
    return j.character_count ?? null;
  } catch { return null; }
};

const queue = songs.filter(s => !only.length || only.includes(s.id));
const before = await credits();
console.log(`시작: ${queue.length}곡, 지금까지 쓴 크레딧 ${before}`);
let stop = false;
const done = [], failed = [];

async function make(s) {
  const file = `${outDir}/${s.id}.mp3`;
  if (existsSync(file)) { console.log(`- ${s.id} 이미 있음`); return; }
  const body = spec(s);
  for (let attempt = 1; attempt <= 4 && !stop; attempt++) {
    const t = Date.now();
    let r;
    try {
      r = await fetch('https://api.elevenlabs.io/v1/music?output_format=mp3_44100_192', { method: 'POST', headers: H, body: JSON.stringify(body), signal: AbortSignal.timeout(300000) });
    } catch (e) { console.log(`✗ ${s.id} 연결 오류 ${e.message} (다시 ${attempt})`); await new Promise(r => setTimeout(r, 5000)); continue; }
    if (r.ok) {
      writeFileSync(`${file}.part`, Buffer.from(await r.arrayBuffer()));
      renameSync(`${file}.part`, file);
      console.log(`✓ ${s.id} (${((Date.now() - t) / 1000).toFixed(0)}초 걸림)`);
      done.push(s.id);
      return;
    }
    const msg = (await r.text()).slice(0, 300);
    if (r.status === 429 && /concurrent/i.test(msg)) { await new Promise(r => setTimeout(r, 6000)); continue; }
    console.log(`✗ ${s.id} ${r.status} ${msg}`);
    if (r.status === 401 || r.status === 402 || /quota|limit|credits/i.test(msg)) stop = true;   // 크레딧·권한 문제면 나머지는 안 함
    failed.push(s.id);
    return;
  }
  if (!done.includes(s.id)) failed.push(s.id);
}

let next = 0;
await Promise.all([0, 1].map(async () => {
  while (!stop && next < queue.length) await make(queue[next++]);
}));
const after = await credits();
console.log(`끝: 만든 곡 ${done.length}, 실패 ${failed.length}${failed.length ? ` (${failed.join(', ')})` : ''}${stop ? ' — 크레딧·권한 문제로 멈춤' : ''}`);
console.log(`크레딧: ${before} → ${after} (이번에 ${after != null && before != null ? after - before : '?'})`);
