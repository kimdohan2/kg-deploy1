// 투닥 아레나 화면 — 서버가 보내준 상태를 그리고, 입력과 효과음만 담당한다. 게임은 밀치기(tudak)·알까기(alkkagi)·카페(cafe, cafe.js) 세 가지.
const $ = s => document.querySelector(s);
const canvas = $('#c');
const ctx = canvas.getContext('2d');
const socket = io();
const TAU = Math.PI * 2;

let cfg = null;
let state = null;
let role = null;
let chatterOn = true;
let goFlashUntil = 0;
const sprites = {};
const fallAnim = {};   // id -> 떨어지기 시작한 시각
const prevAlive = {};
const bubbles = {};    // id -> { text, until }
let mode = 'tudak';    // 시작 화면에서 고른 게임 (실제로 그리는 건 서버가 보낸 state.mode)
let myTurnFlashUntil = 0;
let aim = null;        // 알까기 조준 중: { stone, px, py }
let view = null;       // 알까기 화면 좌표 변환 { scale, ox, oy }

fetch('/api/config').then(r => r.json()).then(c => {
  cfg = c;
  for (const id of ['player', ...c.bots.map(b => b.id)]) {
    const img = new Image();
    img.src = `img/${id}_sprite.png`;
    sprites[id] = img;
  }
});

// ---------- 시작 화면 ----------

const nameInput = $('#name');
try { nameInput.value = localStorage.getItem('tudak-name') || ''; } catch {}
try { mode = localStorage.getItem('tudak-mode') || 'tudak'; } catch {}

function selectMode(m) {
  mode = m;
  for (const b of document.querySelectorAll('.mode')) b.classList.toggle('selected', b.dataset.mode === m);
}
selectMode(mode);
for (const b of document.querySelectorAll('.mode')) b.onclick = () => selectMode(b.dataset.mode);

function start() {
  const name = nameInput.value.trim() || '플레이어';
  try { localStorage.setItem('tudak-name', name); localStorage.setItem('tudak-mode', mode); } catch {}
  initAudio();
  socket.emit('join', { name, mode });
  $('#start').hidden = true;
  nameInput.blur();
}
$('#go').onclick = start;
nameInput.onkeydown = e => { if (e.key === 'Enter') start(); };

$('#chatter').onclick = () => socket.emit('chatter', !chatterOn);

// 판이 끝나거나 내가 탈락하면 다음 판은 직접 시작 (버튼은 화면 가운데에 새로 그려지므로 위임으로 받는다)
function restart() {
  if (role !== 'player' || !state) return;
  if (state.mode === 'cafe') {
    if (state.phase === 'closed') socket.emit('restart');
    return;
  }
  if (state.mode === 'alkkagi') {
    if (state.phase === 'intermission' || (state.phase !== 'waiting' && !state.counts.player)) socket.emit('restart');
    return;
  }
  const me = state.entities.find(e => e.id === 'player');
  if (state.phase === 'intermission' || (state.phase === 'playing' && me && !me.alive)) socket.emit('restart');
}
document.addEventListener('click', e => { if (e.target.closest('#again')) restart(); });

// ---------- 서버 소식 ----------

socket.on('role', r => { role = r; });

socket.on('state', s => {
  for (const e of s.entities ?? s.stones ?? []) {
    if (prevAlive[e.id] && !e.alive) fallAnim[e.id] = { at: performance.now(), x: e.x, y: e.y };
    prevAlive[e.id] = e.alive;
  }
  if (s.mode !== 'alkkagi' || s.phase !== 'turn' || s.turn !== 'player') aim = null;
  state = s;
  renderHud();
});

socket.on('status', s => {
  const pill = $('#discord');
  const text = { connected: '디스코드 연결됨', error: '디스코드 연결 실패', off: '디스코드 미연결' };
  pill.textContent = text[s.discord] || text.off;
  pill.className = `pill ${s.discord === 'connected' ? 'ok' : s.discord === 'error' ? 'bad' : ''}`;
  chatterOn = s.chatter;
  const btn = $('#chatter');
  btn.textContent = chatterOn ? '봇 수다 켜짐' : '봇 수다 꺼짐';
  btn.classList.toggle('off', !chatterOn);
});

socket.on('say', ({ id, text }) => {
  bubbles[id] = { text, until: performance.now() + 2500 + text.length * 90 };
});

// ---------- 효과음 (파일 없이 소리를 합성) ----------

let ac = null;
function initAudio() {
  try { ac = ac || new AudioContext(); ac.resume(); } catch {}
}

function tone(freq, dur, { type = 'square', vol = 0.07, to = null, at = 0 } = {}) {
  if (!ac) return;
  const t0 = ac.currentTime + at;
  const o = ac.createOscillator();
  const g = ac.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t0);
  if (to) o.frequency.exponentialRampToValueAtTime(to, t0 + dur);
  g.gain.setValueAtTime(vol, t0);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  o.connect(g).connect(ac.destination);
  o.start(t0);
  o.stop(t0 + dur + 0.02);
}

function noise(dur, { vol = 0.2, freq = 1000, q = 1 } = {}) {
  if (!ac) return;
  const len = Math.floor(ac.sampleRate * dur);
  const buf = ac.createBuffer(1, len, ac.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
  const src = ac.createBufferSource();
  const filter = ac.createBiquadFilter();
  const g = ac.createGain();
  src.buffer = buf;
  filter.type = 'bandpass';
  filter.frequency.value = freq;
  filter.Q.value = q;
  g.gain.setValueAtTime(vol, ac.currentTime);
  g.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + dur);
  src.connect(filter).connect(g).connect(ac.destination);
  src.start();
}

socket.on('fx', fx => {
  switch (fx.type) {
    case 'bump':
      noise(0.09, { vol: 0.15 + 0.35 * fx.power, freq: 500 + 600 * fx.power });
      tone(110 + 80 * fx.power, 0.1, { type: 'triangle', vol: 0.15 });
      break;
    case 'dash': noise(0.18, { vol: 0.1, freq: 2400, q: 0.7 }); break;
    case 'fall': tone(620, 0.7, { vol: 0.06, to: 80 }); break;
    case 'count': tone(660, 0.12); break;
    case 'go':
      tone(990, 0.3, { vol: 0.09 });
      goFlashUntil = performance.now() + 700;
      break;
    case 'win': [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.18, { at: i * 0.11 })); break;
    // 알까기
    case 'flick': noise(0.12, { vol: 0.12 + 0.2 * fx.power, freq: 1800, q: 0.8 }); break;
    case 'clack':
      noise(0.05, { vol: 0.2 + 0.4 * fx.power, freq: 2600, q: 2 });
      tone(900 + 500 * fx.power, 0.05, { type: 'triangle', vol: 0.12 });
      break;
    // 카페
    case 'ticket': tone(1180, 0.08, { vol: 0.05 }); tone(1480, 0.1, { vol: 0.05, at: 0.08 }); break;
    case 'good': [784, 988, 1319].forEach((f, i) => tone(f, 0.14, { type: 'triangle', vol: 0.09, at: i * 0.08 })); break;
    case 'bad': tone(330, 0.25, { type: 'sawtooth', vol: 0.05, to: 160 }); break;
    case 'turn':
      if (fx.who === 'player' && role === 'player') {
        tone(880, 0.12, { vol: 0.06 }); tone(1320, 0.16, { vol: 0.06, at: 0.1 });
        myTurnFlashUntil = performance.now() + 900;
      }
      break;
  }
});

// ---------- 키 입력 ----------

const keys = { up: false, down: false, left: false, right: false, dash: false };
const keyMap = {
  ArrowUp: 'up', KeyW: 'up', ArrowDown: 'down', KeyS: 'down',
  ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right', Space: 'dash',
};
function onKey(e, down) {
  if (document.activeElement === nameInput) return;
  if (down && e.code === 'Enter' && !e.repeat) { restart(); return; }
  const k = keyMap[e.code];
  if (!k) return;
  e.preventDefault();
  if (keys[k] === down) return;
  keys[k] = down;
  socket.emit('input', keys);
}
addEventListener('keydown', e => onKey(e, true));
addEventListener('keyup', e => onKey(e, false));
addEventListener('blur', () => {
  for (const k in keys) keys[k] = false;
  socket.emit('input', keys);
});

// ---------- HUD ----------

let lastScore = '';
const nameOf = id => id === 'player' ? state?.humanName : cfg?.bots.find(b => b.id === id)?.name ?? id;

function renderHud() {
  const s = state;
  if (s.mode === 'cafe') return renderCafeHud(s);
  const ak = s.mode === 'alkkagi';
  if (ak) {
    const turn = s.phase === 'turn' && s.turn
      ? ` · <span class="turn-pill">${s.turn === 'player' ? `${role === 'player' ? '내' : escapeHtml(nameOf('player')) + '의'} 차례 ${Math.max(0, Math.ceil(s.timer))}초` : `${escapeHtml(nameOf(s.turn))} 차례`}</span>`
      : '';
    $('#round').innerHTML = s.round ? `알까기 ${s.round}판${turn}` : '';
  } else {
    $('#round').textContent = s.round ? `${s.round}라운드` : '';
  }
  $('#helptext').textContent = ak ? '내 차례에 내 돌을 뒤로 끌었다 놓으면 튕겨 나가요' : '방향키 / WASD 이동 · 스페이스 돌진';
  $('#cd').hidden = ak;

  const ids = ['player', ...(cfg?.bots.map(b => b.id) ?? [])];
  const score = s.mode + ids.map(id => `${id}:${s.wins[id] || 0}`).join('|') + s.humanName;
  if (score !== lastScore && cfg) {
    lastScore = score;
    $('#score').innerHTML = ids.map(id => {
      return `<span class="who"><img src="img/${id}_sprite.png" alt=""><span>${escapeHtml(nameOf(id))}</span><b>${s.wins[id] || 0}</b></span>`;
    }).join('');
  }

  const center = $('#center');
  let html = '';
  if (ak) {
    if (s.phase === 'intermission') {
      const title = s.winner === 'player' && role === 'player' ? '내가 우승!' : `${escapeHtml(nameOf(s.winner))} 우승!`;
      html = `<div class="mid">${title}</div>` + (role === 'player'
        ? '<button id="again" class="again" type="button">다시 시작 <span>Enter</span></button>'
        : '<div class="small">플레이어가 다시 시작하길 기다리는 중</div>');
    } else if (s.phase !== 'waiting' && role === 'player' && !s.counts.player) {
      html = '<div class="mid">탈락!</div><div class="small">친구들 알까기 구경 중...</div>'
        + '<button id="again" class="again" type="button">다시하기 <span>Enter</span></button>';
    } else if (performance.now() < myTurnFlashUntil) {
      html = '<div class="mid">내 차례!</div>';
    }
  } else {
    const me = s.entities.find(e => e.id === 'player');
    $('#cdbar').style.width = `${me ? Math.round((1 - me.cd) * 100) : 0}%`;
    if (s.phase === 'countdown') {
      html = `<div class="big">${Math.max(1, Math.ceil(s.timer))}</div>`;
    } else if (s.phase === 'playing') {
      if (performance.now() < goFlashUntil) html = '<div class="big">투닥!</div>';
      else if (role === 'player' && me && !me.alive) {
        html = '<div class="mid">탈락!</div><div class="small">친구들 싸움 구경 중...</div>'
          + '<button id="again" class="again" type="button">다시하기 <span>Enter</span></button>';
      }
    } else if (s.phase === 'intermission') {
      const w = s.entities.find(e => e.id === s.winner);
      const title = s.winner === 'player' && role === 'player' ? '내가 우승!' : `${escapeHtml(w?.name ?? '')} 우승!`;
      html = `<div class="mid">${title}</div>` + (role === 'player'
        ? '<button id="again" class="again" type="button">다시 시작 <span>Enter</span></button>'
        : '<div class="small">플레이어가 다시 시작하길 기다리는 중</div>');
    }
  }
  if (s.phase === 'waiting' && role === 'spectator') {
    // 플레이어가 나가서 자리가 비면, 관전하던 사람이 이어서 할 수 있게 시작 화면을 다시 보여준다
    $('#start').hidden = false;
  }
  if (role === 'spectator' && s.phase !== 'waiting') html += '<div class="small">관전 중</div>';
  if (center.innerHTML !== html) center.innerHTML = html;
}

function escapeHtml(t) {
  return String(t).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

// ---------- 그리기 ----------

function resize() {
  const dpr = devicePixelRatio || 1;
  const w = Math.round(innerWidth * dpr), h = Math.round(innerHeight * dpr);
  if (canvas.width !== w || canvas.height !== h) {
    canvas.width = w;
    canvas.height = h;
  }
}

function wrap(text, max) {
  const lines = [];
  let line = '';
  for (const word of text.split(' ')) {
    if ((line + ' ' + word).trim().length > max && line) { lines.push(line); line = word; }
    else line = (line + ' ' + word).trim();
    while (line.length > max) { lines.push(line.slice(0, max)); line = line.slice(max); }
  }
  if (line) lines.push(line);
  return lines.slice(0, 3);
}

function roundRect(x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function drawBubble(x, y, text) {
  const lines = wrap(text, 14);
  ctx.font = '17px Jua, sans-serif';
  const w = Math.max(...lines.map(l => ctx.measureText(l).width)) + 22;
  const h = lines.length * 21 + 14;
  const bx = x - w / 2, by = y - h - 12;
  ctx.fillStyle = 'rgba(255,255,255,0.95)';
  roundRect(bx, by, w, h, 10);
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(x - 7, by + h);
  ctx.lineTo(x, by + h + 10);
  ctx.lineTo(x + 7, by + h);
  ctx.fill();
  ctx.fillStyle = '#22253a';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  lines.forEach((l, i) => ctx.fillText(l, x, by + 8 + i * 21));
}

function draw(now) {
  resize();
  const W = canvas.width, H = canvas.height;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = '#141826';
  ctx.fillRect(0, 0, W, H);
  if (!state || !cfg) return;
  if (state.mode === 'alkkagi') drawAlkkagi(now, W, H);
  else if (state.mode === 'cafe') drawCafe(now, W, H);
  else drawTudak(now, W, H);
}

function drawTudak(now, W, H) {
  const scale = Math.min(W, H) / (2 * cfg.R0 + 170);
  ctx.translate(W / 2, H / 2 + 12 * (devicePixelRatio || 1));
  ctx.scale(scale, scale);
  ctx.imageSmoothingEnabled = false;

  // 처음 경기장 크기 (점선)
  ctx.beginPath();
  ctx.arc(0, 0, cfg.R0, 0, TAU);
  ctx.setLineDash([10, 12]);
  ctx.strokeStyle = 'rgba(255,255,255,0.12)';
  ctx.lineWidth = 3;
  ctx.stroke();
  ctx.setLineDash([]);

  // 지금 경기장
  const R = state.R;
  const shrinking = state.phase === 'playing' && R < cfg.R0 - 0.5;
  ctx.beginPath();
  ctx.arc(0, 0, R, 0, TAU);
  ctx.fillStyle = '#f3e2bf';
  ctx.fill();
  ctx.lineWidth = 10;
  ctx.strokeStyle = shrinking ? `rgba(255,90,90,${0.55 + 0.35 * Math.sin(now / 120)})` : '#c9a36a';
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(0, 0, Math.max(0, R * 0.35), 0, TAU);
  ctx.strokeStyle = 'rgba(201,163,106,0.35)';
  ctx.lineWidth = 3;
  ctx.stroke();

  const r = cfg.PR;
  const size = r * 32 / 12;   // 스프라이트 몸통 반지름이 그림의 12/32
  const list = [...state.entities].sort((a, b) => a.y - b.y);

  for (const e of list) {
    let k = 1;
    if (!e.alive) {
      const st = fallAnim[e.id];
      if (!st) continue;
      const p = (now - st.at) / 700;
      if (p >= 1) continue;
      k = 1 - p;
      ctx.globalAlpha = 1 - p;
    }
    if (e.alive) {
      ctx.fillStyle = 'rgba(0,0,0,0.18)';
      ctx.beginPath();
      ctx.ellipse(e.x, e.y + r * 0.85, r * 0.95, r * 0.35, 0, 0, TAU);
      ctx.fill();
    }
    if (e.id === 'player' && e.alive) {
      ctx.beginPath();
      ctx.arc(e.x, e.y, r + 7, 0, TAU);
      ctx.strokeStyle = 'rgba(124,224,124,0.8)';
      ctx.lineWidth = 3;
      ctx.stroke();
    }
    if (e.dash) {
      ctx.beginPath();
      ctx.arc(e.x, e.y, r + 10, 0, TAU);
      ctx.strokeStyle = 'rgba(255,255,255,0.75)';
      ctx.lineWidth = 5;
      ctx.stroke();
    }
    const img = sprites[e.id];
    if (img?.complete) {
      const sz = size * k;
      ctx.drawImage(img, e.x - sz / 2 + sz / 64, e.y - sz / 2 - sz * 3 / 32, sz, sz);
    }
    ctx.globalAlpha = 1;

    if (e.alive) {
      ctx.font = '16px Jua, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.lineWidth = 4;
      ctx.strokeStyle = 'rgba(20,24,38,0.85)';
      const label = e.id === 'player' ? `${e.name} (나)` : e.name;
      ctx.strokeText(label, e.x, e.y + r + 8);
      ctx.fillStyle = '#fff';
      ctx.fillText(label, e.x, e.y + r + 8);
    }
  }

  // 말풍선은 맨 위에 (떨어진 봇도 원래 자리 근처에 보여준다)
  for (const e of list) {
    const b = bubbles[e.id];
    if (!b) continue;
    if (now > b.until) { delete bubbles[e.id]; continue; }
    const x = e.alive ? e.x : Math.max(-R, Math.min(R, e.x));
    const y = e.alive ? e.y : Math.max(-R, Math.min(R, e.y));
    drawBubble(x, y - r - 6, b.text);
  }
}

// ---------- 알까기 ----------

const SEATS = B => ({ player: [0, B + 75], coco: [-B - 85, 0], lovey: [0, -B - 75], rou: [B + 85, 0] });
const colorOf = id => id === 'player' ? cfg.player.color : cfg.bots.find(b => b.id === id)?.color ?? '#ccc';

function line(x1, y1, x2, y2) {
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
}

function outlinedText(text, x, y, size = 16, color = '#fff') {
  ctx.font = `${size}px Jua, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.lineWidth = 4;
  ctx.strokeStyle = 'rgba(20,24,38,0.85)';
  ctx.strokeText(text, x, y);
  ctx.fillStyle = color;
  ctx.fillText(text, x, y);
}

function drawAlkkagi(now, W, H) {
  const { B, SR, DRAG_MAX } = cfg.alkkagi;
  const dpr = devicePixelRatio || 1;
  const scale = Math.min(W / (2 * B + 340), (H - 120 * dpr) / (2 * B + 240));
  const ox = W / 2, oy = H / 2 + 34 * dpr;
  view = { scale, ox, oy, dpr };
  ctx.translate(ox, oy);
  ctx.scale(scale, scale);

  // 판: 나무 테두리 + 바둑판 격자
  ctx.fillStyle = '#7a5530';
  roundRect(-B - 14, -B - 14, 2 * B + 28, 2 * B + 28, 12);
  ctx.fill();
  ctx.fillStyle = '#e8c88e';
  ctx.fillRect(-B, -B, 2 * B, 2 * B);
  ctx.strokeStyle = 'rgba(90,60,25,0.4)';
  ctx.lineWidth = 1.5;
  for (let i = 1; i < 12; i++) {
    const q = -B + (2 * B) * i / 12;
    line(q, -B, q, B);
    line(-B, q, B, q);
  }
  ctx.fillStyle = 'rgba(90,60,25,0.6)';
  for (const [x, y] of [[-B / 2, -B / 2], [B / 2, -B / 2], [-B / 2, B / 2], [B / 2, B / 2], [0, 0]]) {
    ctx.beginPath();
    ctx.arc(x, y, 4, 0, TAU);
    ctx.fill();
  }

  // 자리: 얼굴, 이름, 남은 돌
  const seats = SEATS(B);
  for (const [id, [sx, sy]] of Object.entries(seats)) {
    const left = state.counts[id] ?? 0;
    ctx.globalAlpha = left ? 1 : 0.35;
    if (state.phase === 'turn' && state.turn === id) {
      ctx.beginPath();
      ctx.arc(sx, sy - 6, 40 + 3 * Math.sin(now / 150), 0, TAU);
      ctx.strokeStyle = colorOf(id);
      ctx.lineWidth = 5;
      ctx.stroke();
    }
    const img = sprites[id];
    if (img?.complete) ctx.drawImage(img, sx - 34, sy - 44, 68, 68);
    outlinedText(id === 'player' ? `${nameOf(id)} (나)` : nameOf(id), sx, sy + 22);
    for (let i = 0; i < 3; i++) {
      ctx.beginPath();
      ctx.arc(sx - 18 + i * 18, sy + 50, 6, 0, TAU);
      ctx.fillStyle = i < left ? colorOf(id) : 'rgba(255,255,255,0.12)';
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  // 돌 (떨어진 돌은 떨어진 자리에서 작아지며 사라짐)
  const myTurn = role === 'player' && state.phase === 'turn' && state.turn === 'player';
  for (const s of state.stones) {
    let k = 1, x = s.x, y = s.y;
    if (!s.alive) {
      const st = fallAnim[s.id];
      if (!st) continue;
      const p = (now - st.at) / 500;
      if (p >= 1) continue;
      k = 1 - p * 0.6;
      x = st.x; y = st.y;
      ctx.globalAlpha = 1 - p;
    }
    const r = SR * k;
    ctx.fillStyle = 'rgba(0,0,0,0.22)';
    ctx.beginPath();
    ctx.ellipse(x + 3, y + 5, r, r * 0.9, 0, 0, TAU);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(x, y, r, 0, TAU);
    ctx.fillStyle = colorOf(s.owner);
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = 'rgba(0,0,0,0.35)';
    ctx.stroke();
    const img = sprites[s.owner];
    if (img?.complete) ctx.drawImage(img, x - r * 0.95, y - r * 1.1, r * 1.9, r * 1.9);
    if (s.alive && state.phase === 'turn' && state.turn === s.owner) {
      ctx.beginPath();
      ctx.arc(x, y, r + 5 + 2 * Math.sin(now / 130), 0, TAU);
      ctx.strokeStyle = myTurn ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.45)';
      ctx.lineWidth = 3;
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  // 조준: 끈 줄 + 나갈 방향 화살표 (세기에 따라 초록 → 빨강)
  const s = aim && state.stones.find(x => x.id === aim.stone && x.alive);
  if (s) {
    const dx = aim.px - s.x, dy = aim.py - s.y, len = Math.hypot(dx, dy);
    if (len > 8) {
      const pw = Math.min(1, len / DRAG_MAX);
      const pull = Math.min(len, DRAG_MAX);
      ctx.strokeStyle = 'rgba(255,255,255,0.75)';
      ctx.lineWidth = 3;
      line(s.x, s.y, s.x + dx / len * pull, s.y + dy / len * pull);
      const ux = -dx / len, uy = -dy / len, L = 60 + 280 * pw;
      const col = `hsl(${120 - 120 * pw}, 80%, 55%)`;
      ctx.setLineDash([12, 9]);
      ctx.strokeStyle = col;
      ctx.lineWidth = 5;
      line(s.x + ux * SR, s.y + uy * SR, s.x + ux * L, s.y + uy * L);
      ctx.setLineDash([]);
      ctx.fillStyle = col;
      ctx.beginPath();
      ctx.moveTo(s.x + ux * (L + 18), s.y + uy * (L + 18));
      ctx.lineTo(s.x + ux * L - uy * 11, s.y + uy * L + ux * 11);
      ctx.lineTo(s.x + ux * L + uy * 11, s.y + uy * L - ux * 11);
      ctx.fill();
      outlinedText(`${Math.round(pw * 100)}%`, s.x + dx / len * (pull + 26), s.y + dy / len * (pull + 26) - 10, 18, col);
    }
  }

  // 말풍선: 자리 위 (왼쪽·오른쪽 자리는 판 안쪽으로 조금 당김)
  for (const [id, [sx, sy]] of Object.entries(seats)) {
    const b = bubbles[id];
    if (!b) continue;
    if (now > b.until) { delete bubbles[id]; continue; }
    drawBubble(sx + (id === 'coco' ? 70 : id === 'rou' ? -70 : 0), sy - 44, b.text);
  }
}

// 알까기 조준: 내 돌을 누르고 뒤로 끌었다 놓으면, 끈 반대 방향으로 끈 만큼 세게 나간다
function toWorld(ev) {
  const r = canvas.getBoundingClientRect();
  const px = (ev.clientX - r.left) * view.dpr, py = (ev.clientY - r.top) * view.dpr;
  return { x: (px - view.ox) / view.scale, y: (py - view.oy) / view.scale };
}

canvas.addEventListener('pointerdown', ev => {
  if (state?.mode !== 'alkkagi' || role !== 'player' || state.phase !== 'turn' || state.turn !== 'player' || !view) return;
  const p = toWorld(ev);
  const near = state.stones.filter(x => x.alive && x.owner === 'player')
    .map(x => ({ x, d: Math.hypot(x.x - p.x, x.y - p.y) })).sort((a, b) => a.d - b.d)[0];
  if (!near || near.d > cfg.alkkagi.SR * 2) return;
  initAudio();
  aim = { stone: near.x.id, px: p.x, py: p.y };
  canvas.setPointerCapture(ev.pointerId);
  ev.preventDefault();
});
canvas.addEventListener('pointermove', ev => {
  if (!aim) return;
  const p = toWorld(ev);
  aim.px = p.x;
  aim.py = p.y;
});
canvas.addEventListener('pointerup', () => {
  if (!aim) return;
  const s = state.stones.find(x => x.id === aim.stone);
  if (s) socket.emit('shot', { stone: aim.stone, dx: aim.px - s.x, dy: aim.py - s.y });
  aim = null;
});
canvas.addEventListener('pointercancel', () => { aim = null; });

function loop(now) {
  draw(now);
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);
