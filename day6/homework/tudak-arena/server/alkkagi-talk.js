// 알까기 수다 — 알까기 사건을 보고 심판이 누구에게 무슨 말을 시킬지 정한다. (Hermes·목소리·감탄사는 투닥과 같이 씀)
//   내 차례: 1.5초쯤 뒤 봇 하나가 훈수 (누가 할지는 Jev가 고름)
//   봇 차례: 그 봇이 쏘기 전에 한마디 → 목소리가 나오면 쏜다 (늦으면 6초 뒤 그냥 쏨)
//   맞음·떨어짐: 즉시 감탄사 / 친 뒤: 놀림·아쉬움 한마디 (받아치기는 심판의 대꾸 규칙 그대로)
const pick = arr => arr[Math.floor(Math.random() * arr.length)];

export function attachAlkkagi({ referee, game, voice }) {
  const name = id => referee.name(id);
  const isBot = id => referee.bots.some(b => b.id === id);
  const leftText = left => left.map(([o, n]) => `${name(o)} ${n}개`).join(', ');
  const live = () => referee.game === game;   // 지금 알까기를 하고 있을 때만
  let recent = '';                            // 방금 있었던 일 (훈수 고를 때 Jev에게 알려줌)

  voice?.on('speak', (id, isClip) => { if (!isClip && live()) game.botSpoke(id); });

  game.on('event', ev => {
    if (!live()) return;
    switch (ev.type) {
      case 'round_start':
        recent = '';
        return;
      case 'turn':
        if (ev.who === 'player') return adviseLater(ev);
        if (referee.enabled && referee.discord) game.waitForDeclare(ev.who);
        return referee.call(ev.who,
          `[게임] 알까기 네 차례야. ${ev.target ? `${name(ev.target)}의 돌을 노릴 거야. ` : ''}쏘기 전에 짧게 한마디 해. / 남은 돌: ${leftText(ev.left)}`,
          { important: true });
      case 'hit':
        return referee.playClip(ev.victim, 'hit', 0.4);
      case 'stone_out':
        if (ev.self) return referee.playClip(ev.owner, 'oops');
        referee.playClip(ev.owner, 'out');
        return referee.playClip(ev.shooter, 'gotcha', 0.6);
      case 'shot_end':
        return afterShot(ev);
      case 'eliminated':
        if (!isBot(ev.owner)) return;
        return referee.call(ev.owner, `[게임] 알까기에서 네 돌이 다 떨어져서 탈락함. ${
          ev.by !== ev.owner ? `마지막 돌은 ${name(ev.by)}가 날림.` : '마지막 돌은 네가 직접 날림.'}`, { important: true });
      case 'win': {
        if (isBot(ev.winner)) {
          referee.playClip(ev.winner, 'win');
          return referee.call(ev.winner, '[게임] 알까기에서 네가 우승함!', { important: true });
        }
        const b = pick(referee.bots).id;
        referee.playClip(b, 'lose');
        return referee.call(b, `[게임] ${name(ev.winner)}가 알까기에서 우승함.`, { important: true });
      }
    }
  });

  function adviseLater(ev) {
    setTimeout(async () => {
      const stillAiming = () => live() && game.phase === 'turn' && game.turn === 'player';
      if (!stillAiming()) return;
      const ids = referee.bots.map(b => b.id).filter(id => referee.available(id));
      if (!ids.length) return;
      const situation = `${referee.callName}가 조준 중. 남은 돌: ${leftText(ev.left)}.${recent ? ` 방금: ${recent}` : ''}`;
      const chosen = (await referee.judge.adviser(situation, ids)) || pick(ids);
      if (!stillAiming() || !ids.includes(chosen)) return;
      referee.call(chosen, `[훈수] ${referee.callName}가 알까기 조준 중이야. / 남은 돌: ${leftText(ev.left)}. ${referee.callName}한테 짧게 훈수하거나 놀려.`);
    }, 1500);
  }

  function afterShot(ev) {
    const outs = ev.outs.filter(o => !o.self);
    recent = ev.miss ? `${name(ev.shooter)}가 헛침`
      : outs.length ? `${name(ev.shooter)}가 ${outs.map(o => name(o.owner)).join(', ')}의 돌을 날림` : `${name(ev.shooter)}가 맞혔지만 못 날림`;
    if (ev.miss) {
      if (isBot(ev.shooter)) return referee.playClip(ev.shooter, 'miss');
      if (Math.random() < 0.5) {
        referee.call(pick(referee.bots).id, `[게임] ${referee.callName}가 알까기에서 쳤는데 아무것도 못 맞힘. 짧게 놀려.`);
      }
      return;
    }
    const botVictim = outs.find(o => isBot(o.owner));
    if (botVictim && Math.random() < 0.6) {
      return referee.call(botVictim.owner, `[게임] ${name(ev.shooter)}가 쳐서 네 돌이 판 밖으로 떨어짐. / 남은 돌: ${leftText(ev.left)}`);
    }
    if (ev.selfOut && isBot(ev.shooter)) {
      return referee.call(ev.shooter, `[게임] 네가 쳤는데 네 돌도 같이 판 밖으로 날아감. / 남은 돌: ${leftText(ev.left)}`);
    }
    if (outs.length && isBot(ev.shooter) && Math.random() < 0.4) {
      return referee.call(ev.shooter, `[게임] 네가 쳐서 ${outs.map(o => name(o.owner)).join(', ')}의 돌을 날림. / 남은 돌: ${leftText(ev.left)}`);
    }
  }
}
