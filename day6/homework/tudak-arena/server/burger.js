// Show me the burger — 손님(봇)이 랩으로 주문하면 플레이어가 들으면서 포스기로 찍는 게임.
// 사이트에 들어온 사람(소켓)마다 따로 한 판(손님 3팀)을 진행한다.
// 정답(주문·가사)은 서버만 갖고 있다가 주문 완료 뒤에 알려 준다.
import { readFileSync } from 'node:fs';

export const TEAMS = 3;          // 한 판 손님 수
const HARD_RATE = 0.4;           // 보통 60 · 어려움 40
export const AFTER_SEC = 15;     // 랩이 끝나고 주문 완료까지
const SLACK_SEC = 5;             // 손님 들어오는 시간·네트워크 여유
const BPM = { '하이퍼 트랩': 155, '트랩': 140, '붐뱁': 90, '드릴 배틀': 142, '하이퍼 + 붐뱁': 110, '붐뱁 + 하이퍼': 110 };

const pick = arr => arr[Math.floor(Math.random() * arr.length)];

export class BurgerShop {
  constructor({ root, talk }) {
    this.songs = JSON.parse(readFileSync(`${root}burger/songs.json`, 'utf8')).songs;
    this.talk = talk;
    this.shifts = new Map();   // 소켓 id → 한 판
  }

  // 손님 3팀 고르기: 팀마다 40% 확률로 어려움, 한 판 안에서 같은 곡 없음, 바로 앞 손님과 같은 얼굴 조합은 되도록 피함
  pickSongs() {
    const out = [];
    for (let i = 0; i < TEAMS; i++) {
      const level = Math.random() < HARD_RATE ? '어려움' : '보통';
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
    const sec = s.parts.reduce((a, p) => a + p.ms, 0) / 1000;
    sh.cur = { song: s, sec, replays: 0, deadline: Date.now() + (sec + AFTER_SEC + SLACK_SEC) * 1000, done: false };
    return {
      type: 'customer', n: sh.i + 1, of: TEAMS, afterSec: AFTER_SEC,
      song: {
        id: s.id, customers: s.customers, genre: s.genre, level: s.level, bpm: BPM[s.genre] || 120,
        audio: `songs/${s.id}.mp3`,
        parts: s.parts.map(p => ({ who: p.who, ms: p.ms, vocal: p.lines.length > 0 })),   // 가사는 안 보냄
      },
    };
  }

  // 다시 듣기: 손님마다 1번. 듣는 동안과 그 뒤 15초만큼 시간을 늘려 준다.
  replay(sid) {
    const cur = this.shifts.get(sid)?.cur;
    if (!cur || cur.done || cur.replays >= 1) return { ok: false };
    cur.replays++;
    cur.deadline = Date.now() + (cur.sec + AFTER_SEC + SLACK_SEC) * 1000;
    return { ok: true };
  }

  // 주문 완료 → 채점하고 손님 봇이 한마디
  submit(sid, { entered, timeout } = {}) {
    const sh = this.shifts.get(sid);
    const cur = sh?.cur;
    if (!cur || cur.done) return null;
    cur.done = true;
    const s = cur.song;
    const r = this.talk.compare(s.order, entered);
    const late = !!timeout || Date.now() > cur.deadline;
    const verdict = late ? 'timeout' : !r.ok ? 'wrong' : cur.replays ? 'close' : 'perfect';
    sh.results.push({ customers: s.customers, level: s.level, verdict });
    const spoken = this.talk.react({ customers: s.customers, verdict, ...r });
    return {
      verdict, spoken, last: sh.i + 1 >= TEAMS,
      answer: r.want, entered: r.got, missing: r.missing, wrong: r.wrong, extra: r.extra,
      decoys: s.decoys, lyrics: s.parts.filter(p => p.lines.length).map(p => ({ who: p.who, part: p.part, lines: p.lines })),
    };
  }

  leave(sid) { this.shifts.delete(sid); }
}
