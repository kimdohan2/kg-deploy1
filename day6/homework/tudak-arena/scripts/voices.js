// ElevenLabs 목소리 고르기 도우미. .env의 ELEVENLABS_API_KEY를 쓴다.
//   npm run voices                     내 계정에서 쓸 수 있는 목소리 (기본 목소리 포함)
//   npm run voices -- ko               목소리 라이브러리에서 한국어 목소리 찾기 (API로 쓰려면 유료 요금제)
//   npm run voices -- test <voice_id> "헐 루 너 진짜!"   그 목소리로 한국어 문장을 만들어 바로 들어 보기
// 고른 voice_id는 config/characters.json의 각 봇 elevenlabsVoice에 넣는다.
import { readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

const root = fileURLToPath(new URL('..', import.meta.url));
const env = dotenv.parse(readFileSync(`${root}.env`, 'utf8'));
const key = env.ELEVENLABS_API_KEY || process.env.ELEVENLABS_API_KEY;
const characters = JSON.parse(readFileSync(`${root}config/characters.json`, 'utf8'));
const model = characters.tts?.elevenlabsModel || 'eleven_flash_v2_5';
if (!key) {
  console.error('✗ .env에 ELEVENLABS_API_KEY가 없어요.');
  process.exit(1);
}

async function api(path, init = {}) {
  const res = await fetch(`https://api.elevenlabs.io${path}`, {
    ...init, headers: { 'xi-api-key': key, 'Content-Type': 'application/json', ...init.headers },
  });
  if (!res.ok) throw new Error(`ElevenLabs ${res.status}: ${(await res.text()).slice(0, 200)}`);
  return res;
}

const show = v => {
  const l = v.labels || {};
  const tags = [v.gender ?? l.gender, v.age ?? l.age, v.accent ?? l.accent, v.descriptive ?? l.description, v.use_case ?? l.use_case]
    .filter(Boolean).join(' · ');
  console.log(`${v.name.padEnd(22)} ${v.voice_id}  ${tags}`);
  if (v.preview_url) console.log(`${' '.repeat(23)}미리 듣기: ${v.preview_url}`);
};

const [cmd, ...rest] = process.argv.slice(2);
try {
  if (cmd === 'test') {
    const [voiceId, text = '헐, 루 너 진짜! 나 방금 밀었지?'] = rest;
    if (!voiceId) throw new Error('사용법: npm run voices -- test <voice_id> "문장"');
    const t = Date.now();
    const res = await api(`/v1/text-to-speech/${voiceId}?output_format=mp3_44100_128`, {
      method: 'POST', body: JSON.stringify({ text, model_id: model }),
    });
    const file = `${tmpdir()}/tudak-voice-test.mp3`;
    writeFileSync(file, Buffer.from(await res.arrayBuffer()));
    console.log(`✓ ${model}로 만듦 (${Date.now() - t}ms). 재생 중...`);
    execFileSync('afplay', [file]);
  } else if (cmd === 'ko') {
    const { voices } = await (await api('/v1/shared-voices?language=ko&page_size=30&sort=usage_character_count_1y')).json();
    console.log('한국어 라이브러리 목소리 (API로 쓰려면 유료 요금제 필요)\n');
    voices.forEach(show);
  } else {
    const { voices } = await (await api('/v1/voices')).json();
    console.log(`내 계정에서 쓸 수 있는 목소리 ${voices.length}개 (모델 ${model}은 한국어도 말해요)\n`);
    voices.forEach(show);
  }
} catch (err) {
  console.error(`✗ ${err.message}`);
  process.exit(1);
}
