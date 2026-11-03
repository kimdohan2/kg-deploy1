// 알까기 봇 조준 — 성격대로 노릴 돌과 세기를 고른다. 말은 하지 않는다(말은 심판이 Hermes에게 시킨다).
//   chaser(코코): 가까운 돌, 자기를 친 친구에게 복수
//   cautious(러비): 쉽고 안전한 샷만, 정확하게
//   reckless(Rou): 세게 막 쏜다. 가끔 자기 돌도 같이 날아간다
import { B, SR, DECEL, MAX_SHOT, KEEP } from './alkkagi.js';

const STYLE = {
  chaser: { noise: 9, power: 1.1 },
  cautious: { noise: 6.5, power: 1.05 },
  reckless: { noise: 11, power: 1.5, minSpeed: 950 },
};

const rand = (a, b) => a + Math.random() * (b - a);

// p에서 dir 방향으로 가다가 판 밖으로 나가기까지의 거리
export function exitDistance(p, dir) {
  let best = Infinity;
  for (const [pos, d] of [[p.x, dir.x], [p.y, dir.y]]) {
    if (d > 1e-6) best = Math.min(best, (B - pos) / d);
    else if (d < -1e-6) best = Math.min(best, (-B - pos) / d);
  }
  return best;
}

// s에서 t로 가는 길을 다른 돌이 막고 있나
function blocked(game, s, t) {
  const dx = t.x - s.x, dy = t.y - s.y, len = Math.hypot(dx, dy);
  for (const o of game.alive()) {
    if (o === s || o === t) continue;
    const along = ((o.x - s.x) * dx + (o.y - s.y) * dy) / len;
    if (along <= 0 || along >= len) continue;
    const perp = Math.abs((o.x - s.x) * dy - (o.y - s.y) * dx) / len;
    if (perp < SR * 1.8) return true;
  }
  return false;
}

// 그 봇의 이번 샷: { stone, vx, vy, target(주인 id) }
export function planShot(game, owner, styleName, memory = {}) {
  const st = STYLE[styleName] || STYLE.chaser;
  const mine = game.alive().filter(s => s.owner === owner);
  const enemies = game.alive().filter(s => s.owner !== owner);
  if (!mine.length || !enemies.length) return null;

  const cands = [];
  for (const s of mine) {
    for (const t of enemies) {
      const dx = t.x - s.x, dy = t.y - s.y, dist = Math.hypot(dx, dy);
      const dir = { x: dx / dist, y: dy / dist };
      const travel = Math.max(0, dist - SR * 2);
      const push = exitDistance(t, dir) + SR;                       // 맞은 돌이 나가려면 가야 할 거리
      const vt = Math.sqrt(2 * DECEL * push) * 1.08;
      const v0 = Math.sqrt((vt / KEEP) ** 2 + 2 * DECEL * travel);  // 그러려면 처음 세기
      const isBlocked = blocked(game, s, t);
      // 다들 앞서가는 사람(돌이 가장 많이 남은 사람)을 조금 더 노린다
      const lead = t.owner === memory.leader ? 3 : 0;
      let score = -v0 / 100 + lead;
      if (styleName === 'chaser') score = -travel / 40 + (t.owner === memory.revenge ? 6 : 0) + lead;
      if (styleName === 'cautious') score = -v0 / 80 + lead - (exitDistance(s, dir) < dist + 80 ? 6 : 0);
      if (isBlocked) score -= 20;
      cands.push({ s, t, dir, v0, score });
    }
  }
  cands.sort((a, b) => b.score - a.score);
  const pick = styleName === 'reckless'
    ? cands[Math.floor(Math.random() * Math.min(4, cands.length))]
    : cands[0];

  const ang = Math.atan2(pick.dir.y, pick.dir.x) + rand(-st.noise, st.noise) * Math.PI / 180;
  // 세기도 매번 조금씩 다르다 (모자라서 안 나가거나, 너무 세서 자기 돌까지 나가거나)
  const speed = Math.min(MAX_SHOT, Math.max(pick.v0 * st.power * rand(0.85, 1.15), st.minSpeed || 0));
  return { stone: pick.s.id, vx: Math.cos(ang) * speed, vy: Math.sin(ang) * speed, target: pick.t.owner };
}
