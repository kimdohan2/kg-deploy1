// Show me the burger 손님 인사말(burger/greetings.json)을 봇마다 자기 ElevenLabs 목소리로 미리 만든다.
//   public/burger/voice/<봇>-<solo|duo>-<번호>.mp3 + 화면이 읽는 목록 public/burger/data/greetings.json
//   이미 같은 대사·목소리·모델로 만든 건 건너뛴다. 대사를 바꾸면 그것만 다시 만든다.
//   npm run burger-greetings   (한 줄에 약 20크레딧)
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

const root = fileURLToPath(new URL('..', import.meta.url));
const env = dotenv.parse(readFileSync(`${root}.env`, 'utf8'));
const key = env.ELEVENLABS_API_KEY || process.env.ELEVENLABS_API_KEY;
const characters = JSON.parse(readFileSync(`${root}config/characters.json`, 'utf8'));
const lines = JSON.parse(readFileSync(`${root}burger/greetings.json`, 'utf8'));
const model = characters.tts?.elevenlabsModel || 'eleven_v4';
if (!key) { console.error('✗ .env에 ELEVENLABS_API_KEY가 없어요.'); process.exit(1); }

const dir = `${root}public/burger/voice`;
const listPath = `${root}public/burger/data/greetings.json`;
const metaPath = `${dir}/made.json`;   // 무엇으로 만들었는지 (다시 만들지 판단용)
mkdirSync(dir, { recursive: true });
const old = existsSync(metaPath) ? JSON.parse(readFileSync(metaPath, 'utf8')) : {};
const meta = {}, list = {};
let made = 0, kept = 0, credits = 0;

for (const bot of characters.bots) {
  const voice = bot.elevenlabsVoice;
  if (!voice) { console.log(`· ${bot.name}: ElevenLabs 목소리가 없어서 건너뜀`); continue; }
  list[bot.id] = {};
  for (const [kind, texts] of Object.entries(lines[bot.id] || {})) {
    list[bot.id][kind] = [];
    for (const [i, text] of texts.entries()) {
      const name = `${bot.id}-${kind}-${i + 1}.mp3`;
      const file = `${dir}/${name}`;
      meta[name] = { text, voice, model };
      list[bot.id][kind].push({ text, file: `voice/${name}` });
      if (existsSync(file) && JSON.stringify(old[name]) === JSON.stringify(meta[name])) { kept++; continue; }
      const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voice}?output_format=mp3_44100_128`, {
        method: 'POST',
        headers: { 'xi-api-key': key, 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, model_id: model }),
      });
      if (!res.ok) {
        console.error(`✗ ${bot.name} ${name} "${text}": ${res.status} ${(await res.text()).slice(0, 200)}`);
        process.exit(1);
      }
      writeFileSync(file, Buffer.from(await res.arrayBuffer()));
      credits += Number(res.headers.get('character-cost') || 0);
      made++;
      console.log(`✓ ${bot.name} ${name}: ${text}`);
    }
  }
}

writeFileSync(metaPath, JSON.stringify(meta, null, 2));
writeFileSync(listPath, JSON.stringify(list, null, 2) + '\n');
console.log(`\n인사말 ${made}개 새로 만듦, ${kept}개 그대로 (이번에 쓴 크레딧 ${credits}).`);
