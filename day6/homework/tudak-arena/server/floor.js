// 음성방 "말하는 차례". 봇 셋(각자 다른 Hermes)이 목소리를 내기 전에 여기서 차례를 받고, 다 말하면 돌려준다.
// 그래서 봇들은 앞 친구가 말하는 동안 다음 말을 미리 준비하고, 목소리는 한 명씩 이어서 나온다.
//   speak(bot): 그 봇이 말하기 시작함   done(bot): 말을 끝냄
import { EventEmitter } from 'node:events';

export class VoiceFloor extends EventEmitter {
  constructor({ gapMs = 250, waitMaxMs = 8000, holdMaxMs = 20000 } = {}) {
    super();
    this.gapMs = gapMs;           // 앞사람이 끝나고 다음 사람이 말하기까지 쉬는 시간
    this.waitMaxMs = waitMaxMs;   // 이보다 오래 기다린 말은 지난 얘기라 버린다
    this.holdMaxMs = holdMaxMs;   // 봇이 꺼져서 돌려주지 못해도 이 시간 뒤엔 풀린다
    this.holder = null;           // { bot, at }
    this.queue = [];              // [{ bot, resolve, timer }]
    this.freeAt = 0;
    this.timer = null;
  }

  get speaking() { return this.holder?.bot ?? null; }
  get waiting() { return this.queue.length; }

  // priority: 즉시 감탄사는 줄 맨 앞에 선다 (말하는 사람을 끊지는 않음). waitMaxMs: 이 말만 따로 정한 대기 한도
  acquire(bot, { priority = false, waitMaxMs = this.waitMaxMs } = {}) {
    return new Promise(resolve => {
      const item = { bot, resolve, priority };
      item.timer = setTimeout(() => {
        this.queue = this.queue.filter(q => q !== item);
        resolve(false);
      }, waitMaxMs);
      // 감탄사끼리는 먼저 온 순서대로, 일반 대사보다는 앞에
      const at = priority ? this.queue.findIndex(q => !q.priority) : -1;
      if (at >= 0) this.queue.splice(at, 0, item);
      else this.queue.push(item);
      this.next();
    });
  }

  release(bot) {
    if (this.holder?.bot !== bot) return;
    this.holder = null;
    this.freeAt = Date.now() + this.gapMs;
    this.emit('done', bot);
    this.next();
  }

  next() {
    const now = Date.now();
    if (this.holder && now - this.holder.at > this.holdMaxMs) this.release(this.holder.bot);
    if (this.holder || !this.queue.length) return;
    if (now < this.freeAt) {
      clearTimeout(this.timer);
      this.timer = setTimeout(() => this.next(), this.freeAt - now);
      return;
    }
    const item = this.queue.shift();
    clearTimeout(item.timer);
    this.holder = { bot: item.bot, at: now };
    item.resolve(true);
    this.emit('speak', item.bot, item.priority);   // priority = 감탄사
  }
}
