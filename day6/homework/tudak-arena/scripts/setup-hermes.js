// Hermes 프로필 3개(코코·러비·Rou)를 이 프로젝트 설정대로 만들고 맞춘다.
// 프로필은 hermes-home/profiles/<이름>에 따로 있고, 게이트웨이도 각자 자기 포트로 따로 돈다.
// 여러 번 실행해도 안전하다: 없는 프로필만 만들고, 설정은 필요한 키만 덮어쓴다.
//   npm run setup-hermes
import { existsSync, readFileSync, writeFileSync, chmodSync, mkdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import YAML from 'yaml';
import { HERMES_HOME, hermesBin, hermesEnv, hasHermes } from './hermes.js';
import { patchHermes } from './patch-hermes.js';

const root = fileURLToPath(new URL('..', import.meta.url));

const idFromToken = t => Buffer.from(t.split('.')[0], 'base64').toString('utf8');

function fail(msg) {
  console.error(`\n✗ ${msg}`);
  process.exit(1);
}

// ---------- 확인 ----------

if (!existsSync(`${root}.env`)) fail('.env 파일이 없어요. `cp .env.example .env`로 만든 뒤 값을 채워 주세요.');
const env = dotenv.parse(readFileSync(`${root}.env`, 'utf8'));
const characters = JSON.parse(readFileSync(`${root}config/characters.json`, 'utf8'));

const required = ['ANTHROPIC_API_KEY', 'DISCORD_TOKEN_REFEREE', 'DISCORD_OWNER_ID', 'DISCORD_TEXT_CHANNEL_ID',
  ...characters.bots.map(b => b.tokenEnv)];
const missing = required.filter(k => !env[k]);
if (missing.length) fail(`.env에 아직 비어 있는 값이 있어요: ${missing.join(', ')}`);

// 목소리 엔진: characters.json의 tts.provider ("edge" 무료 | "elevenlabs" 유료)
const ttsProvider = characters.tts?.provider || 'edge';
const elevenKey = env.ELEVENLABS_API_KEY || process.env.ELEVENLABS_API_KEY || '';
if (ttsProvider === 'elevenlabs') {
  if (!elevenKey) fail('ElevenLabs를 쓰려면 .env에 ELEVENLABS_API_KEY를 넣어 주세요.');
  const noVoice = characters.bots.filter(b => !b.elevenlabsVoice).map(b => b.name);
  if (noVoice.length) fail(`ElevenLabs 목소리가 비어 있어요: ${noVoice.join(', ')} — npm run voices로 고른 뒤 characters.json의 elevenlabsVoice에 넣어 주세요.`);
}

if (!hasHermes()) fail('hermes-agent 폴더에 Hermes가 설치돼 있지 않아요. 먼저 설치해 주세요 (README 2단계).');

if (!patchHermes()) fail('Hermes 패치를 적용하지 못했어요. 위 메시지를 확인해 주세요.');

const refereeId = idFromToken(env.DISCORD_TOKEN_REFEREE);
const names = Object.fromEntries(characters.bots.map(b => [b.id, b.name]));

// ---------- 도우미 ----------

function mergeEnv(path, values) {
  const lines = existsSync(path) ? readFileSync(path, 'utf8').split('\n') : [];
  const done = new Set();
  const out = lines.map(line => {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=/);
    if (m && m[1] in values) { done.add(m[1]); return `${m[1]}=${values[m[1]]}`; }
    return line;
  });
  for (const [k, v] of Object.entries(values)) if (!done.has(k)) out.push(`${k}=${v}`);
  writeFileSync(path, out.join('\n').replace(/\n*$/, '\n'));
  chmodSync(path, 0o600);
}

function mergeYaml(path, values) {
  const doc = existsSync(path) ? YAML.parseDocument(readFileSync(path, 'utf8')) : new YAML.Document({});
  if (!doc.contents) doc.contents = doc.createNode({});
  for (const [key, value] of Object.entries(values)) doc.setIn(key.split('.'), value);
  writeFileSync(path, doc.toString());
}

// 음성에서 이 봇을 부르는 이름들 (Rou는 "루"로 불림)
const callNames = b => [...new Set([b.name, b.speakName])];

function render(text, self) {
  return text
    .replaceAll('{{coco}}', names.coco)
    .replaceAll('{{lovey}}', names.lovey)
    .replaceAll('{{rou}}', names.rou)
    .replaceAll('{{player}}', characters.player?.callName || '사람 친구')
    .replaceAll('{{self}}', self);
}

// ---------- 봇 프로필 ----------

const common = readFileSync(`${root}bots/common.md`, 'utf8');

for (const bot of characters.bots) {
  const home = `${HERMES_HOME}/profiles/${bot.id}`;
  if (!existsSync(home)) {
    console.log(`· 프로필 만들기: ${bot.id}`);
    // 별명 명령(~/.local/bin/<이름>)과 기본 스킬은 만들지 않는다. 봇은 대화만 한다.
    execFileSync(hermesBin, ['profile', 'create', bot.id, '--no-alias', '--no-skills'], { stdio: 'inherit', env: hermesEnv });
  }
  mkdirSync(home, { recursive: true });

  const soul = render(`${readFileSync(`${root}bots/${bot.id}.md`, 'utf8')}\n${common}`, bot.name);
  writeFileSync(`${home}/SOUL.md`, soul);

  const existingKey = existsSync(`${home}/.env`) && readFileSync(`${home}/.env`, 'utf8').match(/^API_SERVER_KEY=(.+)$/m)?.[1];
  mergeEnv(`${home}/.env`, {
    ANTHROPIC_API_KEY: env.ANTHROPIC_API_KEY,
    DISCORD_BOT_TOKEN: env[bot.tokenEnv],
    // 나와 심판만 말을 걸 수 있다
    DISCORD_ALLOWED_USERS: `${env.DISCORD_OWNER_ID},${refereeId}`,
    DISCORD_ALLOW_BOTS: 'mentions',
    DISCORD_ALLOWED_CHANNELS: env.DISCORD_TEXT_CHANNEL_ID,
    DISCORD_REQUIRE_MENTION: 'true',
    DISCORD_AUTO_THREAD: 'false',
    DISCORD_REACTIONS: 'false',
    DISCORD_REPLY_TO_MODE: 'off',
    // 채널의 예전 메시지는 읽지 않는다. 친구 말은 심판이 [수다]로 전해 주고, 예전 메시지에 남은 잘못된 이름을 따라 하지 않게.
    DISCORD_HISTORY_BACKFILL: 'false',
    // 홈 채널이 없다는 안내("📬 No home channel…")가 채팅에 올라오지 않게
    DISCORD_HOME_CHANNEL: env.DISCORD_TEXT_CHANNEL_ID,
    DISCORD_HISTORY_BACKFILL_LIMIT: '0',
    // 심판(봇)이 부른 메시지는 "뒤에 더 올지도" 하고 2초를 기다린다. 심판은 한 번에 한 줄만 보내니 바로 처리.
    HERMES_DISCORD_TEXT_BATCH_DELAY_SECONDS: '0.2',
    HERMES_DISCORD_TEXT_BATCH_SPLIT_DELAY_SECONDS: '0.2',
    // 봇마다 자기 포트의 Hermes API 서버
    API_SERVER_ENABLED: 'true',
    API_SERVER_PORT: String(bot.apiPort),
    API_SERVER_HOST: '127.0.0.1',
    API_SERVER_KEY: existingKey || randomBytes(24).toString('hex'),
    ...(elevenKey ? { ELEVENLABS_API_KEY: elevenKey } : {}),
    // 음성방에서 사람이 말하면: 이름이 불린 봇만 대답, 이름이 없으면 기본 봇만 대답 (patch-hermes.js)
    TUDAK_VOICE_NAMES: callNames(bot).join(','),
    TUDAK_VOICE_OTHERS: characters.bots.filter(b => b !== bot).flatMap(callNames).join(','),
    TUDAK_VOICE_DEFAULT: bot.id === characters.voiceDefault ? '1' : '0',
    // 이름 없이 한 말은 게임 서버(npm start)가 Jev로 누구에게 한 말인지 고른다 (server/judge.js)
    TUDAK_VOICE_ID: bot.id,
    TUDAK_JUDGE_URL: `http://127.0.0.1:${Number(env.GAME_PORT || 3300) + 1}/voice-listener`,
    // 음성방에서 말하기 전에 게임 서버에서 차례를 받는다 → 글은 먼저 올리고 목소리는 한 명씩 (patch-hermes.js)
    TUDAK_FLOOR_URL: `http://127.0.0.1:${Number(env.GAME_PORT || 3300) + 1}/floor`,
    // 내가 음성방(voiceChannel)에 들어가면 따라 들어오고, 나가면 같이 나간다 (patch-hermes.js)
    TUDAK_FOLLOW_USER: env.DISCORD_OWNER_ID,
    TUDAK_FOLLOW_VOICE: characters.voiceChannel || '',
    TUDAK_FOLLOW_TEXT: env.DISCORD_TEXT_CHANNEL_ID,
  });

  mergeYaml(`${home}/config.yaml`, {
    'model.provider': 'anthropic',
    'model.default': characters.model,
    'tts.provider': ttsProvider,
    // ElevenLabs는 말 속도 설정이 없어서 목소리 자체로 성격을 낸다. flash 모델이 가장 빠르다.
    'tts.elevenlabs.voice_id': bot.elevenlabsVoice || '',
    'tts.elevenlabs.model_id': characters.tts?.elevenlabsModel || 'eleven_flash_v2_5',
    'tts.speed': bot.speed,
    'tts.edge.voice': bot.voice,
    'tts.edge.speed': bot.speed,
    'stt.language': 'ko',
    'discord.require_mention': true,
    'discord.auto_thread': false,
    'discord.reactions': false,
    'discord.history_backfill_limit': 0,
    // 음성방에서 조용해도 나가지 않기 (0 = /voice leave 할 때까지 유지)
    'discord.voice_channel_inactivity_timeout_seconds': 0,
    // 디스코드에서는 도구를 거의 쓰지 않게 (대화만)
    'platform_toolsets.discord': ['todo'],
    // 기본 프로필 게이트웨이 하나에 묶지 않고, 이 프로필의 게이트웨이를 따로 돌린다 (그래야 포트가 따로 생김)
    // 디스코드에는 대사만: 도구 사용 표시(⚙️), 중간 메시지, 오래 걸림 안내를 올리지 않는다 (심판이 대사로 착각함)
    'display.platforms.discord.tool_progress': 'off',
    'display.platforms.discord.interim_assistant_messages': false,
    'display.platforms.discord.long_running_notifications': false,
    'display.platforms.discord.busy_ack_detail': false,
    'gateway.standalone': true,
    // 심판(봇)이 부르는 메시지를 봇 대화 폭주로 오해해 막지 않게 한도를 넉넉히 (기본 5분에 20개)
    'gateway.bot_loop_guard.max_events': 60,
  });
  const voiceInfo = ttsProvider === 'elevenlabs' ? `ElevenLabs ${bot.elevenlabsVoice}` : `${bot.voice}, 속도 ${bot.speed}`;
  console.log(`✓ ${bot.name}: SOUL.md · .env · config.yaml (포트 ${bot.apiPort}, 목소리 ${voiceInfo})`);
}

console.log(`
다음 단계
  1) 봇 켜기 (게이트웨이 3개가 함께 켜져요):  npm run bots
  2) 디스코드 음성방 "투닥-아레나"에 들어간 뒤, #투닥-중계에서 봇마다 /voice join 실행
  3) 게임 켜기:  npm start  →  http://localhost:${env.GAME_PORT || 3300}
`);
