// 투닥 아레나 서버 — 웹 게임(포트 3300)과 심판 봇을 함께 띄운다. 대표 게임 Show me the burger(/burger/)는 사람마다 따로, 밀치기는 한 명이 조작하고 나머지는 관전.
import { readFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { fileURLToPath } from 'node:url';
import express from 'express';
import { Server } from 'socket.io';
import dotenv from 'dotenv';
import { Game, R0, PR } from './game.js';
import { attachBurger } from './burger-talk.js';
import { BurgerShop } from './burger.js';
import { Referee } from './referee.js';
import { VoiceFloor } from './floor.js';
import { ClipBoard } from './clips.js';

const root = fileURLToPath(new URL('..', import.meta.url));
dotenv.config({ path: `${root}.env`, quiet: true });
const readJson = p => JSON.parse(readFileSync(`${root}${p}`, 'utf8'));
const characters = readJson('config/characters.json');
const refereeCfg = readJson('config/referee.json');
const PORT = Number(process.env.GAME_PORT) || 3300;

const app = express();
app.use(express.static(`${root}public`));
app.use('/burger-clips', express.static(`${root}clips`));   // Show me the burger: 손님 감탄사(주문 끝·재촉)를 웹에서 튼다
app.get('/api/config', (req, res) => res.json({
  R0, PR,
  player: characters.player,
  bots: characters.bots.map(({ id, name, color }) => ({ id, name, color })),
}));

const server = createServer(app);
const io = new Server(server);
const game = new Game(characters.bots);
const voice = new VoiceFloor(refereeCfg.voiceFloor);
const clips = new ClipBoard({ root, ...refereeCfg.clips });
const referee = new Referee({ game, bots: characters.bots, player: characters.player, cfg: refereeCfg, env: process.env, io, voice, clips });
const burger = attachBurger({ referee, root, env: process.env, ttsModel: characters.tts?.elevenlabsModel });   // Show me the burger: 주문 완료 → 손님 봇 한마디(웹 목소리)
const shop = new BurgerShop({ root, talk: burger });   // 사람마다 따로 한 판 (/burger/)

// 조작은 먼저 들어온 한 명만, 나머지는 관전
let controller = null;

io.on('connection', socket => {
  socket.emit('status', { discord: referee.status, chatter: referee.enabled });

  socket.on('join', ({ name } = {}) => {
    const clean = String(name || '').trim().slice(0, 12) || '플레이어';
    if (!controller || !io.sockets.sockets.has(controller)) {
      controller = socket.id;
      game.setHuman(clean);
      socket.emit('role', 'player');
      console.log(`[게임] ${clean} 입장 (밀치기)`);
    } else {
      socket.emit('role', 'spectator');
    }
  });

  socket.on('input', input => {
    if (socket.id === controller) game.setInput(input);
  });

  // Show me the burger (/burger/): 한 판 시작 → 손님(인사) → 주문 시작 → 다시 듣기 → 주문 완료 → 다음 손님 … → 결과
  const reply = (ack, v) => { if (typeof ack === 'function') ack(v); };
  socket.on('burger_start', (_, ack) => reply(ack, shop.start(socket.id)));
  socket.on('burger_next', (_, ack) => reply(ack, shop.next(socket.id)));
  socket.on('burger_play', (_, ack) => reply(ack, shop.play(socket.id)));
  socket.on('burger_replay', (_, ack) => reply(ack, shop.replay(socket.id)));
  // 주문 완료: 채점 → 손님 한 명이 Hermes로 짧게 한마디 → 그 목소리(mp3)를 이 사람 화면에만 보낸다. 화면은 다 들으면 다음 손님을 연다
  socket.on('burger_submit', (data, ack) => reply(ack, shop.submit(socket.id, data, line => socket.emit('burger_voice', line))));
  // 랩(주문)이 끝남: 손님이 웹에서 "주문 끝~" 감탄사 (미리 만든 소리라 크레딧 안 듦)
  const clipTo = (bot, kind) => { const c = bot && clips.pick(bot, kind); if (c) socket.emit('burger_clip', { who: bot, ...c }); };
  socket.on('burger_rap_end', () => clipTo(shop.rapEnd(socket.id), 'ordered'));
  // 랩이 끝나고 한참 안 찍으면: 손님마다 20% 확률로 웹에서 재촉 한마디 (미리 만든 소리)
  socket.on('burger_hurry', () => clipTo(shop.hurry(socket.id), 'hurry'));
  // 시험 화면(/order-test/): 정답과 찍은 것을 받아서 비교하고 손님 봇이 한마디
  socket.on('burger_done', (data, ack) => reply(ack, burger.orderDone(data)));

  socket.on('restart', () => {
    if (socket.id === controller) game.restart();
  });

  socket.on('chatter', on => referee.setEnabled(!!on));

  socket.on('disconnect', () => {
    shop.leave(socket.id);
    if (socket.id !== controller) return;
    controller = null;
    game.removeHuman();
    console.log('[게임] 플레이어가 나가서 일시정지');
  });
});

game.on('fx', fx => io.emit('fx', fx));

// 물리는 60번/초, 화면 전송은 30번/초
let last = performance.now(), frame = 0;
setInterval(() => {
  const now = performance.now();
  game.tick(Math.min(0.05, (now - last) / 1000));
  last = now;
  if (++frame % 2 === 0) io.emit('state', game.snapshot());
}, 1000 / 60);

// 봇(Hermes)들만 쓰는 곳. 친구 공유(터널)는 3300만 열어서 여기는 내 컴퓨터에서만 닿는다.
//   /voice-listener  사람이 음성으로 한 이 말, 누가 들어? (Jev)
//   /floor/acquire   음성방에서 말할 차례 받기 (차례가 올 때까지 기다렸다가 답함)
//   /floor/release   다 말했음
//   /clips/next      내 감탄사 있어? (생길 때까지 기다렸다가 답함)
const JUDGE_PORT = PORT + 1;
createServer(async (req, res) => {
  let body = '';
  // 봇 쪽 연결이 중간에 끊기면(노트북 잠자기·와이파이 끊김) 읽기가 실패한다 → 그 요청만 버리고 서버는 계속
  try { for await (const chunk of req) body += chunk; } catch { return; }
  let data = {};
  try { data = JSON.parse(body || '{}'); } catch {}
  const reply = obj => res.writeHead(200, { 'Content-Type': 'application/json' }).end(JSON.stringify(obj));
  if (req.method !== 'POST') { res.writeHead(404).end(); return; }
  if (req.url === '/voice-listener') {
    const speech = String(data.speech || '').slice(0, 500);
    // 봇이 대답하기 전에 먼저 묻는다: 이 말(음성) 또는 글(채팅, typed)을 게임이 가져가? (버거 손님에게 되묻기면 봇들은 직접 대답 안 함)
    if (data.gate) {
      const r = speech && referee.enabled ? shop.voiceAsk(speech) : null;
      if (r && !r.handled) {
        r.handled = true;   // 봇 3명이 같은 말을 물어 와도 한 번만
        const typed = !!data.typed;
        if (r.who) {
          const onDone = () => io.to(r.sid).emit('burger_answered', { who: r.who, left: shop.answered(r.sid) });
          if (burger.ask({ who: r.who, song: r.song, speech, typed, onDone })) io.to(r.sid).emit('burger_asked', { who: r.who, left: r.left, typed });
          else onDone();
        } else {
          io.to(r.sid).emit('burger_asked', { early: !!r.early, busy: !!r.busy, again: !!r.again });
        }
      }
      return reply({ skip: !!r });
    }
    return reply(speech ? await referee.voiceListener(speech) : { bot: null, by: 'none' });
  }
  if (req.url === '/floor/acquire') {
    const opts = data.priority ? { priority: true, waitMaxMs: Number(data.waitMs) || 2500 } : {};
    return reply({ granted: await voice.acquire(String(data.bot || '?'), opts) });
  }
  if (req.url === '/clips/next') return reply(await clips.next(String(data.bot || '?')));
  if (req.url === '/floor/release') { voice.release(String(data.bot || '?')); return reply({ ok: true }); }
  res.writeHead(404).end();
}).listen(JUDGE_PORT, '127.0.0.1');

server.listen(PORT, () => {
  console.log(`투닥 아레나: http://localhost:${PORT}`);
  referee.start();
});
