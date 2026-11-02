// 봇 3명의 게이트웨이를 한 번에 켠다. 프로필마다 따로 실행되고, 각자 자기 포트를 쓴다.
//   npm run bots   (Ctrl-C로 모두 끔)
import { readFileSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { createInterface } from 'node:readline';
import { fileURLToPath } from 'node:url';
import { hermesBin, hermesEnv, hasHermes } from './hermes.js';

const root = fileURLToPath(new URL('..', import.meta.url));
const characters = JSON.parse(readFileSync(`${root}config/characters.json`, 'utf8'));
// Hermes는 게이트웨이가 동시에 뜨면 하나만 남기고 75로 끝낸다("잠시 뒤 다시"). 간격을 두고, 75면 다시 켠다.
const RETRY_CODE = 75;
const GAP_MS = 4000;

if (!hasHermes()) {
  console.error('✗ hermes-agent 폴더에 Hermes가 설치돼 있지 않아요 (README 2단계).');
  process.exit(1);
}

let stopping = false;

function run(bot, tries = 0) {
  const child = spawn(hermesBin, ['-p', bot.id, 'gateway', 'run'], { env: hermesEnv });
  for (const stream of [child.stdout, child.stderr]) {
    createInterface({ input: stream }).on('line', line => console.log(`[${bot.name}] ${line}`));
  }
  child.on('exit', code => {
    if (code === RETRY_CODE && !stopping && tries < 5) {
      setTimeout(() => run(bot, tries + 1), 3000);
      return;
    }
    console.log(`[${bot.name}] 게이트웨이 꺼짐 (${code})`);
  });
}

characters.bots.forEach((bot, i) => setTimeout(() => {
  if (stopping) return;
  console.log(`· ${bot.name}: 게이트웨이 켜는 중 (API 포트 ${bot.apiPort})`);
  run(bot);
}, i * GAP_MS));

// Ctrl-C는 게이트웨이들도 같이 받는다. 이 스크립트는 그들이 다 꺼질 때까지 기다린다.
process.on('SIGINT', () => { stopping = true; });
