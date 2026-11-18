// Show me the burger를 서버 없이 올릴 수 있는 정적 사이트로 묶는다 (디스코드 없이 누구나 플레이).
//   public/burger/를 dist/show-me-the-burger/로 복사하고, socket.io 자리에 burger/static/offline.js를 넣는다.
//   곡 목록·손님 순서·주문 완료 한마디는 서버 코드에서 그대로 가져와 data/shop.json으로 쓴다.
//   화면에서 디스코드 되묻기 안내·"다른 게임" 링크는 숨긴다. 게임 원본(public/burger/)은 건드리지 않는다.
//   npm run burger-static  → 올리기: npm run burger-deploy (처음 한 번은 README "서버 없이 올리기")
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { BurgerShop, BPM, LEVELS, TEAMS } from '../server/burger.js';
import { FALLBACK } from '../server/burger-talk.js';
import { VERDICTS, reactionFile } from './burger-reactions.js';

const root = fileURLToPath(new URL('..', import.meta.url));
const src = `${root}public/burger`;
const out = `${root}dist/show-me-the-burger`;
const SKIP = new Set(['vc-test', 'review.html', 'voice/made.json', 'voice/react-made.json']);   // 게임에 안 쓰는 것

// 예전 결과를 지운다. .vercel(Vercel 프로젝트 연결)은 남겨서 다음에도 같은 주소로 올라가게 한다.
mkdirSync(out, { recursive: true });
for (const f of readdirSync(out)) if (f !== '.vercel') rmSync(`${out}/${f}`, { recursive: true, force: true });
cpSync(src, out, { recursive: true, filter: p => !SKIP.has(p.slice(src.length + 1)) });
cpSync(`${root}burger/static/offline.js`, `${out}/offline.js`);

// 서버가 고르는 것과 같은 곡(음악 mp3가 있는 곡)과 박자
const shop = new BurgerShop({ root, talk: null });
const characters = JSON.parse(readFileSync(`${root}config/characters.json`, 'utf8'));
const reactions = {};
const noVoice = [];
for (const bot of characters.bots) {
  reactions[bot.id] = {};
  for (const verdict of VERDICTS) {
    const text = FALLBACK[verdict]?.[bot.id];
    if (!text) continue;
    const file = reactionFile(bot.id, verdict);
    const has = existsSync(`${src}/${file}`);
    if (!has) noVoice.push(file);
    reactions[bot.id][verdict] = { text, file: has ? file : null };
  }
}
writeFileSync(`${out}/data/shop.json`, JSON.stringify({
  teams: TEAMS, levels: LEVELS,
  songs: shop.songs.map(s => ({ ...s, bpm: s.bpm || BPM[s.genre] || 120 })),
  reactions,
}));

// 화면 글자 바꾸기: 바꿀 곳이 정확히 한 군데가 아니면 멈춘다 (원본이 바뀌어서 못 찾으면 알 수 있게)
function patch(file, edits) {
  let text = readFileSync(`${out}/${file}`, 'utf8');
  for (const [from, to, label] of edits) {
    const n = typeof from === 'string' ? text.split(from).length - 1 : (text.match(new RegExp(from, 'g')) || []).length;
    if (n !== 1) throw new Error(`${file}: "${label}"을(를) ${n}군데에서 찾음 (1군데여야 함)`);
    text = text.replace(from, to);
  }
  writeFileSync(`${out}/${file}`, text);
}
patch('index.html', [
  ['<script src="/socket.io/socket.io.js"></script>', '<script src="offline.js"></script>', 'socket.io'],
  [/\n\s*<li>랩이 끝나면 디스코드에서[^\n]*<\/li>/, '', '규칙의 디스코드 되묻기'],
  [/ 되묻기는 디스코드 음성방[^\n]*?해요\.<\/p>/, '</p>', '시작 카드 아래 디스코드 안내'],
  ['</head>', '  <style>.back, #discord, #asks, .overlay .buttons a[href="../"] { display: none !important; }</style>\n</head>', '숨길 것'],
]);
patch('burger.js', [
  ["'✅ 다 찍었으면 주문 완료 · 헷갈리면 디스코드에서 손님에게 물어보세요'", "'✅ 다 찍었으면 주문 완료를 눌러요'", '랩 끝 안내'],
]);

const size = p => statSync(p).isDirectory() ? readdirSync(p).reduce((n, f) => n + size(`${p}/${f}`), 0) : statSync(p).size;
console.log(`✓ dist/show-me-the-burger: 곡 ${shop.songs.length}개, ${(size(out) / 1e6).toFixed(1)}MB`);
if (noVoice.length) console.log(`! 목소리 없는 한마디 ${noVoice.length}개 (말풍선만 나옴) → npm run burger-reactions`);
