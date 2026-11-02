// 이 프로젝트 안에 설치한 Hermes(hermes-agent/)를 이 프로젝트의 데이터 폴더(hermes-home/)로 실행한다.
// 다른 스크립트가 가져다 쓰고, 직접 실행하면 hermes 명령을 그대로 넘긴다.
//   npm run hermes -- -p coco logs -f
import { existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
export const HERMES_HOME = process.env.HERMES_HOME || `${root}hermes-home`;
export const hermesBin = `${root}hermes-agent/.hermes/bin/hermes`;
export const hermesEnv = { ...process.env, HERMES_HOME };
export const hasHermes = () => existsSync(hermesBin);

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  if (!hasHermes()) {
    console.error('✗ hermes-agent 폴더에 Hermes가 설치돼 있지 않아요 (README 2단계).');
    process.exit(1);
  }
  const r = spawnSync(hermesBin, process.argv.slice(2), { stdio: 'inherit', env: hermesEnv });
  process.exit(r.status ?? 1);
}
