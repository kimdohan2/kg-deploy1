// Show me the burger — 손님(봇)이 랩으로 주문하면 플레이어가 들으면서 포스기로 찍는 게임.
// 사이트에 들어온 사람(소켓)마다 따로 한 판(손님 3팀)을 진행한다.
// 정답(주문·가사)은 서버만 갖고 있다가 주문 완료 뒤에 알려 준다.
// 랩이 끝난 뒤에는 시간 제한이 없고, 디스코드(음성·채팅)에서 손님에게 주문을 3번까지 되물을 수 있다.
import { existsSync, readFileSync } from 'node:fs';

export const TEAMS = 3;          // 한 판 손님 수
export const MAX_ASKS = 3;       // 손님마다 디스코드로 되물을 수 있는 횟수
const LEVELS = ['보통', '어려움', '어려움'];   // 한 판 손님 순서: 보통으로 몸 풀고 어려움 둘
const HURRY_RATE = 0.2;          // 랩이 끝나고 한참 안 찍을 때 재촉 한마디가 나올 확률 (손님마다)
const BPM = { '하이퍼 트랩': 155, '파티 트랩': 160, '펑키 힙합': 118, '트랩': 140, '붐뱁': 90, '드릴 배틀': 142, '파티 배틀': 150, '하이퍼 + 붐뱁': 110, '붐뱁 + 하이퍼': 110 };

const pick = arr => arr[Math.floor(Math.random() * arr.length)];
const NAMES = { coco: ['코코'], lovey: ['러비'], rou: ['루', 'Rou', '로우'] };   // 디스코드에서 손님을 부를 때

export class BurgerShop {
  constructor({ root, talk }) {
    // 음악(mp3)을 아직 안 만든 곡은 빼고 고른다 (가사만 먼저 써 둔 곡)
    this.songs = JSON.parse(readFileSync(`${root}burger/songs.json`, 'utf8')).songs
      .filter(s => existsSync(`${root}public/burger/songs/${s.id}.mp3`));
    this.talk = talk;
    this.shifts = new Map();   // 소켓 id → 한 판
  }

  // 손님 3팀 고르기: 보통 1 → 어려움 2, 한 판 안에서 같은 곡 없음, 바로 앞 손님과 같은 얼굴 조합은 되도록 피함
  pickSongs() {
    const out = [];
    for (let i = 0; i < TEAMS; i++) {
      const level = LEVELS[i] || '어려움';
      const unused = this.songs.filter(s => !out.includes(s));
      let pool = unused.filter(s => s.level === level);
      const prev = out[out.length - 1]?.customers.join();
      const fresh = pool.filter(s => s.customers.join() !== prev);
      if (fresh.length) pool = fresh;
      out.push(pick(pool.length ? pool : unused));
    }
    return out;
  }

  start(sid) {
    this.shifts.set(sid, { songs: this.pickSongs(), i: -1, results: [], cur: null });
    return this.next(sid);
  }

  // 다음 손님 (끝났으면 결과)
  next(sid) {
    const sh = this.shifts.get(sid);
    if (!sh) return null;
    if (sh.cur && !sh.cur.done) return null;   // 아직 주문 완료 전
    sh.i++;
    if (sh.i >= TEAMS) {
      sh.cur = null;
      return { type: 'end', results: sh.results };
    }
    const s = sh.songs[sh.i];
    sh.cur = { song: s, replays: 0, asks: 0, waiting: false, started: false, rapEnded: false, done: false };
    return {
      type: 'customer', n: sh.i + 1, of: TEAMS, maxAsks: MAX_ASKS,
      song: {
        id: s.id, customers: s.customers, genre: s.genre, level: s.level, bpm: s.bpm || BPM[s.genre] || 120,
        audio: `songs/${s.id}.mp3`,
        parts: s.parts.map(p => ({ who: p.who, ms: p.ms, vocal: p.lines.length > 0 })),   // 가사는 안 보냄
      },
    };
  }

  // 주문 시작 (랩 틀기)
  play(sid) {
    const cur = this.shifts.get(sid)?.cur;
    if (!cur || cur.done || cur.started) return { ok: false };
    cur.started = true;
    cur.startedAt = Date.now();
    return { ok: true };
  }

  // 다시 듣기: 손님마다 1번 (다시 듣고 맞히면 아슬아슬)
  replay(sid) {
    const cur = this.shifts.get(sid)?.cur;
    if (!cur || cur.done || !cur.started || cur.replays >= 1) return { ok: false };
    cur.replays++;
    return { ok: true };
  }

  // 주문 완료 → 채점하고 손님 봇이 한마디 (onLine: 대사·목소리가 준비되면 그 사람 화면으로)
  submit(sid, { entered } = {}, onLine = () => {}) {
    const sh = this.shifts.get(sid);
    const cur = sh?.cur;
    if (!cur || cur.done) return null;
    cur.done = true;
    const s = cur.song;
    const r = this.talk.compare(s.order, entered);
    const verdict = !r.ok ? 'wrong' : cur.replays ? 'close' : 'perfect';
    sh.results.push({ customers: s.customers, level: s.level, verdict });
    const { speaker } = this.talk.react({ customers: s.customers, verdict, ...r, onLine });
    return {
      verdict, speaker, last: sh.i + 1 >= TEAMS,
      answer: r.want, entered: r.got, missing: r.missing, wrong: r.wrong, extra: r.extra,
      decoys: s.decoys, lyrics: s.parts.filter(p => p.lines.length).map(p => ({ who: p.who, part: p.part, lines: p.lines })),
    };
  }

  // 랩(주문)이 처음 끝났을 때: 이때부터 되묻기 가능. "주문 끝" 소리를 낼 봇을 돌려준다 (다시 듣기 뒤에는 안 함)
  rapEnd(sid) {
    const cur = this.shifts.get(sid)?.cur;
    if (!cur || cur.done || !cur.started || cur.rapEnded) return null;
    cur.rapEnded = true;
    return cur.song.customers[cur.song.customers.length - 1];   // 둘이면 후렴을 부른 사람
  }

  // 랩이 끝나고 한참(화면이 정함) 안 찍으면: 손님마다 한 번, 20% 확률로 재촉 한마디를 낼 봇 (안 내면 null)
  hurry(sid) {
    const cur = this.shifts.get(sid)?.cur;
    if (!cur || cur.done || !cur.rapEnded || cur.hurried || cur.waiting) return null;
    cur.hurried = true;
    if (Math.random() >= HURRY_RATE) return null;
    return cur.song.customers[0];
  }

  // 디스코드에서 사람이 한 말(음성)이나 글(채팅): 지금 랩 주문을 받는 손님이 있으면 그 손님에게 되묻는 말로 가져간다.
  // 봇 3명이 같은 말을 각자 물어 오므로 10초 안의 같은 말은 한 번만 처리 (같은 결과 객체를 돌려줌).
  // 돌려줌: null(게임과 상관없음 → 봇들이 평소처럼 대답) /
  //   { sid, early }(랩 듣는 중) · { sid, busy }(앞 질문에 대답하는 중) · { sid, again }(3번 다 씀) → 아무도 대답 안 함
  //   { sid, who, song, left }(새로 물어봄 → 손님이 대답)
  voiceAsk(speech) {
    const now = Date.now();
    this.heard = (this.heard || []).filter(h => now - h.at < 10000);
    const seen = this.heard.find(h => h.speech === speech);
    if (seen) return seen.result;
    let best = null;
    for (const [sid, sh] of this.shifts) {
      const cur = sh.cur;
      if (cur && cur.started && !cur.done && (!best || cur.startedAt > best.cur.startedAt)) best = { sid, cur };
    }
    let result = null;
    if (best) {
      const { sid, cur } = best;
      const named = cur.song.customers.find(id => (NAMES[id] || []).some(n => speech.includes(n)));
      if (!cur.rapEnded) result = { sid, early: true };
      else if (cur.waiting) result = { sid, busy: true };
      else if (cur.asks >= MAX_ASKS) result = { sid, again: true };
      else {
        cur.asks++;
        cur.waiting = true;
        result = { sid, who: named || cur.song.customers[0], song: cur.song, left: MAX_ASKS - cur.asks };
      }
    }
    this.heard.push({ speech, at: now, result });
    return result;
  }

  // 손님이 되묻기에 대답을 끝냄 → 다음 질문 받을 수 있음. 남은 횟수를 돌려준다.
  answered(sid) {
    const cur = this.shifts.get(sid)?.cur;
    if (!cur) return 0;
    cur.waiting = false;
    return MAX_ASKS - cur.asks;
  }

  leave(sid) { this.shifts.delete(sid); }
}
