// Show me the burger — 화면 쪽.
//   위: 매장 배경 + 손님(그림 한 장을 숨쉬기·박자·입 모양으로 움직임), 아래: 포스기.
//   서버(server/burger.js)가 손님과 곡을 정하고, 주문 완료 때 채점·손님 봇 반응(Hermes)을 맡는다.
const socket = io();
const $ = id => document.getElementById(id);
const cv = $('c');
const ctx = cv.getContext('2d');
let W = cv.width;            // 무대 가로: 화면 비율에 맞춰 fit()이 바꾼다 (세로 H는 864 고정)
const H = cv.height;

// ── 무대 ──
const BG_Y = -60;          // 배경(3072×1024)을 위로 60 올려서 높이 864로 자름
const BG_W = 3072;         // 배경 가로 (양옆을 이어 그린 넓은 그림)
const SCENE_X = 1700;      // 배경에서 손님이 서는 가운데 (케첩·냅킨과 포스기 사이)
const MIN_A = 16 / 9, MAX_A = 3.5;   // 무대 가로세로 비율: 화면이 넓으면 이 안에서 옆으로 넓어진다
const COUNTER = 690;       // 계산대 윗선 (이 아래로는 손님을 안 그림)
const BOTTOM = 742;        // 손님 그림 아래 끝
const SIZE = 600;          // 손님 그림 크기 (원본 640)
const SPOTS = { 1: [0], 2: [-208, 212] };   // 가운데(SCENE_X)에서 떨어진 거리
const bgX = () => clamp(W / 2 - SCENE_X, W - BG_W, 0);   // 손님 자리가 무대 가운데 오게, 배경 끝은 안 보이게
const ax = a => SCENE_X + bgX() + a.off;                  // 손님이 무대에서 서는 x
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
let state = 'start';         // start · enter · greet(인사) · ready(주문 시작 기다림) · rap · after · result · leave · end
let song = null, actors = [], vocal = [];
let order = new Map();       // 메뉴 id → 개수 (넣은 순서 유지)
let replaysLeft = 1, afterAt = 0, awaitUntil = 0, progress = [], teamNo = 0, teams = 3;
let greetings = {}, greeter = null, lastGreet = {}, speaker = null, hurrySent = false;
let talker = null, voiceUrl = null;   // 지금 말하는 손님 (인사말·감탄사·주문 완료 한마디)
let maxAsks = 3, asksLeft = 3, askWaiting = false, askWho = null;   // 디스코드로 손님에게 되묻기
const HURRY_AFTER_MS = 20000;   // 랩이 끝나고 이만큼 안 찍으면 가끔 손님이 재촉 (확률은 서버가)

// ── 소리 ──
const audio = new Audio();
const greetAudio = new Audio();   // 손님 목소리 (인사말·감탄사·주문 완료 한마디) — 랩과 따로, 입 움직임에 씀
let ac = null, analyser = null, level = 0, slow = 0, mouthOpen = false, mouthSince = 0;
const freq = new Uint8Array(512);
function setupAudio() {
  if (ac) return ac.resume();
  ac = new AudioContext();
  analyser = ac.createAnalyser();
  analyser.fftSize = 1024;
  analyser.connect(ac.destination);
  ac.createMediaElementSource(audio).connect(analyser);
  ac.createMediaElementSource(greetAudio).connect(analyser);
}
// 목소리 크기: 사람 목소리 대역(약 300~3000Hz)만 본다 (드럼·베이스에 입이 안 움직이게)
function voiceLevel() {
  if (!analyser || (audio.paused && greetAudio.paused)) return 0;
  analyser.getByteFrequencyData(freq);
  const hz = ac.sampleRate / 1024;
  let sum = 0, n = 0;
  for (let i = Math.floor(300 / hz); i < 3000 / hz; i++) { sum += freq[i]; n++; }
  return sum / n / 255;
}
const rapping = () => !audio.paused && !audio.ended && (state === 'rap');
const talking = () => !!talker && !greetAudio.paused && !greetAudio.ended;

// 손님 목소리 틀기: 한 번에 하나만 (새로 틀면 앞의 것은 멈춤). 끝나거나 못 틀면 onEnd
function playVoice(who, src, onEnd = () => {}) {
  greetAudio.onended = greetAudio.onerror = null;
  greetAudio.pause();
  talker = who;
  let ended = false;
  const end = () => { if (ended) return; ended = true; if (talker === who) talker = null; onEnd(); };
  greetAudio.onended = greetAudio.onerror = end;
  greetAudio.src = src;
  greetAudio.play().catch(end);
}
function stopVoice() {
  greetAudio.onended = greetAudio.onerror = null;
  greetAudio.pause();
  talker = null;
}

// ── 효과음 (파일 없이 합성, 랩 소리와 따로 나가서 입 움직임에는 안 섞임) ──
function tone(freq, dur, { type = 'sine', vol = 0.1, to = null, at = 0 } = {}) {
  if (!ac) return;
  const t0 = ac.currentTime + at;
  const o = ac.createOscillator(), g = ac.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t0);
  if (to) o.frequency.exponentialRampToValueAtTime(to, t0 + dur);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(vol, t0 + 0.005);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  o.connect(g).connect(ac.destination);
  o.start(t0);
  o.stop(t0 + dur + 0.02);
}
function noise(dur, { vol = 0.1, freq = 3000, q = 1, at = 0 } = {}) {
  if (!ac) return;
  const t0 = ac.currentTime + at;
  const buf = ac.createBuffer(1, Math.floor(ac.sampleRate * dur), ac.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (0.6 + 0.4 * Math.sin(i / 90));   // 지지직
  const src = ac.createBufferSource(), f = ac.createBiquadFilter(), g = ac.createGain();
  src.buffer = buf;
  f.type = 'bandpass'; f.frequency.value = freq; f.Q.value = q;
  g.gain.setValueAtTime(vol, t0);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  src.connect(f).connect(g).connect(ac.destination);
  src.start(t0);
}
const SFX = {
  tap: () => tone(2093, 0.07, { type: 'square', vol: 0.07 }),                                  // 포스기 삑
  minus: () => tone(1175, 0.07, { type: 'square', vol: 0.06 }),
  clear: () => { tone(988, 0.07, { type: 'square', vol: 0.06 }); tone(659, 0.1, { type: 'square', vol: 0.06, at: 0.08 }); },
  door: () => { tone(1319, 0.5, { vol: 0.14 }); tone(1047, 0.7, { vol: 0.14, at: 0.32 }); },     // 딩동
  rewind: () => tone(300, 0.28, { type: 'triangle', vol: 0.12, to: 1400 }),
  print: () => { noise(0.32, { vol: 0.12, freq: 2600, q: 2 }); tone(2093, 0.06, { type: 'square', vol: 0.06, at: 0.34 }); },   // 영수증 출력
  perfect: () => [1047, 1319, 1568, 2093].forEach((f, i) => tone(f, 0.35, { type: 'triangle', vol: 0.16, at: 0.4 + i * 0.09 })),
  close: () => { tone(784, 0.25, { type: 'triangle', vol: 0.14, at: 0.4 }); tone(1047, 0.4, { type: 'triangle', vol: 0.14, at: 0.55 }); },
  wrong: () => { tone(180, 0.22, { type: 'sawtooth', vol: 0.12, at: 0.4 }); tone(150, 0.35, { type: 'sawtooth', vol: 0.12, at: 0.65 }); },
  timeout: () => tone(700, 0.7, { type: 'square', vol: 0.07, to: 180, at: 0.4 }),
  tick: () => tone(1500, 0.04, { type: 'square', vol: 0.05 }),
  end: () => [523, 659, 784, 1047].forEach((f, i) => tone(f, i === 3 ? 0.6 : 0.18, { type: 'triangle', vol: 0.15, at: i * 0.13 })),
};
const whoAt = t => vocal.find(v => t >= v.from && t < v.to)?.who || null;

audio.addEventListener('ended', () => {
  if (state !== 'rap') return;
  socket.emit('burger_rap_end');   // 디스코드에서 손님이 "주문 끝~" (처음 한 번만, 서버가 거름)
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
  const active = speaker === a.id;
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
  ctx.translate(ax(a) + dx, BOTTOM + dy);
  ctx.rotate(rot);
  ctx.scale(1, sy);
  ctx.drawImage(face, -SIZE / 2, -SIZE, SIZE, SIZE);
  if (!a.mood && active && mouthOpen) ctx.drawImage(mouthLayers[a.id], -SIZE / 2, -SIZE, SIZE, SIZE);
  ctx.restore();
}

function draw(now) {
  const t = now / 1000;
  ctx.drawImage(img.bg, bgX(), BG_Y);
  const raw = voiceLevel();
  level += (raw - level) * 0.5;      // 빠르게 따라감
  slow += (raw - slow) * 0.06;       // 천천히 따라감 (비트가 깔린 평균)
  const at = audio.currentTime || 0;
  // 입: 랩 구간에서 소리가 평균보다 툭 커질 때 열고, 열리면 최소 0.07초·닫히면 최소 0.05초 유지
  //     인사말(음악 없음)은 소리 크기가 고르게 높아서, 소리가 나는 동안 0.24초 주기로 뻐끔뻐끔 (쉴 때는 닫힘)
  speaker = talking() ? talker : rapping() ? whoAt(at) : null;
  const want = !!speaker && (talking() ? level > 0.12 && Math.sin(now / 38) > -0.2 : level > slow * 1.04);
  if (want !== mouthOpen && now - mouthSince > (mouthOpen ? 70 : 50)) { mouthOpen = want; mouthSince = now; }
  for (const a of actors) drawActor(a, now, t, at);
  tickAfter(now);
  requestAnimationFrame(draw);
}

// ── 랩이 끝난 뒤 (시간 제한 없음) ──
// 한참 안 찍으면 가끔(20%) 손님이 디스코드에서 재촉 — 손님마다 한 번, 서버가 확률을 정함
function tickAfter(now) {
  if (state !== 'after' || hurrySent || askWaiting) return;
  if (now - afterAt > HURRY_AFTER_MS) { hurrySent = true; socket.emit('burger_hurry'); }
}

// ── 포스기 ──
function buildMenu() {
  $('menu').innerHTML = CATS.map(([cat, label]) => `<div class="cat"><b>${label}</b>${menu[cat].map(m =>
    `<button type="button" class="item" data-id="${m.id}"><img src="img/menu/${m.id}.jpg" alt="">${esc(m.name)}<span class="n" hidden></span></button>`).join('')}</div>`).join('');
  for (const b of document.querySelectorAll('.item')) b.onclick = () => add(b.dataset.id, 1);
}
const canOrder = () => state === 'rap' || state === 'after';
function add(id, d) {
  if (!canOrder()) return;
  const q = (order.get(id) || 0) + d;
  if (q <= 0) order.delete(id); else order.set(id, Math.min(9, q));
  (d > 0 ? SFX.tap : SFX.minus)();
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
$('clear').onclick = () => { if (canOrder() && order.size) { order.clear(); SFX.clear(); renderOrder(); } };

function updateUI() {
  const live = canOrder();
  $('pos').classList.toggle('off', !live);
  for (const b of document.querySelectorAll('.item, #clear, #submit, #lines button')) b.disabled = !live;
  const r = $('replay');
  r.textContent = replaysLeft ? '🔁 다시 듣기 (1번)' : '🔁 다시 듣기 다 씀';
  r.disabled = !(state === 'after' && replaysLeft > 0);
  if (state === 'enter') $('status').textContent = `손님 ${teamNo}/${teams} 들어와요…`;
  else if (state === 'rap') $('status').textContent = '🎤 랩 듣는 중 · 들으면서 찍으세요!';
  else if (state === 'after') $('status').textContent = '✅ 다 찍었으면 주문 완료 · 헷갈리면 디스코드에서 손님에게 물어보세요';
  else $('status').textContent = '';
  $('startRap').hidden = state !== 'ready';
  renderAsks();
  $('progress').innerHTML = Array.from({ length: teams }, (_, i) =>
    `<span class="${i === teamNo - 1 && !progress[i] ? 'now' : ''}" title="손님 ${i + 1}">${progress[i] ? VERDICT[progress[i]][0] : i + 1}</span>`).join('');
}

// ── 흐름 ──
const emit = (ev, data) => new Promise(r => socket.emit(ev, data, r));

function showCustomer(res) {
  song = res.song;
  teamNo = res.n;
  teams = res.of;
  maxAsks = asksLeft = res.maxAsks || 3;
  askWaiting = false;
  askWho = null;
  $('who').textContent = `손님 ${teamNo}/${teams} · ${song.customers.map(c => NAMES[c]).join(' + ')}`;
  replaysLeft = 1;
  hurrySent = false;
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
  actors = song.customers.map((id, i) => ({ id, off: spots[i], side: i ? 1 : -1, enterAt: now + i * 180, leaveAt: 0, mood: null, moodAt: 0, phase: i * 1.7 }));
  state = 'enter';
  updateUI();
  SFX.door();
  audio.src = song.audio;
  audio.load();
  setTimeout(greet, 1000);   // 딩동 끝나고 인사
}

// 손님 인사: 첫 손님이 자기 목소리로 한마디 (둘이면 "같이 주문할게요") → 끝나면 주문 시작 버튼
function greet() {
  if (state !== 'enter') return;
  greeter = song.customers[0];
  const kind = song.customers.length > 1 ? 'duo' : 'solo';
  const pool = greetings[greeter]?.[kind] || [];
  const choices = pool.length > 1 ? pool.filter(g => g.text !== lastGreet[greeter]) : pool;
  const line = choices[Math.floor(Math.random() * choices.length)];
  state = 'greet';
  updateUI();
  const done = () => { if (state === 'greet') { state = 'ready'; updateUI(); } };
  if (!line) return done();
  lastGreet[greeter] = line.text;
  showBubble(greeter, line.text, 0);
  playVoice(greeter, line.file, done);
  setTimeout(done, 6000);   // 소리가 안 끝나도 6초 뒤엔 버튼
}

// 주문 시작 → 랩 틀기 (시간 제한은 서버가 이때부터 잼)
$('startRap').onclick = async () => {
  if (state !== 'ready' && state !== 'greet') return;
  stopVoice();
  $('bubbles').innerHTML = '';
  state = 'rap';
  updateUI();
  emit('burger_play');
  try { await audio.play(); } catch { state = 'after'; afterAt = performance.now(); updateUI(); }
};

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
  stopVoice();
  state = 'rap';
  updateUI();
  SFX.rewind();
  audio.currentTime = 0;
  audio.play().catch(() => {});
};

let submitting = false;
async function submit() {
  if (submitting || !canOrder()) return;
  submitting = true;
  audio.pause();
  stopVoice();
  state = 'result';
  updateUI();
  SFX.print();
  const res = await emit('burger_submit', { entered: [...order].map(([item, qty]) => ({ item, qty })) });
  submitting = false;
  if (!res) return;
  SFX[res.verdict]?.();
  progress[teamNo - 1] = res.verdict;
  const mood = res.verdict === 'perfect' || res.verdict === 'close' ? 'happy' : 'angry';
  for (const a of actors) { a.mood = mood; a.moodAt = performance.now(); }
  awaitUntil = Date.now() + 30000;
  showReceipt(res);
  updateUI();
}
$('submit').onclick = () => submit();

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
    <p class="hint"></p>`;
  box.hidden = false;
  $('next').onclick = nextCustomer;
  lockNext(res.speaker);
}

// 손님 한마디가 끝날 때까지 "다음 손님"을 잠근다.
//   풀리는 때: 웹에서 그 목소리가 끝남 / 목소리 없이 말풍선만 왔으면 읽을 시간만큼 지남 / 최대 22초
let nextLock = null;
function lockNext(speaker) {
  const btn = $('next');
  if (!speaker || !btn) return;
  btn.dataset.label = btn.textContent;
  btn.textContent = '손님이 말하는 중…';
  btn.disabled = true;
  nextLock = { speaker, timer: setTimeout(unlockNext, 22000) };
}
function unlockNext() {
  if (!nextLock) return;
  clearTimeout(nextLock.timer);
  nextLock = null;
  const btn = $('next');
  if (btn) { btn.disabled = false; btn.textContent = btn.dataset.label; }
}
// 주문 완료 한마디: 서버가 Hermes 대사 + 손님 목소리(mp3)를 보낸다 → 말풍선 + 목소리, 다 들으면 다음 손님 열림
socket.on('burger_voice', ({ who, text, audio }) => {
  const a = actors.find(x => x.id === who);
  if (state !== 'result' || !a) return unlockNext();
  showBubble(who, text);
  a.moodAt = performance.now();   // 말할 때 한 번 더 들썩
  if (voiceUrl) URL.revokeObjectURL(voiceUrl);
  voiceUrl = null;
  if (!audio) return void setTimeout(unlockNext, 1200 + text.length * 110);
  voiceUrl = URL.createObjectURL(new Blob([audio], { type: 'audio/mpeg' }));
  playVoice(who, voiceUrl, () => setTimeout(unlockNext, 300));
});
// 손님 감탄사 (랩이 끝나면 "주문 끝~", 한참 안 찍으면 가끔 재촉): 미리 만든 소리를 웹에서
socket.on('burger_clip', ({ who, src, text }) => {
  const a = actors.find(x => x.id === who);
  if (!a || state !== 'after' || talking()) return;
  if (text) showBubble(who, text, 3500);
  a.moodAt = performance.now();
  playVoice(who, src);
});

async function nextCustomer() {
  if (state !== 'result') return;
  state = 'leave';
  updateUI();
  const now = performance.now();
  for (const a of actors) a.leaveAt = now;
  stopVoice();
  $('bubbles').innerHTML = '';
  awaitUntil = 0;
  unlockNext();
  const [res] = await Promise.all([emit('burger_next'), new Promise(r => setTimeout(r, 500))]);
  if (res?.type === 'customer') return showCustomer(res);
  if (res?.type === 'end') showEnd(res.results);
}

function showEnd(results) {
  state = 'end';
  actors = [];
  $('who').textContent = '';
  order.clear();
  renderOrder();
  $('receipt').hidden = true;
  updateUI();
  SFX.end();
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
function showBubble(id, text, ms = 9000) {
  const a = actors.find(x => x.id === id);
  if (!a) return;
  const b = document.createElement('div');
  b.className = 'bubble';
  b.textContent = text;
  $('bubbles').querySelector(`[data-id="${id}"]`)?.remove();
  b.dataset.id = id;
  $('bubbles').appendChild(b);
  placeBubble(b);
  if (ms) setTimeout(() => b.remove(), ms);
}
// 말풍선을 손님 머리 위에 둔다. 왼쪽 위 손님 이름표와 겹치면 오른쪽으로 비켜 준다
function placeBubble(b) {
  const a = actors.find(x => x.id === b.dataset.id);
  if (!a) return;
  const at = `${(ax(a) / W) * 100}%`;
  b.style.left = at;
  const tag = $('who').getBoundingClientRect(), box = b.getBoundingClientRect();
  if (tag.width && box.left < tag.right + 8 && box.top < tag.bottom) {
    b.style.left = `calc(${at} + ${Math.ceil(tag.right + 8 - box.left)}px)`;
  }
}

// ── 무대 크기: 화면에 맞춰 무대를 키운다 (세로는 그대로 두고 가로를 늘려 배경 양옆을 더 보여 줌) ──
function fit() {
  const wrap = $('stageWrap'), stage = $('stage');
  const bw = wrap.clientWidth, bh = wrap.clientHeight;
  if (!bw || !bh) return;
  const a = clamp(bw / bh, MIN_A, MAX_A);
  const w = Math.min(bw, bh * a);
  stage.style.width = `${w}px`;
  stage.style.height = `${w / a}px`;
  const cw = Math.round(H * a);
  if (cw !== W) cv.width = W = cw;
  for (const b of $('bubbles').children) placeBubble(b);
}
new ResizeObserver(fit).observe($('stageWrap'));
socket.on('say', ({ id, text }) => {
  const a = actors.find(x => x.id === id);
  if (!a || Date.now() > awaitUntil) return;
  showBubble(id, text);
  a.moodAt = performance.now();   // 말할 때 한 번 더 들썩
  if (nextLock?.speaker === id) setTimeout(unlockNext, 1200 + text.length * 110);
});
// 음성방에서 손님에게 주문을 되물으면 (서버가 알려 줌): 손님 대답 말풍선도 보이게
let toastTimer = 0;
function toast(text) {
  $('toast').textContent = text;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { $('toast').textContent = ''; }, 4500);
}
// 되묻기 표시 (주문서 위): 남은 횟수 / 대답 기다리는 중
function renderAsks() {
  const box = $('asks');
  let html = '';
  if (song && (state === 'rap' || state === 'after')) {
    const dots = '●'.repeat(asksLeft) + '○'.repeat(Math.max(0, maxAsks - asksLeft));
    if (state === 'rap') html = `💬 랩이 끝나면 디스코드에서 되묻기 <b>${maxAsks}번</b>`;
    else if (askWaiting) html = `<span class="wait">⏳ ${NAMES[askWho] || '손님'} 대답 기다리는 중…</span>`;
    else if (asksLeft > 0) html = `💬 디스코드 되묻기 <span class="dots">${dots}</span> <b>${asksLeft}번</b> 남음`;
    else html = '💬 되묻기 다 썼어요';
  }
  if (box.innerHTML !== html) box.innerHTML = html;
}
socket.on('burger_asked', ({ who, left, typed, early, busy, again }) => {
  if (early) return toast('🎤 랩이 끝나면 물어볼 수 있어요');
  if (busy) return toast(`⏳ ${NAMES[askWho] || '손님'}가 대답하는 중이에요`);
  if (again) return toast(`💬 되묻기 ${maxAsks}번을 다 썼어요`);
  askWaiting = true;
  askWho = who;
  asksLeft = left;
  awaitUntil = Date.now() + 25000;
  toast(`${typed ? '💬' : '🎙'} ${NAMES[who] || '손님'}에게 물었어요`);
  renderAsks();
});
socket.on('burger_answered', ({ left }) => {
  askWaiting = false;
  asksLeft = left;
  renderAsks();
});

// 게임 서버가 다시 켜지면 서버 쪽 판이 사라진다 → 화면도 처음부터
let connectedOnce = false;
socket.on('connect', () => {
  if (connectedOnce && !['start', 'end'].includes(state)) {
    audio.pause();
    stopVoice();
    state = 'end';
    actors = [];
    order.clear();
    renderOrder();
    $('receipt').hidden = true;
    $('who').textContent = '';
    unlockNext();
    updateUI();
    $('overlay').innerHTML = `<div class="card"><h1>연결이 끊겼어요</h1>
      <p class="sub">게임 서버가 다시 켜져서 이번 판은 처음부터 다시 해야 해요.</p>
      <div class="buttons"><button type="button" class="go" id="again">다시 영업 시작 ▶</button></div></div>`;
    $('overlay').hidden = false;
    $('again').onclick = startShift;
  }
  connectedOnce = true;
});

socket.on('status', s => {
  const on = s.discord === 'connected' && s.chatter;
  $('discord').textContent = on ? '디스코드 연결됨' : '디스코드 꺼짐 · 말풍선만';
  $('discord').classList.toggle('on', on);
});

// ── 시작 ──
fetch('data/greetings.json').then(r => r.json()).then(g => { greetings = g; }).catch(() => {});
Promise.all([
  fetch('data/menu.json').then(r => r.json()),
  ...['bg-wide.jpg', ...['coco', 'lovey', 'rou'].flatMap(id => ['base', 'mouth', 'happy', 'angry'].map(s => `${id}-${s}.png`))].map(f => load(`img/${f}`)),
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
