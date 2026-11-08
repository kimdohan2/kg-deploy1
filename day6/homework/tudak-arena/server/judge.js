// Jev(TypeSafe System One)로 빠른 판단 두 가지를 한다. 말은 만들지 않고 "누구에게, 할지 말지"만 고른다.
//   1) 사람이 음성으로 한 말을 누가 들어야 하나 (이름이 없을 때)
//   2) 친구가 한 말에 다른 친구가 바로 받아칠 만한가, 받아친다면 누가
// TYPESAFE_API_KEY가 없거나 Jev가 늦으면/실패하면 null을 돌려주고, 부른 쪽이 원래 규칙대로 한다.

const API = 'https://api.typesafe.ai/v1/systemone';
const MODEL = 'jev-latest';
const TIMEOUT_MS = 1500;

export class Judge {
  constructor({ env, bots }) {
    this.key = env.TYPESAFE_API_KEY || '';
    this.bots = bots;
    this.lastMs = null;
  }

  get enabled() { return !!this.key; }

  friends(ids = this.bots.map(b => b.id)) {
    return Object.fromEntries(this.bots.filter(b => ids.includes(b.id))
      .map(b => [b.id, `${b.name}(말할 땐 "${b.speakName}") — ${b.persona}`]));
  }

  async ask(state, questions) {
    if (!this.enabled) return null;
    const t = Date.now();
    try {
      const res = await fetch(API, {
        method: 'POST',
        headers: { Authorization: `Bearer ${this.key}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: MODEL, state, questions }),
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status} ${(await res.text()).slice(0, 120)}`);
      const { answers } = await res.json();
      this.lastMs = Date.now() - t;
      return answers;
    } catch (err) {
      console.error(`[Jev] 판단 실패 (${Date.now() - t}ms): ${err.message}`);
      return null;
    }
  }

  // 사람이 음성으로 한 말을 들을 친구. 모두에게 한 말이면 'group'. 실패하면 null.
  async listener(speech, recent) {
    const a = await this.ask({ speech, recent, friends: this.friends() }, {
      listener: {
        type: 'choice',
        instructions: '사람 플레이어가 봇 친구 셋(`friends`)과 밀치기 게임을 하며 음성 채팅 중에 방금 `speech`라고 말했어요. '
          + '`recent`(마지막이 가장 최근)의 흐름을 보면, 플레이어는 누구에게 한 말일까요?',
        criteria: { ...this.friends(), group: '특정한 한 명이 아니라 모두에게, 또는 혼잣말' },
      },
    });
    return a?.listener?.choice ?? null;
  }

  // speaker가 line이라고 했을 때: 받아칠 확률(0~1)과 받아칠 친구. 실패하면 null.
  async retort(speaker, line, recent) {
    const others = this.bots.map(b => b.id).filter(id => id !== speaker);
    const name = this.bots.find(b => b.id === speaker)?.name;
    const a = await this.ask({ speaker: name, line, recent, friends: this.friends(others) }, {
      retort: {
        type: 'noul',
        instructions: '친구들끼리 게임하며 수다 떠는 음성 채팅에서 `speaker`가 방금 `line`이라고 했어요. '
          + '다른 친구가 바로 받아칠 만한 말인가요? (누구를 탓하거나 놀리거나, 묻거나, 도발하거나, 반응을 바라는 말)',
        criteria: {
          true: '받아치는 게 자연스러움: 특정 친구를 탓함·놀림·질문·도발·자랑',
          false: '그냥 넘어가도 자연스러움: 혼잣말, 감탄, 대화를 마무리하는 말',
        },
      },
      next: {
        type: 'choice',
        instructions: '`speaker`가 한 `line`에 `friends` 중 누가 받아치는 게 가장 자연스러울까요? '
          + '말에서 불리거나 탓한 친구가 있으면 그 친구예요.',
        criteria: this.friends(others),
      },
    });
    if (!a) return null;
    return { p: a.retort.noul, next: a.next.choice };
  }
}
