// 투닥 카페 화면 — 손님(봇)이 카운터에 와서 주문하면, 재료를 눌러 컵에 담고 "내기".
// game.js의 state·cfg·bubbles·ctx·socket 등을 같이 쓴다. 컵은 이 화면에서만 들고 있다가 내기 때 서버로 보낸다.
let cup = [];
let cafeBuilt = false;

const ingOf = id => cfg.cafe.ingredients.find(i => i.id === id);
const won = n => `${n.toLocaleString('ko-KR')}원`;

function buildCafe() {
  if (cafeBuilt || !cfg?.cafe) return;
  cafeBuilt = true;
  $('#ings').innerHTML = cfg.cafe.ingredients.map((g, i) =>
    `<button type="button" class="ing" data-id="${g.id}" style="--c:${g.color}"><i></i>${escapeHtml(g.name)}<span>${i + 1}</span></button>`).join('');
  for (const b of document.querySelectorAll('.ing')) b.onclick = () => toggleIng(b.dataset.id);
  $('#trash').onclick = emptyCup;
  $('#serve').onclick = serveCup;
  $('#recipes').innerHTML = '<h3>레시피</h3>' + cfg.cafe.menu.map(m =>
    `<div class="rc"><b>${escapeHtml(m.name)}</b><span>${m.items.map(i => escapeHtml(ingOf(i).name)).join(' + ')}</span></div>`).join('');
  renderCup();
}

function canServe() {
  return role === 'player' && state?.mode === 'cafe' && state.phase === 'open' && state.guest?.step === 'waiting';
}

function toggleIng(id) {
  if (state?.mode !== 'cafe' || role !== 'player') return;
  initAudio();
  cup = cup.includes(id) ? cup.filter(x => x !== id) : [...cup, id];
  tone(cup.includes(id) ? 700 : 420, 0.06, { type: 'triangle', vol: 0.08 });
  renderCup();
}

function emptyCup() {
  if (!cup.length) return;
  cup = [];
  noise(0.15, { vol: 0.08, freq: 900 });
  renderCup();
}

function serveCup() {
  if (!canServe() || !cup.length) return;
  socket.emit('serve', cup);
  cup = [];
  renderCup();
}

function renderCup() {
  if (!cafeBuilt) return;
  $('#cup').innerHTML = cup.length
    ? cup.map(id => `<span class="chip" style="--c:${ingOf(id).color}">${escapeHtml(ingOf(id).name)}</span>`).join('')
    : '<span class="empty">빈 컵 · 재료를 눌러 담아요</span>';
  for (const b of document.querySelectorAll('.ing')) b.classList.toggle('on', cup.includes(b.dataset.id));
  $('#serve').disabled = !canServe() || !cup.length;
}

addEventListener('keydown', e => {
  if (state?.mode !== 'cafe' || role !== 'player' || document.activeElement === nameInput) return;
  const n = Number(e.key);
  if (n >= 1 && n <= (cfg?.cafe.ingredients.length ?? 0)) toggleIng(cfg.cafe.ingredients[n - 1].id);
  else if (e.key === 'Backspace' || e.key === 'Delete') { e.preventDefault(); emptyCup(); }
  else if (e.key === 'Enter' && state.phase === 'open') serveCup();
});

// ---------- HUD ----------

let lastCafeScore = '';
function renderCafeHud(s) {
  buildCafe();
  const playing = role === 'player' && s.phase !== 'waiting';
  $('#cafe').hidden = !(playing && s.phase === 'open');
  $('#recipes').hidden = s.phase === 'waiting';
  $('#round').textContent = s.round ? `${s.round}일째 영업 · 손님 ${s.served}/${s.total}` : '';
  $('#helptext').textContent = '주문을 듣고 재료(1~8)를 담아 내기(Enter) · 레시피는 오른쪽';
  $('#cd').hidden = true;
  renderCup();

  const ids = cfg?.bots.map(b => b.id) ?? [];
  const score = `cafe${s.tips}|${ids.map(id => s.wins[id] || 0).join(',')}|${s.humanName}`;
  if (score !== lastCafeScore && cfg) {
    lastCafeScore = score;
    $('#score').innerHTML = `<span class="who"><img src="img/player_sprite.png" alt=""><span>${escapeHtml(s.humanName)} 팁</span><b>${won(s.tips)}</b></span>`
      + ids.map(id => `<span class="who"><img src="img/${id}_sprite.png" alt=""><span>${escapeHtml(nameOf(id))}</span><b>♥ ${s.wins[id] || 0}</b></span>`).join('');
  }

  let html = '';
  if (s.phase === 'closed') {
    const rows = ids.map(id => {
      const mine = s.log.filter(l => l.who === id);
      return `<span>${escapeHtml(nameOf(id))} ${mine.map(l => l.ok ? '♥' : '✗').join(' ')}</span>`;
    }).join('');
    html = `<div class="mid">영업 끝!</div><div class="small">오늘 팁 ${won(s.tips)}</div><div class="small cafe-log">${rows}</div>`
      + (role === 'player'
        ? '<button id="again" class="again" type="button">내일 영업 <span>Enter</span></button>'
        : '<div class="small">사장님이 다시 열기를 기다리는 중</div>');
  }
  if (s.phase === 'waiting' && role === 'spectator') $('#start').hidden = false;
  if (role === 'spectator' && s.phase !== 'waiting') html += '<div class="small">관전 중</div>';
  const center = $('#center');
  if (center.innerHTML !== html) center.innerHTML = html;
}

// ---------- 그리기 ----------

function drawCafe(now, W, H) {
  const dpr = devicePixelRatio || 1;
  ctx.scale(dpr, dpr);
  const w = W / dpr, h = H / dpr;
  const panelH = role === 'player' && state.phase === 'open' ? 190 : 70;
  const counterY = Math.max(250, h - panelH - 110);

  // 벽, 창문, 간판
  const wall = ctx.createLinearGradient(0, 0, 0, counterY);
  wall.addColorStop(0, '#4a3328');
  wall.addColorStop(1, '#2e211b');
  ctx.fillStyle = wall;
  ctx.fillRect(0, 0, w, counterY);
  ctx.fillStyle = 'rgba(255,220,160,0.08)';
  for (let x = 0; x < w; x += 46) ctx.fillRect(x, 0, 2, counterY);
  for (const wx of [w * 0.18, w * 0.82]) {
    ctx.fillStyle = '#1d2a3f';
    roundRect(wx - 70, 90, 140, 110, 10);
    ctx.fill();
    ctx.strokeStyle = '#7a5532';
    ctx.lineWidth = 6;
    ctx.stroke();
    ctx.fillStyle = 'rgba(255,240,200,0.5)';
    ctx.beginPath();
    ctx.arc(wx + 30, 125, 10, 0, TAU);
    ctx.fill();
  }
  outlinedText('투닥 카페', w / 2, 70, 30, '#ffcf4a');

  // 손님
  const g = state.guest;
  const size = Math.min(220, counterY * 0.55);
  const cx = w / 2;
  let gx = cx;
  if (g) {
    if (g.step === 'enter') gx = cx + (1 - Math.min(1, g.since / 1.2)) * (w / 2 + size);
    else if (g.step === 'leaving' && g.since > 2.6) gx = cx - Math.min(1, (g.since - 2.6) / 1.2) * (w / 2 + size);
    const img = sprites[g.who];
    const bob = g.step === 'enter' || (g.step === 'leaving' && g.since > 2.6) ? Math.abs(Math.sin(now / 90)) * 6 : Math.sin(now / 500) * 2;
    if (img?.complete) {
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(img, gx - size / 2, counterY - size + 30 - bob, size, size);
      ctx.imageSmoothingEnabled = true;
    }
  }

  // 카운터
  ctx.fillStyle = '#8a5a35';
  ctx.fillRect(0, counterY, w, h - counterY);
  ctx.fillStyle = '#a8703f';
  ctx.fillRect(0, counterY, w, 16);
  ctx.fillStyle = 'rgba(0,0,0,0.18)';
  for (let x = 30; x < w; x += 120) ctx.fillRect(x, counterY + 16, 3, h - counterY);

  if (g) {
    outlinedText(nameOf(g.who), gx, counterY + 24, 20, colorOf(g.who));
    drawTicket(now, g, cx, size, counterY);
    // 결과: 하트·팁 또는 X
    if (g.step === 'leaving' && g.result && g.since < 3.2) {
      const up = Math.min(1, g.since / 0.6) * 30;
      const text = g.result.ok ? `♥ +${won(g.result.tip)}` : g.result.timeout ? '…기다리다 감' : '✗ 주문이랑 달라!';
      outlinedText(text, gx, counterY - size - 10 - up, 28, g.result.ok ? '#ff8fab' : '#ff6b6b');
    }
    const b = bubbles[g.who];
    if (b) {
      if (now > b.until) delete bubbles[g.who];
      else drawBubble(gx + size * 0.55, counterY - size + 40, b.text);
    }
  }
  // 손님 아닌 친구가 한 말(받아치기)은 화면 위쪽 가장자리에 작게
  const others = cfg.bots.filter(b => b.id !== g?.who);
  others.forEach((b, i) => {
    const bb = bubbles[b.id];
    if (!bb) return;
    if (now > bb.until) { delete bubbles[b.id]; return; }
    const x = i === 0 ? 120 : w - 120;
    drawBubble(x, 250, `${b.name}: ${bb.text}`);
  });
}

function drawTicket(now, g, cx, size, counterY) {
  const tw = 170, th = 130;
  const tx = Math.max(12, cx - size / 2 - tw - 30), ty = counterY - th - 30;
  if (g.step === 'enter') return;
  ctx.save();
  ctx.translate(tx + tw / 2, ty + th / 2);
  ctx.rotate(-0.04);
  ctx.fillStyle = '#fffaf0';
  roundRect(-tw / 2, -th / 2, tw, th, 6);
  ctx.fill();
  ctx.fillStyle = '#e05a5a';
  ctx.fillRect(-tw / 2, -th / 2, tw, 8);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.fillStyle = '#8a7a6a';
  ctx.font = '15px Jua, sans-serif';
  ctx.fillText('주문', 0, -th / 2 + 14);
  const t = g.ticket;
  ctx.fillStyle = '#2a2230';
  if (!t) {
    ctx.font = '20px Jua, sans-serif';
    ctx.fillText(`듣는 중${'.'.repeat(1 + Math.floor(now / 400) % 3)}`, 0, -6);
  } else {
    const title = t.title;
    ctx.font = `${title.length > 7 ? 21 : 26}px Jua, sans-serif`;
    ctx.fillText(t.again ? '"아까 그거"' : title, 0, -14);
    ctx.font = '17px Jua, sans-serif';
    if (t.extra) { ctx.fillStyle = '#c0392b'; ctx.fillText(`+ ${t.extra}`, 0, 20); }
    if (t.again) { ctx.fillStyle = '#8a7a6a'; ctx.fillText('기억나?', 0, 20); }
    if (t.changed) {
      ctx.save();
      ctx.rotate(0.25);
      ctx.strokeStyle = '#e05a5a';
      ctx.lineWidth = 3;
      roundRect(18, -th / 2 - 4, 58, 28, 6);
      ctx.stroke();
      ctx.fillStyle = '#e05a5a';
      ctx.font = '17px Jua, sans-serif';
      ctx.fillText('바뀜!', 47, -th / 2 + 1);
      ctx.restore();
    }
  }
  // 기다림 막대
  if (g.left != null) {
    const p = Math.max(0, Math.min(1, g.left / g.patience));
    ctx.fillStyle = 'rgba(0,0,0,0.12)';
    roundRect(-tw / 2 + 14, th / 2 - 20, tw - 28, 9, 4);
    ctx.fill();
    ctx.fillStyle = `hsl(${120 * p}, 70%, 48%)`;
    roundRect(-tw / 2 + 14, th / 2 - 20, (tw - 28) * p, 9, 4);
    ctx.fill();
  }
  ctx.restore();
}
