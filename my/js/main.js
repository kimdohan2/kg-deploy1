import { games, categories, stores } from './data.js';
import { createPlayground } from './playground.js';

const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const catLabel = (id) => categories.find((c) => c.id === id)?.label ?? '';
const isDark = (hex) => {
  const n = parseInt(hex.slice(1), 16);
  return ((n >> 16) * 299 + ((n >> 8) & 255) * 587 + (n & 255) * 114) / 1000 < 130;
};

// ---------- 효과음 (WebAudio로 즉석 합성, 기본은 꺼짐) ----------
const sfx = (() => {
  let ac = null, on = false;
  const btn = $('.sound-toggle');
  btn.addEventListener('click', () => {
    on = !on;
    btn.setAttribute('aria-pressed', on);
    btn.title = on ? '효과음 끄기' : '효과음 켜기';
    if (on) { ac ||= new AudioContext(); play('pop'); }
  });
  function play(type, k = 1) {
    if (!on || !ac) return;
    const t = ac.currentTime, o = ac.createOscillator(), g = ac.createGain();
    o.connect(g); g.connect(ac.destination);
    const f = { pop: [520, 980], boing: [300, 140], grab: [700, 900] }[type] || [400, 600];
    o.type = type === 'boing' ? 'sine' : 'triangle';
    o.frequency.setValueAtTime(f[0] * (0.9 + Math.random() * 0.2), t);
    o.frequency.exponentialRampToValueAtTime(f[1], t + 0.12);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.18 * k, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.22);
    o.start(t); o.stop(t + 0.25);
  }
  return play;
})();

// ---------- 히어로 물리 놀이터 ----------
const newest = games.find((g) => g.slug === 'dinosaur-world');
const hero = createPlayground($('.playground'), {
  letters: ['K', 'I', 'G', 'L', 'E'],
  intro: reduced ? 4 : 12,
  sign: { text: newest.title, sub: '눌러서 구경하기 →', onClick: () => openGame(newest) },
  sound: sfx,
});

// ---------- 영상관 ----------
const trailers = games.filter((g) => g.video);
let current = 0, reelTimer = 0;
const strip = $('.filmstrip');
strip.innerHTML = trailers.map((g, i) => `
  <button class="film" role="tab" aria-selected="${i === 0}" data-i="${i}">
    <img src="${g.cover}" alt="" loading="lazy" /><span>${g.title}</span>
  </button>`).join('');

function showTrailer(i, user = false) {
  current = (i + trailers.length) % trailers.length;
  const g = trailers[current], img = $('.tv-img');
  img.classList.add('swap');
  setTimeout(() => { img.src = g.cover; img.alt = `${g.title} 예고편 장면`; img.classList.remove('swap'); }, 200);
  $('.tv-title').textContent = g.title;
  $('.tv-count').textContent = `${String(current + 1).padStart(2, '0')} / ${String(trailers.length).padStart(2, '0')}`;
  $('.tv-runtime').textContent = `예고편 ${g.runtime}`;
  $$('.film').forEach((f, n) => f.setAttribute('aria-selected', n === current));
  if (user) $$('.film')[current].scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
  clearInterval(reelTimer);
  if (!reduced) reelTimer = setInterval(() => showTrailer(current + 1), 4500);
}
strip.addEventListener('click', (e) => { const f = e.target.closest('.film'); if (f) showTrailer(+f.dataset.i, true); });
$('.tv-play').addEventListener('click', () => openVideo(trailers[current]));
showTrailer(0);

const player = $('.player');
function openVideo(g) {
  clearInterval(reelTimer);
  $('.player-frame').innerHTML = `<iframe src="https://www.youtube-nocookie.com/embed/${g.video}?autoplay=1&rel=0" title="${g.title} 예고편" allow="autoplay; encrypted-media; picture-in-picture" allowfullscreen></iframe>`;
  player.showModal();
}
player.addEventListener('close', () => { $('.player-frame').innerHTML = ''; showTrailer(current); });

// ---------- 게임 장난감 상자 ----------
const chips = $('.chips');
chips.innerHTML = categories.map((c, i) => `<button class="chip" role="tab" aria-selected="${i === 0}" data-cat="${c.id}">${c.icon} ${c.label}</button>`).join('');
const grid = $('.game-grid');
grid.innerHTML = games.map((g, i) => `
  <li class="game ${isDark(g.color) ? 'dark' : ''}" data-cat="${g.cat}" style="--card:${g.color}; --tilt:${[-2, 1.5, -1, 2, -1.5, 1][i % 6]}deg">
    <button type="button" data-slug="${g.slug}">
      <div class="game-thumb">
        <img src="${g.cover}" alt="" loading="lazy" />
        <span class="dl ${g.downloads.startsWith('1,000') ? 'hot' : ''}">⬇ ${g.downloads}</span>
      </div>
      <h3>${g.title}</h3>
      <p>${g.desc}</p>
      <span class="cat">${catLabel(g.cat)}</span>
    </button>
  </li>`).join('');

chips.addEventListener('click', (e) => {
  const c = e.target.closest('.chip');
  if (!c) return;
  $$('.chip').forEach((x) => x.setAttribute('aria-selected', x === c));
  let n = 0;
  $$('.game').forEach((li) => {
    const show = c.dataset.cat === 'all' || li.dataset.cat === c.dataset.cat;
    li.classList.toggle('hide', !show);
    li.classList.remove('pop-in');
    if (show) { void li.offsetWidth; li.style.animationDelay = `${n++ * 60}ms`; li.classList.add('pop-in'); }
  });
  sfx('pop');
});
grid.addEventListener('click', (e) => {
  const b = e.target.closest('button[data-slug]');
  if (b) openGame(games.find((g) => g.slug === b.dataset.slug));
});

// ---------- 게임 상세 시트 (Critter Spin 식: 영상 + 스토어 버튼 한 화면) ----------
const sheet = $('.sheet');
function openGame(g) {
  $('.sheet-body', sheet).innerHTML = `
    <div class="sheet-hero" style="--card:${g.color}"><img src="${g.cover}" alt="${g.title} 대표 화면" /></div>
    <div class="sheet-content">
      <span class="cat" style="--card:${g.color}">${catLabel(g.cat)}</span>
      <h2 id="sheet-title">${g.title}</h2>
      <p class="headline">${g.headline}</p>
      <p>${g.body}</p>
      <div class="sheet-meta"><span>개발사 KIGLE</span><span>⬇ ${g.downloads} 다운로드</span>${g.runtime ? `<span>🎬 예고편 ${g.runtime}</span>` : ''}</div>
      <div class="sheet-actions">
        ${g.video ? '<button class="btn" type="button" data-play>▶ 예고편 보기</button>' : ''}
        <a class="btn btn-ghost" href="${g.link}" target="_blank" rel="noopener">Google Play에서 보기</a>
      </div>
      <div class="sheet-gallery ${g.portrait ? 'portrait' : ''}">
        ${g.gallery.map((src, i) => `<img src="${src}" alt="${g.title} 화면 ${i + 2}" loading="lazy" />`).join('')}
      </div>
    </div>`;
  $('[data-play]', sheet)?.addEventListener('click', () => { sheet.close(); openVideo(g); });
  sheet.showModal();
  sheet.scrollTop = 0;
  sfx('pop');
}
$$('dialog').forEach((d) => {
  $('.sheet-close', d).addEventListener('click', () => d.close());
  d.addEventListener('click', (e) => { if (e.target === d) d.close(); }); // 바깥 클릭 닫기
});

// ---------- 숫자 카운트업 ----------
const counters = new IntersectionObserver((entries) => {
  entries.forEach(({ isIntersecting, target }) => {
    if (!isIntersecting) return;
    counters.unobserve(target);
    const end = +target.dataset.count, suffix = target.dataset.suffix || '', t0 = performance.now(), dur = reduced ? 1 : 1400;
    const step = (now) => {
      const p = Math.min(1, (now - t0) / dur), e = 1 - Math.pow(1 - p, 3);
      target.textContent = Math.round(end * e).toLocaleString('ko-KR') + suffix;
      if (p < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  });
}, { threshold: 0.6 });
$$('[data-count]').forEach((el) => counters.observe(el));

// ---------- 푸터 볼풀 ----------
$$('.store').forEach((a) => (a.href = stores[a.dataset.store]));
new IntersectionObserver(([en], obs) => {
  if (!en.isIntersecting) return;
  obs.disconnect();
  const pit = createPlayground($('.ballpit'), { intro: 0, maxBodies: 90, kinds: ['ball', 'ball', 'ball', 'blob', 'star'], sound: sfx });
  pit.rain(reduced ? 20 : 60);
}, { threshold: 0.25 }).observe($('.footer'));
