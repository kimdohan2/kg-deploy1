// 카페 수다 — 손님이 된 봇에게 주문·반응·리뷰를 시킨다. (Hermes·목소리는 다른 게임과 같이 씀)
//   주문: 심판이 "이 음료를 네 말투로 주문해" → 목소리가 나오면 화면에 주문표가 뜬다 (늦으면 8초 뒤 그냥 뜸)
//   음료를 내면: 맞았는지·빠진 것·걸린 시간을 알려 주고 한마디 / 영업이 끝나면: 셋이 차례로 가게 리뷰
// 디스코드가 없거나 봇 수다를 끄면 정해 둔 짧은 대사를 말풍선으로만 띄운다.
// 받침 있으면 "을", 없으면 "를" (메뉴 이름은 모두 받침이 없지만 추가 재료는 "휘핑크림", "얼음"처럼 있다)
const eul = w => { const c = w.charCodeAt(w.length - 1); return c >= 0xac00 && c <= 0xd7a3 && (c - 0xac00) % 28 ? '을' : '를'; };

const FALLBACK = {
  order: {
    coco: d => `${d} 주세요! 헤헷, 빨리빨리!`,
    lovey: (d, x) => `${d}, ${x} 추가. 나니까 이 조합 아는 거야.`,
    rou: d => `${d} 한 잔 가 볼까?`,
  },
  again: () => '아까 그거! 기억하지?',
  change: to => `아 아니다! ${to}로 바꿔 줘!`,
  good: { coco: '펑! 맛있다아!', lovey: '하핫, 역시 내 입맛을 아는구만.', rou: '오, 타이밍 완벽한데?' },
  bad: { coco: '어라? 이거 아닌데에!', lovey: '흠, 이건 일지에서 지울게.', rou: '어라? 다른 시간대에선 맞았는데.' },
  timeout: { coco: '심심해애! 나 간다!', lovey: '기다리는 건 내 스타일이 아니거든.', rou: '되감아도 안 나오겠다. 간다!' },
};

export function attachCafe({ referee, game, voice }) {
  const live = () => referee.game === game;
  const talking = () => referee.enabled && !!referee.discord;
  const boss = () => referee.callName;
  const say = (id, text) => referee.io.emit('say', { id, text });

  voice?.on('speak', (id, isClip) => { if (!isClip && live()) game.botSpoke(id); });

  // 누가 말하는 중이면 자리가 빌 때까지 기다렸다가 부른다 (중요한 말이 줄에서 버려지지 않게)
  function callWhenFree(id, text, maxMs = 12000) {
    const until = Date.now() + maxMs;
    const tryCall = () => {
      if (!live()) return;
      if (referee.floorFree()) return referee.call(id, text, { important: true });
      if (Date.now() < until) setTimeout(tryCall, 200);
    };
    tryCall();
  }

  // 말하게 하거나(디스코드), 정해 둔 말풍선을 띄운다
  function speak(id, text, fallback) {
    if (talking()) {
      game.waitForVoice(id);
      callWhenFree(id, text);
    } else if (fallback) {
      setTimeout(() => live() && say(id, fallback), 300);
    }
  }

  game.on('event', ev => {
    if (!live()) return;
    const id = ev.who;
    switch (ev.type) {
      case 'order': {
        const intro = `[카페] 지금은 카페 놀이 중이야. ${boss()}가 카페 사장이고 너는 손님으로 막 들어왔어.`;
        let ask, fb;
        if (ev.again) {
          ask = `지난번에 마신 거(${ev.drink})를 또 주문해. 메뉴 이름은 절대 말하지 말고 "아까 그거"라고만 해. ${boss()}가 기억하는지 떠봐.`;
          fb = FALLBACK.again();
        } else if (ev.extra) {
          ask = `"${ev.drink}"를 주문하면서 추가로 "${ev.extra}"${eul(ev.extra)} 꼭 얹어 달라고 해. 메뉴 이름과 "${ev.extra}"는 꼭 그대로 말해.`;
          fb = FALLBACK.order.lovey(ev.drink, ev.extra);
        } else {
          ask = `"${ev.drink}"를 주문해. 메뉴 이름 "${ev.drink}"는 꼭 그대로 말해.`;
          fb = (FALLBACK.order[id] || FALLBACK.order.rou)(ev.drink);
        }
        return speak(id, `${intro} ${ask} 네 말투로 한 문장, 25자 안팎.`, fb);
      }
      case 'change':
        return speak(id, `[카페] 방금 "${ev.from}" 주문했는데 마음이 바뀌었어. "${ev.to}"로 바꿔 달라고 해. 메뉴 이름 "${ev.to}"는 꼭 그대로 말하고 짧게 한 문장.`,
          FALLBACK.change(ev.to));
      case 'served': {
        const time = ev.fast ? `${ev.secs}초 만에 나옴(엄청 빠름)` : ev.slow ? `${ev.secs}초 걸림(좀 느림)` : `${ev.secs}초 걸림`;
        let text;
        if (ev.ok) {
          const special = ev.again ? ` "아까 그거"를 ${boss()}가 기억해서 맞힘.` : ev.changed ? ' 바꾼 주문도 잘 알아들음.' : ev.hadExtra ? ' 추가 주문도 잘 들어감.' : '';
          text = `[카페] ${boss()}가 만들어 준 "${ev.drink}"를 받았어. 주문대로 완벽함, ${time}.${special} 한 모금 마시고 한마디 해.`;
        } else {
          const parts = [];
          if (ev.missing.length) parts.push(`빠진 것: ${ev.missing.join(', ')}`);
          if (ev.extra.length) parts.push(`안 시킨 것: ${ev.extra.join(', ')}`);
          const special = ev.again ? ` ${boss()}가 "아까 그거"를 기억 못 함.` : ev.changed ? ' 바꾼 주문을 못 알아들은 것 같아.' : '';
          text = `[카페] ${boss()}가 만들어 준 음료를 받았는데 주문이랑 달라 (${parts.join(' / ')}).${special} 한 모금 마시고 네 성격대로 한마디 해.`;
        }
        return speak(id, text, (ev.ok ? FALLBACK.good : FALLBACK.bad)[id]);
      }
      case 'timeout':
        return speak(id, `[카페] 음료가 너무 안 나와서 기다리다 지쳤어. 한마디 하고 가게를 나가.`, FALLBACK.timeout[id]);
      case 'day_end':
        return reviews(ev);
    }
  });

  // 영업이 끝나면 셋이 차례로 리뷰 (한 명이 말을 끝내면 다음 사람)
  function reviews(ev) {
    if (!talking()) return;
    const ids = referee.bots.map(b => b.id).sort(() => Math.random() - 0.5);
    ids.forEach((id, i) => {
      const mine = ev.log.filter(l => l.who === id);
      const good = mine.filter(l => l.ok).length;
      const text = `[카페] 오늘 카페 영업 끝. 너는 오늘 ${mine.length}번 왔고 그중 ${good}번 주문대로 받았어. ${boss()}네 카페 리뷰를 네 말투로 한 문장 해.`;
      setTimeout(() => callWhenFree(id, text, 20000), 1500 + i * 400);
    });
  }
}
