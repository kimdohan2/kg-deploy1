// Show me the burger 수다 — 포스기에서 "주문 완료"를 누르면 손님 봇이 Hermes로 디스코드에서 한마디 한다.
//   완벽: 기뻐함 / 아슬아슬(다시 듣고 맞힘): 놀리듯 / 틀림: 뭐가 틀렸는지 집어서 따짐 / 시간 초과: 기다리다 지쳐서 나감
//   한마디는 짧게(12자 안팎), 손님이 둘이어도 첫 손님 한 명만. 화면은 그 목소리가 끝날 때까지 다음 손님을 막는다.
// 디스코드가 없거나 봇 수다를 끄면 정해 둔 짧은 대사를 말풍선으로만 띄운다.
import { readFileSync } from 'node:fs';

const FALLBACK = {
  perfect: { coco: '완벽해애!', lovey: '역시 잘하네.', rou: '타이밍 완벽!' },
  close: { coco: '두 번 들었지? 헤헷.', lovey: '이번만 봐준다.', rou: '한 번 되감았네?' },
  wrong: { coco: '이거 아닌데에!', lovey: '틀렸잖아.', rou: '어라, 틀렸네?' },
  timeout: { coco: '심심해! 간다!', lovey: '나 간다.', rou: '늦었어, 간다!' },
};

export function attachBurger({ referee, root }) {
  const menu = JSON.parse(readFileSync(`${root}burger/menu.json`, 'utf8'));
  const items = Object.values(menu).flat();
  const byKey = new Map(items.flatMap(m => [[m.id, m], [m.name, m]]));   // id나 메뉴 이름 둘 다 받음
  const botIds = new Set(referee.bots.map(b => b.id));
  const name = id => referee.bots.find(b => b.id === id)?.name ?? id;
  const boss = () => referee.callName;
  const talking = () => referee.enabled && !!referee.discord;
  let busyUntil = 0;

  // [{item, qty}] → Map(id → 개수). 메뉴에 없는 건 버린다.
  function count(list) {
    const out = new Map();
    for (const o of Array.isArray(list) ? list.slice(0, 20) : []) {
      const m = byKey.get(String(o?.item));
      const q = Math.max(0, Math.min(9, Math.floor(Number(o?.qty) || 0)));
      if (m && q) out.set(m.id, (out.get(m.id) || 0) + q);
    }
    return out;
  }

  // 정답과 포스기에 찍은 것을 비교
  function compare(answer, entered) {
    const want = count(answer), got = count(entered);
    const missing = [], wrong = [], extra = [];
    for (const [id, q] of want) {
      const g = got.get(id) || 0;
      if (!g) missing.push(byKey.get(id).name);
      else if (g !== q) wrong.push(`${byKey.get(id).name}(${q}개인데 ${g}개)`);
    }
    for (const id of got.keys()) if (!want.has(id)) extra.push(byKey.get(id).name);
    const orderText = [...want].map(([id, q]) => `${byKey.get(id).name} ${q}개`).join(', ');
    const list = m => [...m].map(([item, qty]) => ({ item, qty }));
    return { ok: !missing.length && !wrong.length && !extra.length, missing, wrong, extra, orderText, want: list(want), got: list(got) };
  }

  // 누가 말하는 중이면 자리가 빌 때까지 기다렸다가 부른다. 대꾸(다른 봇이 받아치기)는 안 붙인다.
  function callWhenFree(id, text, maxMs = 20000, onCalled = () => {}) {
    const until = Date.now() + maxMs;
    const tryCall = () => {
      if (referee.floorFree()) { onCalled(); return referee.call(id, text, { important: true, depth: 99 }); }
      if (Date.now() < until) setTimeout(tryCall, 200);
    };
    tryCall();
  }

  // 봇 id에게 text를 부탁하고, 그 대답이 디스코드에서 다 끝나면 finish를 부른다.
  //   음성방에 있으면: 대답 목소리(감탄사 아닌 차례)가 끝날 때. 음성방에 없으면: 대답 글이 온 뒤 4초. 최대 capMs.
  function callAndWait(id, text, finish, capMs = 20000) {
    const voice = referee.voice;
    let called = false, talkingNow = false, textAt = 0;
    const onSpeak = (bot, priority) => { if (bot === id && !priority) talkingNow = true; };
    const onFloorDone = bot => { if (bot === id && talkingNow) cleanup(); };
    const poll = setInterval(() => {
      if (!called || talkingNow || referee.speaking.has(id)) return;   // 아직 대답 글을 기다리는 중
      textAt ||= Date.now();
      if (Date.now() - textAt > 4000) cleanup();                     // 글은 왔는데 목소리가 안 나옴
    }, 300);
    const cleanup = () => { voice?.off('speak', onSpeak); voice?.off('done', onFloorDone); clearInterval(poll); clearTimeout(cap); finish(); };
    const cap = setTimeout(cleanup, capMs);
    voice?.on('speak', onSpeak);
    voice?.on('done', onFloorDone);
    callWhenFree(id, text, capMs, () => { called = true; });
  }

  // verdict: perfect | close | wrong (timeout은 예전 시간 제한용). 손님 한 명만, 짧은 한마디.
  // onDone: 그 한마디가 디스코드에서 다 끝났을 때(목소리가 끝남) 부른다. 못 듣게 되면 최대 20초 뒤에.
  // 디스코드로 말하게 했으면 { spoken: true, speaker } 를 돌려준다.
  function react({ customers, verdict, orderText, missing = [], wrong = [], extra = [], onDone = () => {} }) {
    const who = [...new Set(Array.isArray(customers) ? customers : [])].filter(id => botIds.has(id));
    const id = who[0];
    let finished = false;
    const finish = () => { if (!finished) { finished = true; setTimeout(onDone, 50); } };   // 주문 완료 답보다 먼저 가지 않게
    if (!id || !FALLBACK[verdict] || Date.now() < busyUntil) { finish(); return { spoken: false, speaker: id || null }; }   // 여러 명이 동시에 하면 건너뜀
    busyUntil = Date.now() + 4000;
    console.log(`[버거] 주문 완료: ${verdict} (${name(id)})`);
    if (!talking()) {
      setTimeout(() => { referee.io.emit('say', { id, text: FALLBACK[verdict][id] }); setTimeout(finish, 2500); }, 300);
      return { spoken: false, speaker: id };
    }
    const friend = who.length > 1 ? ` 너는 ${name(who[1])}랑 같이 왔어.` : '';
    const intro = `[버거] 버거집 게임 중. ${boss()}가 점원이고 너는 손님.${friend}`;
    let ask;
    if (verdict === 'perfect') ask = `${boss()}가 네 랩 주문을 포스기에 다 맞게 찍었어. 기뻐하는 한마디.`;
    else if (verdict === 'close') ask = `${boss()}가 랩을 한 번 더 듣고서야 맞게 찍었어. 살짝 놀리는 한마디.`;
    else if (verdict === 'timeout') ask = `${boss()}가 시간 안에 주문을 못 찍었어. 기다리다 지쳐서 가게를 나가며 한마디.`;
    else {
      const first = missing[0] ? `${missing[0]}(빠뜨림)` : wrong[0] ? wrong[0].replace(/\(.*\)/, '(개수 틀림)') : extra[0] ? `${extra[0]}(안 시킴)` : '';
      ask = `${boss()}가 주문을 틀리게 찍었어${first ? `. 틀린 것: ${first}` : ''}. 짧게 따지고 가게를 나가며 한마디.`;
    }
    const text = `${intro} ${ask} 12자 안팎, 짧게 한마디만.`;
    callAndWait(id, text, finish);
    return { spoken: true, speaker: id };
  }

  // 디스코드로 되묻기: 친구가 음성이나 채팅으로 주문을 되물으면, 손님이 진짜 주문을 보고 맞는지 짧게 알려 준다.
  // 진짜 주문 전체를 불러 주지는 않고, 틀린 것 하나만 바로잡는다. 대답이 끝나면 onDone.
  function ask({ who, song, speech, typed = false, onDone = () => {} }) {
    if (!talking() || !botIds.has(who)) return false;
    const r = compare(song.order, []);
    const friend = song.customers.length > 1 ? ` 너는 ${name(song.customers.find(c => c !== who))}랑 같이 왔고, 아래는 둘의 주문을 합친 거야.` : '';
    const text = `[버거] 버거집 게임 중. ${boss()}가 점원이고 너는 손님.${friend} ${boss()}가 방금 ${typed ? '채팅으로' : '음성으로'} 물었어: "${speech}". `
      + `네가 랩으로 한 진짜 주문: ${r.orderText}. ${boss()}가 말한 게 진짜 주문과 같으면 짧게 맞다고 해 줘. `
      + `다르거나 빠진 게 있으면 그중 하나만 바로잡아 줘(예: "콜라 말고 사이다!"). 진짜 주문 전체를 다 불러 주지는 마. 12자 안팎, 짧게 한마디만.`;
    console.log(`[버거] 되묻기 → ${name(who)}: "${speech}"`);
    callAndWait(who, text, onDone);
    return true;
  }

  // 시험 화면(/order-test/)용: 정답과 찍은 것을 받아서 비교하고 반응
  function orderDone({ customers, answer, entered } = {}) {
    const r = compare(answer, entered);
    if (!r.orderText) return null;
    react({ customers, verdict: r.ok ? 'perfect' : 'wrong', ...r });
    return { ok: r.ok, missing: r.missing, wrong: r.wrong, extra: r.extra };
  }

  return { orderDone, compare, react, ask, byKey };
}
