// 즉시 감탄사. 게임 사건이 나면 그 봇에게 미리 만든 짧은 소리(npm run clips)를 보낸다.
// 봇(Hermes 패치)은 /clips/next로 기다리고 있다가 받자마자 차례 맨 앞에서 튼다. Claude를 거치지 않아 0.5초 안팎.
import { existsSync, readFileSync } from 'node:fs';

export class ClipBoard {
  constructor({ root, cooldownMs = 1500, freshMs = 1500, waitMs = 20000 }) {
    const path = `${root}clips/manifest.json`;
    const manifest = existsSync(path) ? JSON.parse(readFileSync(path, 'utf8')) : {};
    this.clips = manifest.bots || {};
    // 웹 말풍선에 띄울 글 (감정 표시는 뺌)
    this.texts = Object.fromEntries(Object.entries(manifest.files || {})
      .map(([file, m]) => [file, m.text.replace(/\[[a-z ]+\]\s*/gi, '').trim()]));
    this.cooldownMs = cooldownMs;   // 한 봇이 감탄사를 너무 연달아 내지 않게
    this.freshMs = freshMs;         // 이보다 오래 못 보낸 감탄사는 늦은 반응이라 버린다
    this.waitMs = waitMs;           // 봇이 한 번 기다리는 최대 시간 (그 뒤 다시 물어봄)
    this.pending = new Map();       // bot -> { clip, at }
    this.waiters = new Map();       // bot -> 기다리는 요청의 답 함수
    this.last = new Map();          // bot -> { clip, at } (같은 소리 연달아 피하기)
    const n = Object.values(this.clips).reduce((s, k) => s + Object.values(k).flat().length, 0);
    console.log(n ? `[감탄사] ${n}개 준비됨` : '[감탄사] 없음 (npm run clips로 만들 수 있어요)');
  }

  // bot이 kind 상황의 감탄사를 낸다. 낸 감탄사의 글을 돌려주고, 낼 게 없거나 방금 냈으면 null.
  play(bot, kind) {
    const list = (this.clips[bot]?.[kind] || []).filter(existsSync);
    const now = Date.now();
    const prev = this.last.get(bot);
    if (!list.length || (prev && now - prev.at < this.cooldownMs)) return null;
    const choices = list.length > 1 ? list.filter(c => c !== prev?.clip) : list;
    const clip = choices[Math.floor(Math.random() * choices.length)];
    this.last.set(bot, { clip, at: now });
    const waiter = this.waiters.get(bot);
    if (waiter) {
      this.waiters.delete(bot);
      waiter({ clip });
    } else {
      this.pending.set(bot, { clip, at: now });
    }
    return this.texts[clip] || '';
  }

  // 봇이 "내 감탄사 있어?" 하고 기다린다. 있으면 바로, 없으면 생길 때까지(최대 waitMs) 기다렸다 답한다.
  next(bot) {
    const p = this.pending.get(bot);
    this.pending.delete(bot);
    if (p && Date.now() - p.at < this.freshMs) return Promise.resolve({ clip: p.clip });
    this.waiters.get(bot)?.({});   // 같은 봇의 예전 기다림은 끝낸다
    return new Promise(resolve => {
      const timer = setTimeout(() => {
        if (this.waiters.get(bot) === done) this.waiters.delete(bot);
        resolve({});
      }, this.waitMs);
      const done = result => { clearTimeout(timer); resolve(result); };
      this.waiters.set(bot, done);
    });
  }
}
