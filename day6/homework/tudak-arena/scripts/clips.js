// 즉시 감탄사(config/clips.json)를 봇마다 자기 ElevenLabs 목소리로 미리 만들어 clips/에 둔다.
// 이미 같은 대사·목소리·모델로 만든 건 건너뛴다. 목소리나 대사를 바꾸면 그것만 다시 만든다.
//   npm run clips
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

const root = fileURLToPath(new URL('..', import.meta.url));
const env = dotenv.parse(readFileSync(`${root}.env`, 'utf8'));
const key = env.ELEVENLABS_API_KEY || process.env.ELEVENLABS_API_KEY;
const characters = JSON.parse(readFileSync(`${root}config/characters.json`, 'utf8'));
const lines = JSON.parse(readFileSync(`${root}config/clips.json`, 'utf8'));
const model = characters.tts?.elevenlabsModel || 'eleven_v4';
// 감정 표시는 v3·v4만 소리로 낸다. 다른 모델이면 대괄호를 빼고 만든다.
const keepTags = /_v[34]\b/.test(model);

if (!key) {
  console.error('✗ .env에 ELEVENLABS_API_KEY가 없어요.');
  process.exit(1);
}

const dir = `${root}clips`;
const manifestPath = `${dir}/manifest.json`;
const old = existsSync(manifestPath) ? JSON.parse(readFileSync(manifestPath, 'utf8')) : { files: {} };
const manifest = { model, bots: {}, files: {} };
let made = 0, kept = 0, credits = 0;

for (const bot of characters.bots) {
  const voice = bot.elevenlabsVoice;
  if (!voice) { console.log(`· ${bot.name}: ElevenLabs 목소리가 없어서 건너뜀`); continue; }
  mkdirSync(`${dir}/${bot.id}`, { recursive: true });
  manifest.bots[bot.id] = {};
  for (const [kind, texts] of Object.entries(lines[bot.id] || {})) {
    manifest.bots[bot.id][kind] = [];
    for (const [i, raw] of texts.entries()) {
      const text = keepTags ? raw : raw.replace(/\[[a-z ]+\]\s*/gi, '');
      const file = `${dir}/${bot.id}/${kind}-${i + 1}.mp3`;
      const meta = { text, voice, model };
      manifest.bots[bot.id][kind].push(file);
      manifest.files[file] = meta;
      if (existsSync(file) && JSON.stringify(old.files[file]) === JSON.stringify(meta)) { kept++; continue; }
      const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voice}?output_format=mp3_44100_128`, {
        method: 'POST',
        headers: { 'xi-api-key': key, 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, model_id: model }),
      });
      if (!res.ok) {
        console.error(`✗ ${bot.name} ${kind}-${i + 1} "${text}": ${res.status} ${(await res.text()).slice(0, 150)}`);
        process.exit(1);
      }
      writeFileSync(file, Buffer.from(await res.arrayBuffer()));
      credits += Number(res.headers.get('character-cost') || 0);
      made++;
      console.log(`✓ ${bot.name} ${kind}-${i + 1}: ${text}`);
    }
  }
}

writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
console.log(`\n감탄사 ${made}개 새로 만듦, ${kept}개 그대로 (이번에 쓴 크레딧 ${credits}). 게임 서버를 다시 켜면 적용돼요.`);
