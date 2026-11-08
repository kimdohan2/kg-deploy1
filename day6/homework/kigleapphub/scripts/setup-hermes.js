// Hermes 프로필 hubjipsa(허브집사)를 이 프로젝트 설정대로 만들고 맞춘다.
// 여러 번 실행해도 안전하다: 프로필이 없을 때만 만들고, 설정은 필요한 키만 덮어쓴다.
//   npm run setup-hermes
import { existsSync, readFileSync, writeFileSync, chmodSync, mkdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import YAML from 'yaml';
import { HERMES_HOME, hermesBin, hermesEnv, hasHermes } from './hermes.js';

const root = fileURLToPath(new URL('..', import.meta.url));
const PROFILE = 'hubjipsa';

function fail(msg) {
  console.error(`\n✗ ${msg}`);
  process.exit(1);
}

if (!existsSync(`${root}.env`)) fail('.env 파일이 없어요. `cp .env.example .env`로 만든 뒤 값을 채워 주세요.');
const env = dotenv.parse(readFileSync(`${root}.env`, 'utf8'));
if (!env.ANTHROPIC_API_KEY) fail('.env에 ANTHROPIC_API_KEY가 비어 있어요.');
// 디스코드 값이 없으면 디스코드만 빼고 설정한다 (터미널에서 먼저 시험해 볼 수 있게)
const discordReady = Boolean(env.DISCORD_BOT_TOKEN && env.DISCORD_CHANNEL_ID);
if (discordReady && !/^\d{15,20}$/.test(env.DISCORD_CHANNEL_ID)) fail('DISCORD_CHANNEL_ID는 숫자로 된 채널 ID여야 해요 (README 1단계 ⑥).');
if (!hasHermes()) fail('hermes-agent 폴더에 Hermes가 설치돼 있지 않아요. 먼저 설치해 주세요 (README 2단계).');

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

// node가 있는 폴더 + 기본 폴더만 (node를 업데이트해도 버전 번호 없는 경로라 그대로 동작)
function nodePath() {
  const dirs = (process.env.PATH || '').split(':').filter(d => d && !d.includes('node_modules'));
  const nodeDir = dirs.find(d => existsSync(`${d}/node`)) || '/opt/homebrew/bin';
  return [...new Set([nodeDir, '/usr/local/bin', '/usr/bin', '/bin'])].join(':');
}

const home = `${HERMES_HOME}/profiles/${PROFILE}`;
if (!existsSync(home)) {
  console.log(`· 프로필 만들기: ${PROFILE}`);
  // 별명 명령(~/.local/bin/<이름>)과 기본 스킬은 만들지 않는다. 허브집사는 앱허브 조회만 한다.
  execFileSync(hermesBin, ['profile', 'create', PROFILE, '--no-alias', '--no-skills'], { stdio: 'inherit', env: hermesEnv });
}
mkdirSync(home, { recursive: true });

writeFileSync(`${home}/SOUL.md`, readFileSync(`${root}bot/SOUL.md`, 'utf8'));

const port = env.BOT_API_PORT || '8661';
const channel = env.DISCORD_CHANNEL_ID;
const existingKey = existsSync(`${home}/.env`) && readFileSync(`${home}/.env`, 'utf8').match(/^API_SERVER_KEY=(.+)$/m)?.[1];
mergeEnv(`${home}/.env`, {
  ANTHROPIC_API_KEY: env.ANTHROPIC_API_KEY,
  ...(discordReady ? {
    DISCORD_BOT_TOKEN: env.DISCORD_BOT_TOKEN,
    // #허브집사 채널에서만, 그 채널에 있는 누구나. 멘션 없이 말해도 대답한다.
    DISCORD_ALLOWED_CHANNELS: channel,
    DISCORD_FREE_RESPONSE_CHANNELS: channel,
    DISCORD_HOME_CHANNEL: channel,
    DISCORD_AUTO_THREAD: 'false',
    DISCORD_ALLOW_BOTS: 'none',
  } : {}),
  // 이 프로필만의 Hermes API 서버 포트 (투닥 아레나 8651~8653과 겹치지 않게)
  API_SERVER_ENABLED: 'true',
  API_SERVER_PORT: port,
  API_SERVER_HOST: '127.0.0.1',
  API_SERVER_KEY: existingKey || randomBytes(24).toString('hex'),
});

mergeYaml(`${home}/config.yaml`, {
  'model.provider': 'anthropic',
  'model.default': env.BOT_MODEL || 'claude-haiku-5-5',
  // 앱허브 읽기 도구 3개 (scripts/apphub-mcp.js). Hermes가 필요할 때 이 프로그램을 띄운다.
  'mcp_servers.apphub': {
    command: 'node',
    args: [`${root}scripts/apphub-mcp.js`],
    env: { HOME: process.env.HOME, PATH: nodePath() },
    tools: { resources: false, prompts: false },
  },
  // 디스코드에서는 앱허브 도구만 쓴다 (터미널·파일·웹 같은 도구는 안 줌)
  'platform_toolsets.discord': ['mcp-apphub'],
  'display.platforms.discord.tool_progress': 'off',
  'display.platforms.discord.interim_assistant_messages': false,
  // 같은 채널이어도 사람마다 대화를 따로 기억한다 ("내 이름"이 섞이지 않게)
  group_sessions_per_user: true,
  // 기본 프로필 게이트웨이에 묶지 않고 이 프로필의 게이트웨이를 따로 돌린다 (그래야 포트가 따로 생김)
  'gateway.standalone': true,
  // 이 채널에 있는 사람은 누구나 말을 걸 수 있다 (DISCORD_ALLOWED_CHANNELS만으로는 사람 허용이 안 됨).
  // DM이나 다른 채널은 여기 없으니 계속 막힌다.
  ...(discordReady ? { 'gateway.platforms.discord.extra.group_allowed_chats': [channel] } : {}),
});

if (!discordReady) {
  console.log(`✓ 허브집사: SOUL.md · .env · config.yaml (포트 ${port}, 디스코드는 아직 안 넣음)

디스코드 없이 터미널에서 먼저 말 걸어 보기:
  npm run hermes -- -p hubjipsa chat

디스코드에 연결하려면 .env에 DISCORD_BOT_TOKEN, DISCORD_CHANNEL_ID를 넣고 다시 npm run setup-hermes (README 1단계)
`);
  process.exit(0);
}

console.log(`✓ 허브집사: SOUL.md · .env · config.yaml (포트 ${port}, 채널 ${channel})

다음 단계
  1) 봇 켜기:  npm run bot
  2) 디스코드 #허브집사 채널에서 "치과 애드몹"처럼 말 걸기
`);
