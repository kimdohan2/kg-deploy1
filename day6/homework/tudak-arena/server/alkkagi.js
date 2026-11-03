// 알까기 게임 엔진 — 정사각형 판에서 차례대로 자기 돌을 튕겨 남의 돌을 판 밖으로 날린다.
// 투닥처럼 서버가 물리·차례·승패를 계산하고, 화면은 상태만 받아 그린다.
import { EventEmitter } from 'node:events';
import { planShot } from './alkkagi-ai.js';

export const B = 300;              // 판 반 너비 (판은 -B..B)
export const SR = 20;              // 돌 반지름
export const DECEL = 520;          // 미끄러질 때 줄어드는 속도 (초당)
export const MAX_SHOT = 1250;      // 가장 세게 쳤을 때 속도
export const DRAG_MAX = 160;        // 이만큼 끌면 최대 세기
const RESTITUTION = 0.92;
export const KEEP = (1 + RESTITUTION) / 2;   // 정면으로 맞혔을 때 맞은 돌이 받는 속도 비율
const STOP = 8;                    // 이보다 느리면 멈춘 걸로
const SUBSTEPS = 4;
const TURN_TIME = 20;              // 사람 조준 시간 (초)
const BOT_THINK = 2.5;             // 봇이 말 없이 쏠 때 생각하는 시간
const BOT_DECLARE_MAX = 6;         // 봇이 쏘기 전에 한마디 할 때 기다리는 최대 시간
const AFTER_SPOKE = 0.8;           // 봇 목소리가 시작되고 이만큼 뒤에 쏜다
const SETTLE = 1.2;                // 돌이 다 멈추고 다음 차례까지 쉬는 시간 (반응할 틈)
const STONES = 3;

const SEATS = {                    // 자리: 도도 아래, 코코 왼쪽, 러비 위, Rou 오른쪽
  player: (i) => ({ x: (i - 1) * 90, y: 210 }),
  coco: (i) => ({ x: -210, y: (i - 1) * 90 }),
  lovey: (i) => ({ x: (1 - i) * 90, y: -210 }),
  rou: (i) => ({ x: 210, y: (1 - i) * 90 }),
};

export class Alkkagi extends EventEmitter {
  constructor(bots) {
    super();
    this.mode = 'alkkagi';
    this.bots = bots;
    this.order = ['player', ...bots.map(b => b.id)];
    this.phase = 'waiting';
    this.round = 0;
    this.wins = {};
    this.human = { name: '플레이어', active: false, input: {} };
    this.stones = [];
    this.t = 0;
    this.turn = null;
    this.timer = 0;
    this.winner = null;
    this.memory = {};               // botId -> { revenge } 마지막으로 자기 돌을 날린 친구
  }

  setHuman(name) {
    this.human.name = name;
    this.human.active = true;
    if (this.phase === 'waiting') this.startRound();
  }

  removeHuman() {
    this.human.active = false;
    this.phase = 'waiting';
  }

  setInput() {}

  // 판이 끝났거나 내 돌이 다 없어졌으면 새 판
  restart() {
    if (!this.human.active) return;
    if (this.phase === 'intermission' || (this.phase !== 'waiting' && !this.count('player'))) this.startRound();
  }

  alive() { return this.stones.filter(s => s.alive); }
  count(owner) { return this.stones.filter(s => s.alive && s.owner === owner).length; }
  ownersLeft() { return this.order.filter(o => this.count(o) > 0); }
  nameOf(owner) {
    return owner === 'player' ? this.human.name : this.bots.find(b => b.id === owner)?.name ?? owner;
  }

  startRound() {
    this.round += 1;
    this.stones = this.order.flatMap(owner => Array.from({ length: STONES }, (_, i) => ({
      id: `${owner}-${i}`, owner, ...SEATS[owner](i), vx: 0, vy: 0, alive: true,
    })));
    this.t = 0;
    this.winner = null;
    this.memory = {};
    this.turn = null;
    this.emit('event', { type: 'round_start', round: this.round });
    this.nextTurn('player');
  }

  // 다음 차례 (돌이 남은 사람만). first를 주면 그 사람부터
  nextTurn(first = null) {
    const left = this.ownersLeft();
    let who = first;
    if (!who || !left.includes(who)) {
      const i = this.order.indexOf(this.turn);
      who = [...this.order.slice(i + 1), ...this.order.slice(0, i + 1)].find(o => left.includes(o));
    }
    this.turn = who;
    this.phase = 'turn';
    this.turnAt = this.t;
    this.plan = null;
    if (who === 'player') {
      this.timer = TURN_TIME;
    } else {
      const bot = this.bots.find(b => b.id === who);
      this.plan = planShot(this, who, bot.style, { ...this.memory[who], leader: this.leader() });
      this.shootAt = this.t + BOT_THINK;
    }
    this.emit('fx', { type: 'turn', who });
    this.emit('event', { type: 'turn', who, target: this.plan?.target ?? null, left: this.leftSummary() });
  }

  // 심판이 이 봇에게 "쏘기 전에 한마디"를 시켰다 → 목소리가 나올 때까지(최대 BOT_DECLARE_MAX) 기다린다
  waitForDeclare(id) {
    if (this.phase === 'turn' && this.turn === id) this.shootAt = this.turnAt + BOT_DECLARE_MAX;
  }

  // 그 봇의 목소리가 시작됐다 → 잠깐 뒤에 쏜다
  botSpoke(id) {
    if (this.phase === 'turn' && this.turn === id) this.shootAt = Math.min(this.shootAt, this.t + AFTER_SPOKE);
  }

  // 사람: 돌을 뒤로 끈 벡터(dx, dy). 반대 방향으로, 끈 길이만큼 세게 나간다
  humanShot({ stone, dx, dy } = {}) {
    if (this.phase !== 'turn' || this.turn !== 'player') return;
    const len = Math.hypot(dx, dy);
    if (!(len > 8)) return;
    const speed = Math.min(1, len / DRAG_MAX) * MAX_SHOT;
    this.shoot('player', stone, -dx / len * speed, -dy / len * speed);
  }

  shoot(owner, stoneId, vx, vy) {
    const s = this.stones.find(x => x.id === stoneId && x.alive && x.owner === owner);
    if (!s) return;
    s.vx = vx; s.vy = vy;
    this.phase = 'rolling';
    this.rollAt = this.t;
    this.shot = { shooter: owner, stone: s.id, outs: [], contacted: false, before: this.ownersLeft() };
    this.emit('fx', { type: 'flick', power: Math.hypot(vx, vy) / MAX_SHOT });
    this.emit('event', { type: 'shoot', who: owner });
  }

  tick(dt) {
    this.t += dt;
    if (this.phase === 'turn') {
      if (this.turn === 'player') {
        this.timer -= dt;
        if (this.timer <= 0) {
          this.emit('event', { type: 'timeout', who: 'player' });
          this.nextTurn();
        }
      } else if (this.t >= this.shootAt) {
        if (this.plan) this.shoot(this.turn, this.plan.stone, this.plan.vx, this.plan.vy);
        else this.nextTurn();
      }
    } else if (this.phase === 'rolling') {
      for (let i = 0; i < SUBSTEPS; i++) this.simulate(dt / SUBSTEPS);
      const moving = this.alive().some(s => Math.hypot(s.vx, s.vy) > STOP);
      if (!moving || this.t - this.rollAt > 8) this.endShot();
    } else if (this.phase === 'settle' && this.t >= this.settleUntil) {
      this.nextTurn();
    }
  }

  simulate(dt) {
    for (const s of this.alive()) {
      const sp = Math.hypot(s.vx, s.vy);
      if (sp > 0) {
        const k = Math.max(0, sp - DECEL * dt) / sp;
        s.vx *= k; s.vy *= k;
      }
      s.x += s.vx * dt;
      s.y += s.vy * dt;
    }
    const list = this.alive();
    for (let i = 0; i < list.length; i++) {
      for (let j = i + 1; j < list.length; j++) this.collide(list[i], list[j]);
    }
    for (const s of list) {
      if (Math.abs(s.x) > B || Math.abs(s.y) > B) this.fall(s);
    }
  }

  collide(a, b) {
    const dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy);
    if (d >= SR * 2 || d < 1e-4) return;
    const nx = dx / d, ny = dy / d, overlap = SR * 2 - d;
    a.x -= nx * overlap / 2; a.y -= ny * overlap / 2;
    b.x += nx * overlap / 2; b.y += ny * overlap / 2;
    const rel = (a.vx - b.vx) * nx + (a.vy - b.vy) * ny;
    if (rel <= 0) return;
    const imp = (1 + RESTITUTION) * rel / 2;
    a.vx -= imp * nx; a.vy -= imp * ny;
    b.vx += imp * nx; b.vy += imp * ny;
    this.emit('fx', { type: 'clack', power: Math.min(1, rel / MAX_SHOT) });
    // 친 돌이 처음으로 남의 돌을 맞혔을 때
    const shot = this.shot;
    if (shot && !shot.contacted && (a.id === shot.stone || b.id === shot.stone)) {
      const other = a.id === shot.stone ? b : a;
      if (other.owner !== shot.shooter) {
        shot.contacted = true;
        this.emit('event', { type: 'hit', shooter: shot.shooter, victim: other.owner, power: rel / MAX_SHOT });
      }
    }
  }

  fall(s) {
    s.alive = false;
    s.vx = s.vy = 0;
    const self = s.owner === this.shot?.shooter;
    this.shot?.outs.push({ owner: s.owner, self });
    if (!self && this.shot) this.memory[s.owner] = { revenge: this.shot.shooter };
    this.emit('fx', { type: 'fall' });
    this.emit('event', { type: 'stone_out', owner: s.owner, shooter: this.shot?.shooter, self, left: this.count(s.owner) });
  }

  endShot() {
    for (const s of this.alive()) { s.vx = 0; s.vy = 0; }
    const shot = this.shot;
    this.shot = null;
    const outs = shot.outs;
    this.emit('event', {
      type: 'shot_end', shooter: shot.shooter, outs, miss: !shot.contacted && !outs.length,
      selfOut: outs.some(o => o.self), left: this.leftSummary(),
    });
    for (const owner of shot.before) {
      if (!this.count(owner)) this.emit('event', { type: 'eliminated', owner, by: shot.shooter });
    }
    const left = this.ownersLeft();
    if (left.length <= 1) {
      this.winner = left[0] ?? shot.shooter;
      this.wins[this.winner] = (this.wins[this.winner] || 0) + 1;
      this.phase = 'intermission';
      this.turn = null;
      this.emit('fx', { type: 'win' });
      this.emit('event', { type: 'win', winner: this.winner });
      return;
    }
    this.phase = 'settle';
    this.settleUntil = this.t + SETTLE;
  }

  leader() {
    return [...this.ownersLeft()].sort((a, b) => this.count(b) - this.count(a))[0];
  }

  // "도도 3개, 코코 2개, ..." (심판이 봇에게 알려줄 때)
  leftSummary() {
    return this.order.map(o => [o, this.count(o)]).filter(([, n]) => n > 0);
  }

  snapshot() {
    return {
      mode: 'alkkagi',
      phase: this.phase,
      round: this.round,
      wins: this.wins,
      humanName: this.human.name,
      turn: this.turn,
      timer: this.timer,
      winner: this.winner,
      counts: Object.fromEntries(this.order.map(o => [o, this.count(o)])),
      stones: this.stones.map(s => ({
        id: s.id, owner: s.owner, alive: s.alive, x: Math.round(s.x * 10) / 10, y: Math.round(s.y * 10) / 10,
      })),
    };
  }
}
