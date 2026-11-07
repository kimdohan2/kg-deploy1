// Show me the burger — 화면 쪽.
//   위: 매장 배경 + 손님(그림 한 장을 숨쉬기·박자·입 모양으로 움직임), 아래: 포스기.
//   서버(server/burger.js)가 손님과 곡을 정하고, 주문 완료 때 채점·손님 봇 반응(Hermes)을 맡는다.
const socket = io();
const $ = id => document.getElementById(id);
const cv = $('c');
const ctx = cv.getContext('2d');
const W = cv.width, H = cv.height;

// ── 무대 ──
const BG_Y = -60;          // 배경(1536×1024)을 위로 60 올려서 16:9로 자름
const COUNTER = 690;       // 계산대 윗선 (이 아래로는 손님을 안 그림)
const BOTTOM = 742;        // 손님 그림 아래 끝
const SIZE = 600;          // 손님 그림 크기 (원본 640)
const SPOTS = { 1: [768], 2: [560, 980] };
// 손님 그림(640)에서 입 위치: 입 벌린 그림을 이 타원 안만 덧그린다
const MOUTH = { coco: { x: 319, y: 289, rx: 57, ry: 40 }, lovey: { x: 327, y: 263, rx: 50, ry: 40 }, rou: { x: 316, y: 252, rx: 50, ry: 40 } };
const NAMES = { coco: '코코', lovey: '러비', rou: '루' };
const CATS = [['burger', '버거'], ['side', '사이드'], ['drink', '음료']];
const VERDICT = {
  perfect: ['⭐', '완벽해요!', '한 번에 다 맞혔어요'],
  close: ['◐', '아슬아슬', '다시 듣고 맞혔어요'],
  wrong: ['✗', '주문이 달라요', ''],
  timeout: ['⏱', '시간 초과', '손님이 기다리다 갔어요'],
};

const load = src => new Promise(r => { const i = new Image(); i.onload = () => r(i); i.onerror = () => r(null); i.src = src; });
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

let img = {}, menu = null, items = {};
let state = 'start';         // start · enter · rap · after · result · leave · end
let song = null, afterSec = 15, actors = [], vocal = [];
let order = new Map();       // 메뉴 id → 개수 (넣은 순서 유지)
let replaysLeft = 1, afterAt = 0, awaitUntil = 0, progress = [], teamNo = 0, teams = 3;

// ── 소리 ──
const audio = new Audio();
let ac = null, analyser = null, level = 0, slow = 0, mouthOpen = false, mouthSince = 0;
const freq = new Uint8Array(512);
function setupAudio() {
  if (ac) return ac.resume();
  ac = new AudioContext();
  analyser = ac.createAnalyser();
  analyser.fftSize = 1024;
  ac.createMediaElementSource(audio).connect(analyser).connect(ac.destination);
}
// 목소리 크기: 사람 목소리 대역(약 300~3000Hz)만 본다 (드럼·베이스에 입이 안 움직이게)
function voiceLevel() {
  if (!analyser || audio.paused) return 0;
  analyser.getByteFrequencyData(freq);
  const hz = ac.sampleRate / 1024;
  let sum = 0, n = 0;
  for (let i = Math.floor(300 / hz); i < 3000 / hz; i++) { sum += freq[i]; n++; }
  return sum / n / 255;
}
const rapping = () => !audio.paused && !audio.ended && (state === 'rap');
const whoAt = t => vocal.find(v => t >= v.from && t < v.to)?.who || null;

audio.addEventListener('ended', () => {
  if (state !== 'rap') return;
  state = 'after';
  afterAt = performance.now();
  updateUI();
});

// ── 그림 ──
const mouthLayers = {};
function buildMouth(id) {
  const c = document.createElement('canvas');
  c.width = c.height = 640;
  const m = c.getContext('2d'), M = MOUTH[id];
  m.drawImage(img[`${id}-mouth`], 0, 0);
  m.globalCompositeOperation = 'destination-in';
  const k = M.ry / M.rx;
  m.setTransform(1, 0, 0, k, 0, M.y * (1 - k));
  const g = m.createRadialGradient(M.x, M.y, 4, M.x, M.y, M.rx);
  g.addColorStop(0, '#000'); g.addColorStop(0.72, '#000'); g.addColorStop(1, 'rgba(0,0,0,0)');
  m.fillStyle = g;
  m.fillRect(0, 0, 640, 640 / k);
  mouthLayers[id] = c;
}

function drawActor(a, now, t, at) {
  const enter = clamp((now - a.enterAt) / 600, 0, 1);
  const e = 1 - (1 - enter) ** 3;
  let alpha = e, dx = 0, dy = (1 - e) * 70;
  if (a.leaveAt) {
    const l = clamp((now - a.leaveAt) / 450, 0, 1);
    alpha *= 1 - l;
    dx += l * 160 * a.side;
  }
  if (alpha <= 0) return;
  let sy = 1 + 0.012 * Math.sin(t * 2.6 + a.phase);
  dy += 3 * Math.sin(t * 1.3 + a.phase);
  let rot = 0.008 * Math.sin(t * 0.9 + a.phase);
  const active = rapping() && whoAt(at) === a.id;
  if (rapping()) {   // 박자에 맞춰 고개 까딱 (랩하는 사람은 크게, 옆 사람은 살짝)
    const beat = at * (song.bpm / 60) * Math.PI;
    dy += (active ? 9 * (0.5 + level) : 3) * Math.abs(Math.sin(beat));
    rot += (active ? 0.03 : 0.012) * Math.sin(beat / 2);
  }
  const since = (now - a.moodAt) / 1000;
  if (a.mood === 'happy') {
    const b = Math.max(0, 1 - since / 1.2);
    dy -= 30 * Math.abs(Math.sin(since * Math.PI * 3.3)) * b;
    sy *= 1 + 0.03 * Math.sin(since * Math.PI * 6.6) * b;
  } else if (a.mood === 'angry') {
    const b = Math.max(0, 1 - since / 0.7);
    dx += 7 * Math.sin(since * 70) * b;
    rot += 0.02 * Math.sin(since * 50) * b;
  }
  const face = img[`${a.id}-${a.mood || 'base'}`];
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.beginPath();
  ctx.rect(0, 0, W, COUNTER);
  ctx.clip();
  ctx.translate(a.cx + dx, BOTTOM + dy);
  ctx.rotate(rot);
  ctx.scale(1, sy);
  ctx.drawImage(face, -SIZE / 2, -SIZE, SIZE, SIZE);
  if (!a.mood && active && mouthOpen) ctx.drawImage(mouthLayers[a.id], -SIZE / 2, -SIZE, SIZE, SIZE);
  ctx.restore();
}

function draw(now) {
  const t = now / 1000;
  ctx.drawImage(img.bg, 0, BG_Y);
  const raw = voiceLevel();
  level += (raw - level) * 0.5;      // 빠르게 따라감
  slow += (raw - slow) * 0.06;       // 천천히 따라감 (비트가 깔린 평균)
  const at = audio.currentTime || 0;
  // 입: 랩 구간에서 소리가 평균보다 툭 커질 때 열고, 열리면 최소 0.07초·닫히면 최소 0.05초 유지
  const want = rapping() && !!whoAt(at) && level > slow * 1.04;
  if (want !== mouthOpen && now - mouthSince > (mouthOpen ? 70 : 50)) { mouthOpen = want; mouthSince = now; }
  for (const a of actors) drawActor(a, now, t, at);
  tickTimer(now);
  requestAnimationFrame(draw);
}

// ── 시간 제한 ──
let lastShown = '';
function tickTimer(now) {
  const box = document.querySelector('.timer');
  if (state !== 'after') { box.classList.remove('on'); return; }
  const left = afterSec - (now - afterAt) / 1000;
  box.classList.add('on');
  box.classList.toggle('low', left < 5);
  $('timerbar').style.transform = `scaleX(${clamp(left / afterSec, 0, 1)})`;
  const text = `⏱ ${Math.max(0, Math.ceil(left))}초 안에 주문 완료!`;
  if (text !== lastShown) { $('status').textContent = text; lastShown = text; }
  if (left <= 0) submit(true);
}

// ── 포스기 ──
function buildMenu() {
  $('menu').innerHTML = CATS.map(([cat, label]) => `<div class="cat"><b>${label}</b>${menu[cat].map(m =>
    `<button type="button" class="item" data-id="${m.id}"><img src="img/menu/${m.id}.jpg" alt="">${esc(m.name)}<span class="n" hidden></span></button>`).join('')}</div>`).join('');
  for (const b of document.querySelectorAll('.item')) b.onclick = () => add(b.dataset.id, 1);
}
const canOrder = () => state === 'rap' || state === 'after' || state === 'enter';
function add(id, d) {
  if (!canOrder()) return;
  const q = (order.get(id) || 0) + d;
  if (q <= 0) order.delete(id); else order.set(id, Math.min(9, q));
  renderOrder();
}
function renderOrder() {
  $('lines').innerHTML = [...order].map(([id, q]) =>
    `<li><span>${esc(items[id].name)}</span><button type="button" data-id="${id}" data-d="-1" aria-label="빼기">−</button><b>${q}</b><button type="button" data-id="${id}" data-d="1" aria-label="더하기">+</button></li>`).join('');
  for (const b of $('lines').querySelectorAll('button')) b.onclick = () => add(b.dataset.id, Number(b.dataset.d));
  for (const b of document.querySelectorAll('.item')) {
    const n = b.querySelector('.n'), q = order.get(b.dataset.id) || 0;
    n.hidden = !q;
    n.textContent = q;
  }
}
$('clear').onclick = () => { if (canOrder()) { order.clear(); renderOrder(); } };

function updateUI() {
  const live = canOrder();
  $('pos').classList.toggle('off', !live);
  for (const b of document.querySelectorAll('.item, #clear, #submit, #lines button')) b.disabled = !live;
  const r = $('replay');
  r.textContent = replaysLeft ? '🔁 다시 듣기 (1번)' : '🔁 다시 듣기 다 씀';
  r.disabled = !(state === 'after' && replaysLeft > 0);
  if (state === 'enter') $('status').textContent = `손님 ${teamNo}/${teams} 들어와요…`;
  else if (state === 'rap') $('status').textContent = '🎤 랩 듣는 중 · 들으면서 찍으세요!';
  else if (state === 'result' || state === 'leave') $('status').textContent = '';
  lastShown = '';
  $('progress').innerHTML = Array.from({ length: teams }, (_, i) =>
    `<span class="${i === teamNo - 1 && !progress[i] ? 'now' : ''}" title="손님 ${i + 1}">${progress[i] ? VERDICT[progress[i]][0] : i + 1}</span>`).join('');
}

// ── 흐름 ──
const emit = (ev, data) => new Promise(r => socket.emit(ev, data, r));

function showCustomer(res) {
  song = res.song;
  afterSec = res.afterSec;
  teamNo = res.n;
  teams = res.of;
  replaysLeft = 1;
  order.clear();
  renderOrder();
  $('receipt').hidden = true;
  $('bubbles').innerHTML = '';
  let t = 0;
  vocal = [];
  for (const p of song.parts) {
    if (p.vocal) vocal.push({ who: p.who, from: t / 1000, to: (t + p.ms) / 1000 });
    t += p.ms;
  }
  const spots = SPOTS[song.customers.length];
  const now = performance.now();
  actors = song.customers.map((id, i) => ({ id, cx: spots[i], side: i ? 1 : -1, enterAt: now + i * 180, leaveAt: 0, mood: null, moodAt: 0, phase: i * 1.7 }));
  state = 'enter';
  updateUI();
  audio.src = song.audio;
  audio.load();
  setTimeout(async () => {
    if (state !== 'enter') return;
    state = 'rap';
    updateUI();
    try { await audio.play(); } catch { state = 'after'; afterAt = performance.now(); updateUI(); }
  }, 800);
}

async function startShift() {
  setupAudio();
  $('overlay').hidden = true;
  progress = [];
  const res = await emit('burger_start');
  if (res?.type === 'customer') showCustomer(res);
}
$('go').onclick = startShift;

$('replay').onclick = async () => {
  if (state !== 'after' || !replaysLeft) return;
  const r = await emit('burger_replay');
  if (!r?.ok) return;
  replaysLeft = 0;
  state = 'rap';
  updateUI();
  audio.currentTime = 0;
  audio.play().catch(() => {});
};

let submitting = false;
async function submit(timeout = false) {
  if (submitting || !canOrder()) return;
  submitting = true;
  audio.pause();
  state = 'result';
  updateUI();
  const res = await emit('burger_submit', { entered: [...order].map(([item, qty]) => ({ item, qty })), timeout });
  submitting = false;
  if (!res) return;
  progress[teamNo - 1] = res.verdict;
  const mood = res.verdict === 'perfect' || res.verdict === 'close' ? 'happy' : 'angry';
  for (const a of actors) { a.mood = mood; a.moodAt = performance.now(); }
  awaitUntil = Date.now() + 30000;
  showReceipt(res);
  updateUI();
}
$('submit').onclick = () => submit(false);

function showReceipt(res) {
  const [icon, title, note] = VERDICT[res.verdict];
  const want = new Map(res.answer.map(o => [o.item, o.qty])), got = new Map(res.entered.map(o => [o.item, o.qty]));
  const ids = [...new Set([...want.keys(), ...got.keys()])];
  const rows = ids.map(id => {
    const w = want.get(id) || 0, g = got.get(id) || 0, ok = w === g;
    return `<tr><td><img src="img/menu/${id}.jpg" alt="">${esc(items[id].name)}</td><td>${w || '-'}</td><td>${g || '-'}</td><td class="${ok ? 'ok' : 'no'}">${ok ? '✓' : '✗'}</td></tr>`;
  }).join('');
  // 가사에서 메뉴 이름에 색칠 (주문한 것은 분홍, 함정은 회색 줄)
  const words = [...res.answer.flatMap(o => items[o.item].say.map(w => [w, 'o'])), ...res.decoys.flatMap(d => items[d].say.map(w => [w, 'd']))]
    .sort((a, b) => b[0].length - a[0].length);
  const re = words.length ? new RegExp(words.map(([w]) => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|'), 'gi') : null;
  const kind = Object.fromEntries(words.map(([w, k]) => [w.toLowerCase(), k]));
  const hi = line => re ? esc(line).replace(re, w => `<mark class="${kind[w.toLowerCase()] === 'd' ? 'decoy' : ''}">${w}</mark>`) : esc(line);
  const lyrics = res.lyrics.map(p => `<p class="tag" style="color:var(--${p.who})">[${esc(p.part)}] ${NAMES[p.who]}</p>${p.lines.map(l => `<p>${hi(l)}</p>`).join('')}`).join('');
  const sub = note || [res.missing.length && `빠뜨림: ${res.missing.join(', ')}`, res.wrong.length && `개수 틀림: ${res.wrong.join(', ')}`, res.extra.length && `안 시킨 것: ${res.extra.join(', ')}`].filter(Boolean).join(' · ');
  const box = $('receipt');
  box.innerHTML = `
    <div class="verdict ${res.verdict}"><span>${icon} ${title}</span><small>${esc(sub)}</small>
      <button type="button" class="next" id="next">${res.last ? '영업 결과 보기 ▶' : '다음 손님 ▶'}</button></div>
    <table class="compare"><tr><th>메뉴</th><th>주문</th><th>내가 찍음</th><th></th></tr>${rows}</table>
    <div class="lyrics">${lyrics}</div>
    <p class="hint">${res.spoken ? '손님 반응은 디스코드 음성방에서 들려요.' : ''}</p>`;
  box.hidden = false;
  $('next').onclick = nextCustomer;
}

async function nextCustomer() {
  if (state !== 'result') return;
  state = 'leave';
  updateUI();
  const now = performance.now();
  for (const a of actors) a.leaveAt = now;
  $('bubbles').innerHTML = '';
  awaitUntil = 0;
  const [res] = await Promise.all([emit('burger_next'), new Promise(r => setTimeout(r, 500))]);
  if (res?.type === 'customer') return showCustomer(res);
  if (res?.type === 'end') showEnd(res.results);
}

function showEnd(results) {
  state = 'end';
  actors = [];
  order.clear();
  renderOrder();
  $('receipt').hidden = true;
  updateUI();
  const perfect = results.filter(r => r.verdict === 'perfect').length;
  const close = results.filter(r => r.verdict === 'close').length;
  const msg = perfect === results.length ? 'Show me the burger! 완벽한 알바예요 🍔'
    : perfect + close === results.length ? '다 맞혔어요! 다음엔 한 번에 맞혀 봐요.'
    : perfect + close ? '절반의 성공. 랩을 끝까지 잘 들어 봐요!' : '오늘은 손님들이 화났어요… 다시 도전!';
  $('overlay').innerHTML = `<div class="card">
    <h1>영업 끝!</h1>
    <p class="sub">${msg}</p>
    <ul class="results">${results.map(r => `<li>${r.customers.map(c => `<img src="img/${c}-base.png" alt="">`).join('')}
      <span class="who">${r.customers.map(c => NAMES[c]).join(' + ')} <span class="lv">${r.level}</span></span>
      <span class="v">${VERDICT[r.verdict][0]} ${VERDICT[r.verdict][1]}</span></li>`).join('')}</ul>
    <div class="buttons"><button type="button" class="go" id="again">한 판 더</button><a href="../">다른 게임</a></div>
  </div>`;
  $('overlay').hidden = false;
  $('again').onclick = startShift;
}

// ── 말풍선 (손님 봇이 Hermes로 한 말) ──
socket.on('say', ({ id, text }) => {
  const a = actors.find(x => x.id === id);
  if (!a || Date.now() > awaitUntil) return;
  const b = document.createElement('div');
  b.className = 'bubble';
  b.style.left = `${(a.cx / W) * 100}%`;
  b.textContent = text;
  $('bubbles').querySelector(`[data-id="${id}"]`)?.remove();
  b.dataset.id = id;
  $('bubbles').appendChild(b);
  a.moodAt = performance.now();   // 말할 때 한 번 더 들썩
  setTimeout(() => b.remove(), 9000);
});
socket.on('status', s => {
  const on = s.discord === 'connected' && s.chatter;
  $('discord').textContent = on ? '디스코드 연결됨' : '디스코드 꺼짐 · 말풍선만';
  $('discord').classList.toggle('on', on);
});

// ── 시작 ──
Promise.all([
  fetch('data/menu.json').then(r => r.json()),
  ...['bg.jpg', ...['coco', 'lovey', 'rou'].flatMap(id => ['base', 'mouth', 'happy', 'angry'].map(s => `${id}-${s}.png`))].map(f => load(`img/${f}`)),
]).then(([m, bg, ...faces]) => {
  menu = m;
  items = Object.fromEntries(Object.values(m).flat().map(x => [x.id, x]));
  img.bg = bg;
  let k = 0;
  for (const id of ['coco', 'lovey', 'rou']) for (const s of ['base', 'mouth', 'happy', 'angry']) img[`${id}-${s}`] = faces[k++];
  for (const id of ['coco', 'lovey', 'rou']) buildMouth(id);
  buildMenu();
  updateUI();
  requestAnimationFrame(draw);
});
