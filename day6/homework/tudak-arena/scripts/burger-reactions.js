// Show me the burger 주문 완료 한마디(server/burger-talk.js의 FALLBACK)를 봇마다 자기 ElevenLabs 목소리로 미리 만든다.
//   서버 없이 올린 정적 사이트(npm run burger-static)가 Hermes 대신 이 소리를 튼다.
//   public/burger/voice/react-<봇>-<perfect|close|wrong>.mp3 + 무엇으로 만들었는지 voice/react-made.json
//   이미 같은 대사·목소리·모델로 만든 건 건너뛴다. 대사를 바꾸면 그것만 다시 만든다.
//   npm run burger-reactions   (한 줄에 약 20크레딧)
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import { FALLBACK } from '../server/burger-talk.js';

export const VERDICTS = ['perfect', 'close', 'wrong'];   // 화면에 나오는 결과 (timeout은 예전 시간 제한용이라 안 만듦)
export const reactionFile = (bot, verdict) => `voice/react-${bot}-${verdict}.mp3`;

const root = fileURLToPath(new URL('..', import.meta.url));

async function main() {
  const env = existsSync(`${root}.env`) ? dotenv.parse(readFileSync(`${root}.env`, 'utf8')) : {};
  const key = env.ELEVENLABS_API_KEY || process.env.ELEVENLABS_API_KEY;
  if (!key) { console.error('✗ .env에 ELEVENLABS_API_KEY가 없어요.'); process.exit(1); }
  const characters = JSON.parse(readFileSync(`${root}config/characters.json`, 'utf8'));
  const model = characters.tts?.elevenlabsModel || 'eleven_v4';

  const dir = `${root}public/burger/voice`;
  const metaPath = `${dir}/react-made.json`;
  mkdirSync(dir, { recursive: true });
  const old = existsSync(metaPath) ? JSON.parse(readFileSync(metaPath, 'utf8')) : {};
  const meta = {};
  let made = 0, kept = 0, credits = 0;

  for (const bot of characters.bots) {
    const voice = bot.elevenlabsVoice;
    if (!voice) { console.log(`· ${bot.name}: ElevenLabs 목소리가 없어서 건너뜀`); continue; }
    for (const verdict of VERDICTS) {
      const text = FALLBACK[verdict]?.[bot.id];
      if (!text) continue;
      const rel = reactionFile(bot.id, verdict);
      const file = `${root}public/burger/${rel}`;
      meta[rel] = { text, voice, model };
      if (existsSync(file) && JSON.stringify(old[rel]) === JSON.stringify(meta[rel])) { kept++; continue; }
      const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voice}?output_format=mp3_44100_128`, {
        method: 'POST',
        headers: { 'xi-api-key': key, 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, model_id: model }),
      });
      if (!res.ok) {
        console.error(`✗ ${bot.name} ${rel} "${text}": ${res.status} ${(await res.text()).slice(0, 200)}`);
        process.exit(1);
      }
      writeFileSync(file, Buffer.from(await res.arrayBuffer()));
      credits += Number(res.headers.get('character-cost') || 0);
      made++;
      console.log(`✓ ${bot.name} ${rel}: ${text}`);
    }
  }

  writeFileSync(metaPath, JSON.stringify(meta, null, 2) + '\n');
  console.log(`\n주문 완료 한마디 ${made}개 새로 만듦, ${kept}개 그대로 (이번에 쓴 크레딧 ${credits}).`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) await main();
