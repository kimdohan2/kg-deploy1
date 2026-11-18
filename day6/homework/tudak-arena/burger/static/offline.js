// Show me the burger 정적 배포용 — 게임 서버(socket.io) 대신 브라우저 안에서 서버 일을 한다.
//   npm run burger-static이 index.html의 socket.io 자리에 이 파일을 넣는다. 게임 화면(burger.js)은 그대로 쓴다.
//   하는 일은 server/burger.js의 BurgerShop과 같다: 손님 3팀 고르기 → 주문 시작 → 다시 듣기 1번 → 채점.
//   주문 완료 한마디는 Hermes 대신 미리 만든 목소리(npm run burger-reactions). 디스코드 되묻기·감탄사는 없다.
//   곡 목록·순서·한마디 대사는 빌드가 data/shop.json에 넣는다(서버 코드에서 그대로 가져옴).
(() => {
  const handlers = {};
  const fire = (ev, data) => { for (const f of handlers[ev] || []) f(data); };
  const pick = arr => arr[Math.floor(Math.random() * arr.length)];

  const ready = Promise.all([
    fetch('data/shop.json').then(r => r.json()),
    fetch('data/menu.json').then(r => r.json()),
  ]).then(([shop, menu]) => ({
    ...shop,
    byKey: new Map(Object.values(menu).flat().flatMap(m => [[m.id, m], [m.name, m]])),
  }));

  let sh = null;   // 이번 판: { songs, i, results, cur }

  // 손님 3팀 고르기: 보통 1 → 어려움 2, 한 판 안에서 같은 곡 없음, 바로 앞 손님과 같은 얼굴 조합은 되도록 피함
  function pickSongs({ songs, teams, levels }) {
    const out = [];
    for (let i = 0; i < teams; i++) {
      const level = levels[i] || '어려움';
      const unused = songs.filter(s => !out.includes(s));
      let pool = unused.filter(s => s.level === level);
      const prev = out[out.length - 1]?.customers.join();
      const fresh = pool.filter(s => s.customers.join() !== prev);
      if (fresh.length) pool = fresh;
      out.push(pick(pool.length ? pool : unused));
    }
    return out;
  }

  // [{item, qty}] → Map(id → 개수). 메뉴에 없는 건 버린다. (server/burger-talk.js의 compare와 같음)
  function count(list, byKey) {
    const out = new Map();
    for (const o of Array.isArray(list) ? list.slice(0, 20) : []) {
      const m = byKey.get(String(o?.item));
      const q = Math.max(0, Math.min(9, Math.floor(Number(o?.qty) || 0)));
      if (m && q) out.set(m.id, (out.get(m.id) || 0) + q);
    }
    return out;
  }
  function compare(answer, entered, byKey) {
    const want = count(answer, byKey), got = count(entered, byKey);
    const missing = [], wrong = [], extra = [];
    for (const [id, q] of want) {
      const g = got.get(id) || 0;
      if (!g) missing.push(byKey.get(id).name);
      else if (g !== q) wrong.push(`${byKey.get(id).name}(${q}개인데 ${g}개)`);
    }
    for (const id of got.keys()) if (!want.has(id)) extra.push(byKey.get(id).name);
    const list = m => [...m].map(([item, qty]) => ({ item, qty }));
    return { ok: !missing.length && !wrong.length && !extra.length, missing, wrong, extra, want: list(want), got: list(got) };
  }

  // 주문 완료 한마디: 첫 손님이 미리 만든 목소리로 (영수증이 뜬 뒤 잠깐 있다가). 목소리를 못 받으면 말풍선만.
  function react(d, customers, verdict) {
    const who = customers[0];
    const line = d.reactions[who]?.[verdict];
    if (!line) return null;
    setTimeout(async () => {
      let audio = null;
      if (line.file) try { const r = await fetch(line.file); if (r.ok) audio = await r.arrayBuffer(); } catch {}
      fire('burger_voice', { who, text: line.text, audio });
    }, 600);
    return who;
  }

  const on = {
    async burger_start() {
      const d = await ready;
      sh = { songs: pickSongs(d), i: -1, results: [], cur: null };
      return on.burger_next();
    },
    async burger_next() {
      const d = await ready;
      if (!sh || (sh.cur && !sh.cur.done)) return null;
      sh.i++;
      if (sh.i >= d.teams) { sh.cur = null; return { type: 'end', results: sh.results }; }
      const s = sh.songs[sh.i];
      sh.cur = { song: s, replays: 0, started: false, done: false };
      return {
        type: 'customer', n: sh.i + 1, of: d.teams,
        song: {
          id: s.id, customers: s.customers, genre: s.genre, level: s.level, bpm: s.bpm,
          audio: `songs/${s.id}.mp3`,
          parts: s.parts.map(p => ({ who: p.who, ms: p.ms, vocal: p.lines.length > 0 })),
        },
      };
    },
    burger_play() {
      const cur = sh?.cur;
      if (!cur || cur.done || cur.started) return { ok: false };
      cur.started = true;
      return { ok: true };
    },
    burger_replay() {
      const cur = sh?.cur;
      if (!cur || cur.done || !cur.started || cur.replays >= 1) return { ok: false };
      cur.replays++;
      return { ok: true };
    },
    async burger_submit({ entered } = {}) {
      const d = await ready;
      const cur = sh?.cur;
      if (!cur || cur.done) return null;
      cur.done = true;
      const s = cur.song;
      const r = compare(s.order, entered, d.byKey);
      const verdict = !r.ok ? 'wrong' : cur.replays ? 'close' : 'perfect';
      sh.results.push({ customers: s.customers, level: s.level, verdict });
      return {
        verdict, speaker: react(d, s.customers, verdict), last: sh.i + 1 >= d.teams,
        answer: r.want, entered: r.got, missing: r.missing, wrong: r.wrong, extra: r.extra,
        decoys: s.decoys, lyrics: s.parts.filter(p => p.lines.length).map(p => ({ who: p.who, part: p.part, lines: p.lines })),
      };
    },
  };

  const socket = {
    on(ev, f) { (handlers[ev] ||= []).push(f); },
    // 서버가 없는 이벤트(랩 끝 감탄사·재촉)는 조용히 넘긴다
    emit(ev, data, ack) {
      Promise.resolve().then(() => on[ev]?.(data)).then(r => ack?.(r ?? null), e => { console.error(ev, e); ack?.(null); });
    },
  };
  window.io = () => socket;
  setTimeout(() => fire('connect'));
})();
