// Show me the burger 수다 — 포스기에서 "주문 완료"를 누르면 손님 봇이 Hermes로 디스코드에서 한마디 한다.
//   완벽: 기뻐함 / 아슬아슬(다시 듣고 맞힘): 놀리듯 / 틀림: 뭐가 틀렸는지 집어서 따짐 / 시간 초과: 기다리다 지쳐서 나감
//   손님이 둘이면 한 명씩 차례로 (앞사람 목소리가 끝나야 다음 사람).
// 디스코드가 없거나 봇 수다를 끄면 정해 둔 짧은 대사를 말풍선으로만 띄운다.
import { readFileSync } from 'node:fs';

const FALLBACK = {
  perfect: { coco: '완벽해애! 꺄하하!', lovey: '하핫, 역시 내 주문을 알아듣는구만.', rou: '오, 타이밍 완벽한데?' },
  close: { coco: '두 번 듣고 맞힌 거지? 헤헷.', lovey: '다시 들려 달라니, 이번만 봐준다.', rou: '한 번 되감았네? 괜찮아.' },
  wrong: { coco: '어라? 이거 아닌데에!', lovey: '흠, 이건 일지에서 지울게.', rou: '어라? 다른 시간대에선 맞았는데.' },
  timeout: { coco: '심심해애! 나 간다!', lovey: '기다리는 건 내 스타일이 아니거든.', rou: '되감아도 안 나오겠다. 간다!' },
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
  function callWhenFree(id, text, maxMs = 20000) {
    const until = Date.now() + maxMs;
    const tryCall = () => {
      if (referee.floorFree()) return referee.call(id, text, { important: true, depth: 99 });
      if (Date.now() < until) setTimeout(tryCall, 200);
    };
    tryCall();
  }

  // verdict: perfect | close | wrong | timeout. 디스코드로 말하게 했으면 true.
  function react({ customers, verdict, orderText, missing = [], wrong = [], extra = [] }) {
    const who = [...new Set(Array.isArray(customers) ? customers : [])].filter(id => botIds.has(id)).slice(0, 2);
    if (!who.length || !FALLBACK[verdict]) return false;
    if (Date.now() < busyUntil) return false;   // 여러 명이 동시에 하면 디스코드가 시끄러워지지 않게
    busyUntil = Date.now() + 4000;
    console.log(`[버거] 주문 완료: ${verdict} (${who.map(name).join(', ')})`);
    who.forEach((id, i) => {
      const friend = who.length > 1 ? ` 너는 ${name(who[1 - i])}랑 같이 와서 둘이 랩으로 주문했어.` : '';
      const intro = `[버거] 지금은 버거집 게임 "Show me the burger" 중이야. ${boss()}가 점원이고 너는 손님이야.${friend}`;
      const order = `방금 랩으로 한 주문(${orderText})`;
      let ask;
      if (verdict === 'perfect') {
        ask = `${order}을 ${boss()}가 포스기에 하나도 안 틀리고 찍었어. 주문 완료! 네 말투로 기뻐하면서 한마디 해.`;
      } else if (verdict === 'close') {
        ask = `${order}을 ${boss()}가 한 번에 못 알아듣고 다시 들려 달라고 해서 겨우 다 맞게 찍었어. 네 말투로 살짝 놀리면서 한마디 해.`;
      } else if (verdict === 'timeout') {
        ask = `${order}을 했는데 ${boss()}가 시간 안에 주문 완료를 못 눌렀어. 기다리다 지쳐서 한마디 하고 가게를 나가.`;
      } else {
        const parts = [];
        if (missing.length) parts.push(`빠뜨림: ${missing.join(', ')}`);
        if (wrong.length) parts.push(`개수 틀림: ${wrong.join(', ')}`);
        if (extra.length) parts.push(`안 시킨 것: ${extra.join(', ')}`);
        ask = `${order}을 ${boss()}가 포스기에 찍었는데 틀렸어 (${parts.join(' / ')}). 뭐가 틀렸는지 메뉴 이름을 콕 집어서 네 성격대로 따져.`;
      }
      const text = `${intro} ${ask} 한 문장, 25자 안팎.`;
      if (talking()) setTimeout(() => callWhenFree(id, text), i * 400);
      else setTimeout(() => referee.io.emit('say', { id, text: FALLBACK[verdict][id] }), 300 + i * 2500);
    });
    return talking();
  }

  // 시험 화면(/order-test/)용: 정답과 찍은 것을 받아서 비교하고 반응
  function orderDone({ customers, answer, entered } = {}) {
    const r = compare(answer, entered);
    if (!r.orderText) return null;
    react({ customers, verdict: r.ok ? 'perfect' : 'wrong', ...r });   // 방금 다른 주문에 반응 중이면 말은 건너뜀
    return { ok: r.ok, missing: r.missing, wrong: r.wrong, extra: r.extra };
  }

  return { orderDone, compare, react, byKey };
}
