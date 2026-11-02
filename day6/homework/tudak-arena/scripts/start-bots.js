// 봇 3명의 게이트웨이를 한 번에 켠다. 프로필마다 따로 실행되고, 각자 자기 포트를 쓴다.
//   npm run bots   (Ctrl-C로 모두 끔)
import { existsSync, readFileSync, statSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { createInterface } from 'node:readline';
import { fileURLToPath } from 'node:url';
import { HERMES_HOME, hermesBin, hermesEnv, hasHermes } from './hermes.js';
import { patchHermes } from './patch-hermes.js';

const root = fileURLToPath(new URL('..', import.meta.url));
const characters = JSON.parse(readFileSync(`${root}config/characters.json`, 'utf8'));
// Hermes는 게이트웨이가 동시에 뜨면 하나만 남기고 75로 끝낸다("잠시 뒤 다시").
// 그렇게 다시 켜진 봇은 Claude 연결 부품(anthropic)을 못 찾는 일이 있어서, 앞 봇이 다 켜진 뒤에 다음 봇을 켠다.
const RETRY_CODE = 75;
const READY_TIMEOUT_MS = 60000;
const READY_LINE = 'Gateway running with';

if (!hasHermes()) {
  console.error('✗ hermes-agent 폴더에 Hermes가 설치돼 있지 않아요 (README 2단계).');
  process.exit(1);
}
// Hermes를 업데이트하면 우리 수정이 사라지므로 켤 때마다 다시 확인한다 (실패해도 봇은 켬)
patchHermes({ quiet: true });

let stopping = false;
const children = new Set();

function run(bot, tries = 0) {
  const child = spawn(hermesBin, ['-p', bot.id, 'gateway', 'run'], { env: hermesEnv });
  children.add(child);
  for (const stream of [child.stdout, child.stderr]) {
    createInterface({ input: stream }).on('line', line => console.log(`[${bot.name}] ${line}`));
  }
  child.on('exit', code => {
    children.delete(child);
    if (code === RETRY_CODE && !stopping && tries < 5) {
      setTimeout(() => run(bot, tries + 1), 3000);
      return;
    }
    console.log(`[${bot.name}] 게이트웨이 꺼짐 (${code})`);
  });
}

// 이 봇의 gateway.log에 "Gateway running"이 새로 찍힐 때까지 기다린다
async function waitReady(bot) {
  const log = `${HERMES_HOME}/profiles/${bot.id}/logs/gateway.log`;
  const from = existsSync(log) ? statSync(log).size : 0;
  const end = Date.now() + READY_TIMEOUT_MS;
  while (!stopping && Date.now() < end) {
    await new Promise(r => setTimeout(r, 500));
    if (!existsSync(log)) continue;
    const buf = readFileSync(log);   // 크기는 바이트라서 바이트로 자른다 (한글이 섞이면 글자 수와 다름)
    if (buf.subarray(buf.length < from ? 0 : from).toString('utf8').includes(READY_LINE)) return true;
  }
  return false;
}

for (const bot of characters.bots) {
  if (stopping) break;
  console.log(`· ${bot.name}: 게이트웨이 켜는 중 (API 포트 ${bot.apiPort})`);
  const ready = waitReady(bot);
  run(bot);
  console.log((await ready) ? `✓ ${bot.name}: 켜짐` : `· ${bot.name}: 아직 준비 중이지만 다음 봇을 켜요`);
}

// 터미널의 Ctrl-C는 게이트웨이들도 같이 받는다. kill로 이 스크립트만 끄면 게이트웨이에도 전해 준다.
process.on('SIGINT', () => { stopping = true; });
process.on('SIGTERM', () => {
  stopping = true;
  for (const child of children) child.kill('SIGINT');
});
