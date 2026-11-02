// 투닥 아레나 서버 — 웹 게임(포트 3300)과 심판 봇을 함께 띄운다.
import { readFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { fileURLToPath } from 'node:url';
import express from 'express';
import { Server } from 'socket.io';
import dotenv from 'dotenv';
import { Game, R0, PR } from './game.js';
import { Referee } from './referee.js';
import { VoiceFloor } from './floor.js';

const root = fileURLToPath(new URL('..', import.meta.url));
dotenv.config({ path: `${root}.env`, quiet: true });
const readJson = p => JSON.parse(readFileSync(`${root}${p}`, 'utf8'));
const characters = readJson('config/characters.json');
const refereeCfg = readJson('config/referee.json');
const PORT = Number(process.env.GAME_PORT) || 3300;

const app = express();
app.use(express.static(`${root}public`));
app.get('/api/config', (req, res) => res.json({
  R0, PR,
  player: characters.player,
  bots: characters.bots.map(({ id, name, color }) => ({ id, name, color })),
}));

const server = createServer(app);
const io = new Server(server);
const game = new Game(characters.bots);
const voice = new VoiceFloor(refereeCfg.voiceFloor);
const referee = new Referee({ game, bots: characters.bots, player: characters.player, cfg: refereeCfg, env: process.env, io, voice });

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
      console.log(`[게임] ${clean} 입장`);
    } else {
      socket.emit('role', 'spectator');
    }
  });

  socket.on('input', input => {
    if (socket.id === controller) game.setInput(input);
  });

  socket.on('restart', () => {
    if (socket.id === controller) game.restart();
  });

  socket.on('chatter', on => referee.setEnabled(!!on));

  socket.on('disconnect', () => {
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
const JUDGE_PORT = PORT + 1;
createServer(async (req, res) => {
  let body = '';
  for await (const chunk of req) body += chunk;
  let data = {};
  try { data = JSON.parse(body || '{}'); } catch {}
  const reply = obj => res.writeHead(200, { 'Content-Type': 'application/json' }).end(JSON.stringify(obj));
  if (req.method !== 'POST') { res.writeHead(404).end(); return; }
  if (req.url === '/voice-listener') {
    const speech = String(data.speech || '').slice(0, 500);
    return reply(speech ? await referee.voiceListener(speech) : { bot: null, by: 'none' });
  }
  if (req.url === '/floor/acquire') return reply({ granted: await voice.acquire(String(data.bot || '?')) });
  if (req.url === '/floor/release') { voice.release(String(data.bot || '?')); return reply({ ok: true }); }
  res.writeHead(404).end();
}).listen(JUDGE_PORT, '127.0.0.1');

server.listen(PORT, () => {
  console.log(`투닥 아레나: http://localhost:${PORT}`);
  referee.start();
});
