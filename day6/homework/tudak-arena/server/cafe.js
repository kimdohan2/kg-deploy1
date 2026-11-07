// 투닥 카페 게임 엔진 — 도도가 사장, 코코·러비·루가 차례로 손님으로 와서 주문한다.
// 서버가 손님 순서·주문·시간·채점을 정하고, 화면은 상태만 받아 그린다. 컵에 담는 건 화면에서 하고 "내기"로 보낸다.
//   코코: 가끔 만드는 도중에 주문을 바꾼다 / 러비: 꼭 하나를 더 얹어 달라고 한다 / 루: 두 번째로 오면 가끔 "아까 그거"라고만 한다
import { EventEmitter } from 'node:events';

export const INGREDIENTS = [
  { id: 'espresso', name: '에스프레소', color: '#6b3e26' },
  { id: 'water', name: '물', color: '#8fd3ff' },
  { id: 'milk', name: '우유', color: '#f5f1e6' },
  { id: 'ice', name: '얼음', color: '#c9f0ff' },
  { id: 'vanilla', name: '바닐라', color: '#f3dd8a' },
  { id: 'choco', name: '초코', color: '#5a3320' },
  { id: 'strawberry', name: '딸기', color: '#ff6f91' },
  { id: 'whip', name: '휘핑크림', color: '#fffaf0' },
];

export const MENU = [
  { id: 'americano', name: '아메리카노', items: ['espresso', 'water'] },
  { id: 'iced_americano', name: '아이스 아메리카노', items: ['espresso', 'water', 'ice'] },
  { id: 'latte', name: '라떼', items: ['espresso', 'milk'] },
  { id: 'vanilla_latte', name: '바닐라 라떼', items: ['espresso', 'milk', 'vanilla'] },
  { id: 'choco_latte', name: '초코 라떼', items: ['choco', 'milk'] },
  { id: 'strawberry_milk', name: '딸기 우유', items: ['strawberry', 'milk'] },
  { id: 'mocha', name: '모카', items: ['espresso', 'choco', 'milk', 'whip'] },
];

const LOVEY_EXTRAS = ['whip', 'ice', 'vanilla'];
const VISITS_EACH = 2;          // 하루에 한 손님이 오는 횟수
const ENTER = 1.2;              // 걸어 들어오는 시간
const LEAVE = 4;                // 음료 받고 반응한 뒤 나가는 시간
const GAP = 1;                  // 다음 손님까지
const PATIENCE = 35;            // 주문표가 보이고 나서 기다리는 시간
const REVEAL_FALLBACK = 1.2;    // 목소리 없이 할 때 주문표가 뜨는 시간
const REVEAL_VOICE_MAX = 8;     // 목소리를 기다릴 때 최대
const AFTER_VOICE = 0.4;        // 목소리가 시작되고 이만큼 뒤에 주문표
const FAST = 10, SLOW = 25;     // 빠름·느림 기준 (초)

const pick = arr => arr[Math.floor(Math.random() * arr.length)];
const rand = (a, b) => a + Math.random() * (b - a);
const nameOfItem = id => INGREDIENTS.find(i => i.id === id)?.name ?? id;
export const drinkName = id => MENU.find(m => m.id === id)?.name ?? id;

export class Cafe extends EventEmitter {
  constructor(bots) {
    super();
    this.mode = 'cafe';
    this.bots = bots;
    this.phase = 'waiting';        // waiting | open | closed
    this.round = 0;                // 몇째 날
    this.wins = {};                // 오늘 만족한 손님 수 (봇별) + player: 오늘 팁
    this.human = { name: '플레이어', active: false };
    this.t = 0;
    this.queue = [];
    this.guest = null;
    this.served = 0;
    this.tips = 0;
    this.log = [];                 // 오늘 손님 기록 { who, ok }
    this.lastDrink = {};           // 손님이 마지막으로 마신 음료 (루의 "아까 그거")
  }

  setHuman(name) {
    this.human.name = name;
    this.human.active = true;
    if (this.phase === 'waiting') this.openDay();
  }

  removeHuman() {
    this.human.active = false;
    this.phase = 'waiting';
    this.guest = null;
  }

  setInput() {}

  restart() {
    if (this.human.active && this.phase === 'closed') this.openDay();
  }

  openDay() {
    this.round += 1;
    this.phase = 'open';
    this.t = 0;
    this.tips = 0;
    this.served = 0;
    this.log = [];
    this.lastDrink = {};
    this.wins = { player: 0 };
    for (const b of this.bots) this.wins[b.id] = 0;
    this.queue = this.makeQueue();
    this.guest = null;
    this.nextAt = 0.6;
    this.emit('event', { type: 'day_start', day: this.round });
  }

  // 같은 손님이 연달아 오지 않게 섞는다
  makeQueue() {
    const ids = this.bots.map(b => b.id);
    for (let tries = 0; tries < 50; tries++) {
      const q = ids.flatMap(id => Array(VISITS_EACH).fill(id)).sort(() => Math.random() - 0.5);
      if (q.every((id, i) => i === 0 || q[i - 1] !== id)) return q;
    }
    return Array.from({ length: VISITS_EACH }, () => ids).flat();
  }

  makeOrder(who) {
    const drink = pick(MENU);
    const order = { drink: drink.id, extra: null, again: false, change: null };
    if (who === 'lovey') {
      const options = LOVEY_EXTRAS.filter(x => !drink.items.includes(x));
      order.extra = pick(options);
    } else if (who === 'rou' && this.lastDrink.rou && Math.random() < 0.75) {
      order.drink = this.lastDrink.rou;
      order.again = true;
    } else if (who === 'coco' && Math.random() < 0.5) {
      order.change = { to: pick(MENU.filter(m => m.id !== drink.id)).id, at: null, done: false };
    }
    return order;
  }

  wanted(order) {
    const items = new Set(MENU.find(m => m.id === order.drink).items);
    if (order.extra) items.add(order.extra);
    return items;
  }

  // 손님 입장 → 주문
  nextGuest() {
    const who = this.queue.shift();
    if (!who) return this.closeDay();
    this.guest = { who, step: 'enter', at: this.t, order: this.makeOrder(who), revealed: false, ticket: null, changedAt: null };
  }

  // 목소리로 말할 거면 주문표를 그때까지 기다린다 (심판이 부름)
  waitForVoice(who) {
    const g = this.guest;
    if (g && g.who === who && !g.revealed) g.revealAt = this.t + REVEAL_VOICE_MAX;
    if (g && g.who === who && g.order.change?.done && !g.changeShown) g.changeShowAt = this.t + REVEAL_VOICE_MAX;
  }

  // 그 손님 목소리가 나오기 시작함
  botSpoke(who) {
    const g = this.guest;
    if (!g || g.who !== who) return;
    if (!g.revealed) g.revealAt = Math.min(g.revealAt, this.t + AFTER_VOICE);
    else if (g.order.change?.done && !g.changeShown) g.changeShowAt = Math.min(g.changeShowAt, this.t + AFTER_VOICE);
  }

  reveal() {
    const g = this.guest;
    g.revealed = true;
    g.step = 'waiting';
    g.since = this.t;
    g.deadline = this.t + PATIENCE;
    g.ticket = this.ticketOf(g.order);
    if (g.order.change) g.order.change.at = this.t + rand(4, 7);
    this.emit('fx', { type: 'ticket' });
  }

  ticketOf(order) {
    if (order.again) return { title: '아까 그거', extra: null, again: true };
    return { title: drinkName(order.drink), extra: order.extra ? nameOfItem(order.extra) : null, again: false };
  }

  serve(items = []) {
    const g = this.guest;
    if (this.phase !== 'open' || !g || g.step !== 'waiting') return;
    const cup = new Set(items.filter(i => INGREDIENTS.some(x => x.id === i)));
    const want = this.wanted(g.order);
    const missing = [...want].filter(i => !cup.has(i)).map(nameOfItem);
    const extra = [...cup].filter(i => !want.has(i)).map(nameOfItem);
    const ok = !missing.length && !extra.length;
    const secs = Math.round(this.t - g.since);
    let tip = 0;
    if (ok) {
      tip = 1000 + Math.max(0, SLOW - secs) * 100;
      if (g.order.again || g.order.extra || g.order.change?.done) tip += 500;
      tip = Math.round(tip / 100) * 100;
      this.wins[g.who] += 1;
    }
    this.tips += tip;
    this.wins.player = this.tips;
    this.served += 1;
    this.log.push({ who: g.who, ok });
    this.lastDrink[g.who] = g.order.drink;
    g.step = 'leaving';
    g.at = this.t;
    g.result = { ok, tip, secs, timeout: false };
    this.emit('fx', { type: ok ? 'good' : 'bad' });
    this.emit('event', {
      type: 'served', who: g.who, ok, tip, secs, missing, extra,
      fast: secs <= FAST, slow: secs >= SLOW,
      drink: drinkName(g.order.drink), again: g.order.again, hadExtra: !!g.order.extra, changed: !!g.order.change?.done,
    });
  }

  timeout() {
    const g = this.guest;
    this.served += 1;
    this.log.push({ who: g.who, ok: false });
    this.lastDrink[g.who] = g.order.drink;
    g.step = 'leaving';
    g.at = this.t;
    g.result = { ok: false, tip: 0, secs: PATIENCE, timeout: true };
    this.emit('fx', { type: 'bad' });
    this.emit('event', { type: 'timeout', who: g.who });
  }

  closeDay() {
    this.phase = 'closed';
    this.guest = null;
    this.emit('fx', { type: 'win' });
    this.emit('event', { type: 'day_end', day: this.round, tips: this.tips, log: this.log });
  }

  tick(dt) {
    if (this.phase !== 'open' || !this.human.active) return;
    this.t += dt;
    const g = this.guest;
    if (!g) {
      if (this.t >= this.nextAt) this.nextGuest();
      return;
    }
    if (g.step === 'enter' && this.t - g.at >= ENTER) {
      g.step = 'ordering';
      g.revealAt = this.t + REVEAL_FALLBACK;
      const o = g.order;
      this.emit('event', {
        type: 'order', who: g.who, drink: drinkName(o.drink),
        extra: o.extra ? nameOfItem(o.extra) : null, again: o.again,
      });
    } else if (g.step === 'ordering' && this.t >= g.revealAt) {
      this.reveal();
    } else if (g.step === 'waiting') {
      const ch = g.order.change;
      if (ch && !ch.done && this.t >= ch.at) {
        const from = drinkName(g.order.drink);
        g.order.drink = ch.to;
        ch.done = true;
        g.changeShowAt = this.t + REVEAL_FALLBACK;
        g.deadline += 8;    // 바꾼 만큼 조금 더 기다려 준다
        this.emit('event', { type: 'change', who: g.who, from, to: drinkName(ch.to) });
      }
      if (ch?.done && !g.changeShown && this.t >= g.changeShowAt) {
        g.changeShown = true;
        g.ticket = { ...this.ticketOf(g.order), changed: true };
        this.emit('fx', { type: 'ticket' });
      }
      if (this.t >= g.deadline) this.timeout();
    } else if (g.step === 'leaving' && this.t - g.at >= LEAVE) {
      this.guest = null;
      this.nextAt = this.t + GAP;
    }
  }

  snapshot() {
    const g = this.guest;
    return {
      mode: 'cafe',
      phase: this.phase,
      round: this.round,
      wins: this.wins,
      humanName: this.human.name,
      t: this.t,
      tips: this.tips,
      served: this.served,
      total: this.bots.length * VISITS_EACH,
      log: this.log,
      guest: g && {
        who: g.who, step: g.step, since: this.t - g.at,
        ticket: g.revealed ? g.ticket : null,
        left: g.step === 'waiting' ? Math.max(0, g.deadline - this.t) : null,
        patience: PATIENCE,
        result: g.result ?? null,
      },
    };
  }
}
