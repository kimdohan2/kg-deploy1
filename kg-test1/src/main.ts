import './style.css';
import 'swiper/css';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import Lenis from 'lenis';
import Swiper from 'swiper';
import { EffectCoverflow, Keyboard, Navigation, Pagination } from 'swiper/modules';

gsap.registerPlugin(ScrollTrigger);

const $ = <T extends Element = HTMLElement>(sel: string, root: ParentNode = document) =>
  root.querySelector<T>(sel)!;
const $$ = <T extends Element = HTMLElement>(sel: string, root: ParentNode = document) =>
  [...root.querySelectorAll<T>(sel)];

const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

/* ───────── Smooth scroll ───────── */
const lenis = new Lenis({ lerp: 0.1, smoothWheel: !reduceMotion });
lenis.on('scroll', ScrollTrigger.update);
gsap.ticker.add((time) => lenis.raf(time * 1000));
gsap.ticker.lagSmoothing(0);
if (import.meta.env.DEV) Object.assign(window, { lenis, ScrollTrigger });

/* ───────── Header: clock, menu, glide links ───────── */
function initHeader() {
  const clock = $('#clock');
  const tick = () => {
    const time = new Date().toLocaleTimeString('en-GB', {
      timeZone: 'Asia/Seoul',
      hour: '2-digit',
      minute: '2-digit',
    });
    clock.textContent = `Seoul, KR – ${time}`;
  };
  tick();
  setInterval(tick, 1000);

  const menu = $('#menu');
  const pill = $<HTMLButtonElement>('.menu__pill', menu);
  const setOpen = (open: boolean) => {
    menu.classList.toggle('is-open', open);
    pill.setAttribute('aria-expanded', String(open));
  };
  pill.addEventListener('click', (e) => {
    e.stopPropagation();
    setOpen(!menu.classList.contains('is-open'));
  });
  document.addEventListener('click', (e) => {
    if (!menu.contains(e.target as Node)) setOpen(false);
  });
  document.addEventListener('keydown', (e) => e.key === 'Escape' && setOpen(false));

  // Every in-page link glides over the same duration regardless of distance.
  $$<HTMLAnchorElement>('a[data-glide]').forEach((a) =>
    a.addEventListener('click', (e) => {
      const hash = a.getAttribute('href');
      if (!hash?.startsWith('#')) return;
      e.preventDefault();
      setOpen(false);
      lenis.scrollTo(hash === '#top' ? 0 : hash, {
        duration: 0.9,
        easing: (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
      });
    }),
  );

  const header = $('.header');
  ScrollTrigger.create({
    onUpdate: (self) => header.classList.toggle('is-scrolled', self.scroll() > 80),
  });

  $('#year').textContent = String(new Date().getFullYear());
}

/* ───────── Text helpers ───────── */
function splitWords(el: HTMLElement) {
  const words = el.textContent!.trim().split(/\s+/);
  el.innerHTML = words.map((w) => `<span class="word"><span>${w}</span></span>`).join(' ');
  return $$('.word > span', el);
}

function wrapLines(el: HTMLElement) {
  return [...el.children].map((line) => {
    const inner = document.createElement('span');
    inner.style.display = 'inline-block';
    inner.innerHTML = line.innerHTML;
    line.innerHTML = '';
    line.appendChild(inner);
    (line as HTMLElement).style.overflow = 'hidden';
    return inner;
  });
}

function initReveals() {
  $$('[data-split]').forEach((el) => {
    const words = splitWords(el);
    gsap.from(words, {
      yPercent: 105,
      duration: 1,
      ease: 'power4.out',
      stagger: 0.035,
      scrollTrigger: { trigger: el, start: 'top 85%' },
    });
  });

  $$('[data-split-lines]').forEach((el) => {
    gsap.from(wrapLines(el), {
      yPercent: 110,
      duration: 1.1,
      ease: 'power4.out',
      stagger: 0.12,
      scrollTrigger: { trigger: el, start: 'top 85%' },
    });
  });

  gsap.set('[data-reveal]', { autoAlpha: 0, y: 48 });
  ScrollTrigger.batch('[data-reveal]', {
    start: 'top 90%',
    once: true,
    onEnter: (batch) =>
      gsap.to(batch, { autoAlpha: 1, y: 0, duration: 1, ease: 'power3.out', stagger: 0.08 }),
  });

  $$('[data-line]').forEach((el) =>
    gsap.fromTo(
      el,
      { '--line': 0 },
      {
        '--line': 1,
        duration: 1.4,
        ease: 'power3.inOut',
        scrollTrigger: { trigger: el, start: 'top 92%' },
      },
    ),
  );
}

/* ───────── Hero ───────── */
function initHero() {
  const media = $('.hero__media');
  const img = $('img', media);
  const lines = $$('.hero__line > span');

  // Intro: title rises, photo wipes in, then fades from mono to color.
  gsap
    .timeline({ defaults: { ease: 'power4.out' } })
    .from(lines, { yPercent: 110, duration: 1.3, stagger: 0.12 }, 0.1)
    .from(media, { clipPath: 'inset(100% 0 0 0)', duration: 1.4 }, 0.35)
    .from(img, { scale: 1.3, duration: 1.8 }, 0.35)
    .fromTo(img, { filter: 'grayscale(1)' }, { filter: 'grayscale(0)', duration: 1.6, ease: 'power2.inOut' }, 1.2)
    .from('.hero__tagline', { autoAlpha: 0, y: 20, duration: 1 }, 0.9);

  // Scroll: the photo travels down into the statement section while shrinking away.
  const landing = $('.statement__landing');
  const docTop = (el: Element) => el.getBoundingClientRect().top + window.scrollY;
  gsap
    .timeline({
      scrollTrigger: {
        trigger: '.hero',
        start: 150,
        end: () => docTop(landing) - window.innerHeight * 0.55,
        scrub: 0.25,
        invalidateOnRefresh: true,
      },
    })
    .to(media, {
      y: () => docTop(landing) - (docTop(media) - (gsap.getProperty(media, 'y') as number)),
      scale: 0.06,
      ease: 'power1.in',
      duration: 1,
    })
    .to(media, { autoAlpha: 0, duration: 0.15 }, 0.85);

  gsap.to('.hero__title', {
    yPercent: -35,
    ease: 'none',
    scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: true },
  });
}

/* ───────── Mask reveal ("MAKE IT REAL") ───────── */
function initShift() {
  const text = $<SVGTextElement>('#shift-text');
  const mask = $('.shift__mask');
  const notes = $$('.note');

  // Fit the knocked-out word to ~94% of the SVG width, then zoom into the first "I"
  // so the hole grows to cover the whole viewport instead of a white gap.
  const fit = () => {
    text.style.fontSize = '150px';
    const w = text.getBBox().width;
    text.style.fontSize = `${(150 * 940) / w}px`;
    const idx = text.textContent!.indexOf('I');
    const box = text.getExtentOfChar(idx >= 0 ? idx : 0);
    const svg = text.ownerSVGElement!;
    const pt = svg.createSVGPoint();
    pt.x = box.x + box.width / 2;
    pt.y = box.y + box.height / 2;
    const screen = pt.matrixTransform(svg.getScreenCTM()!);
    const r = mask.getBoundingClientRect();
    gsap.set(mask, {
      transformOrigin: `${((screen.x - r.left) / r.width) * 100}% ${((screen.y - r.top) / r.height) * 100}%`,
    });
  };
  document.fonts.ready.then(() => {
    fit();
    ScrollTrigger.refresh();
  });
  ScrollTrigger.addEventListener('refreshInit', () => gsap.set(mask, { scale: 1 }));
  ScrollTrigger.addEventListener('refresh', fit);

  const tl = gsap.timeline({
    defaults: { ease: 'none' },
    scrollTrigger: { trigger: '.shift', start: 'top top', end: 'bottom bottom', scrub: 0.6 },
  });
  tl.to('.shift__hint', { autoAlpha: 0, duration: 0.04 }, 0)
    .to(mask, { scale: 60, ease: 'power3.in', duration: 0.4 }, 0.02)
    .to(mask, { autoAlpha: 0, duration: 0.06 }, 0.36)
    .fromTo('.shift__image', { scale: 1.25 }, { scale: 1, duration: 0.45 }, 0)
    .to({}, { duration: 0.08 });

  notes.forEach((note, i) => {
    const r = parseFloat(getComputedStyle(note).getPropertyValue('--r')) || 0;
    const fromLeft = i % 2 === 0;
    tl.fromTo(
      note,
      { x: fromLeft ? '-70vw' : '70vw', rotation: r + (fromLeft ? -14 : 14), autoAlpha: 0 },
      { x: 0, rotation: r, autoAlpha: 1, ease: 'power3.out', duration: 0.1 },
      0.5 + i * 0.07,
    );
  });
  tl.to({}, { duration: 0.12 });
}

/* ───────── Practices carousel ───────── */
function initPractices() {
  new Swiper('.practices .swiper', {
    modules: [EffectCoverflow, Navigation, Pagination, Keyboard],
    effect: 'coverflow',
    centeredSlides: true,
    slidesPerView: 'auto',
    initialSlide: 3,
    loop: true,
    speed: 700,
    grabCursor: true,
    keyboard: { enabled: true },
    coverflowEffect: { rotate: 0, stretch: 120, depth: 260, modifier: 1, slideShadows: false, scale: 0.9 },
    navigation: { prevEl: '.practices__prev', nextEl: '.practices__next' },
    pagination: { el: '.practices__dots', clickable: true },
  });

  gsap.from('.practices .swiper', {
    y: 120,
    autoAlpha: 0,
    duration: 1.3,
    ease: 'power3.out',
    scrollTrigger: { trigger: '.practices__carousel', start: 'top 85%' },
  });
}

/* ───────── Play ───────── */
function initPlay() {
  const tl = gsap.timeline({
    defaults: { ease: 'none' },
    scrollTrigger: { trigger: '.play__stage', start: 'top bottom', end: 'center center', scrub: 0.5 },
  });
  tl.from('.play__figure--left', { xPercent: -200, rotation: -12 }, 0)
    .from('.play__figure--right', { xPercent: 200, rotation: 12 }, 0)
    .from('.play__circle', { scale: 0.4 }, 0);

  gsap.to('.play__figure--left', {
    yPercent: -18,
    ease: 'none',
    scrollTrigger: { trigger: '.play__stage', start: 'center center', end: 'bottom top', scrub: true },
  });
  gsap.to('.play__figure--right', {
    yPercent: 14,
    ease: 'none',
    scrollTrigger: { trigger: '.play__stage', start: 'center center', end: 'bottom top', scrub: true },
  });
}

/* ───────── Recognition ───────── */
function initRecognition() {
  $$('.award').forEach((card, i) => {
    gsap.from(card, {
      y: 160 + i * 60,
      rotation: (i - 1) * 7,
      ease: 'none',
      scrollTrigger: { trigger: '.recognition__cards', start: 'top bottom', end: 'center 60%', scrub: 0.6 },
    });
  });
}

/* ───────── For you: giant word + stacking cards ───────── */
function initForYou() {
  gsap.from('.for-you__giant', {
    yPercent: 40,
    scaleY: 0.6,
    transformOrigin: '50% 100%',
    ease: 'none',
    scrollTrigger: { trigger: '.for-you', start: 'top bottom', end: 'top 10%', scrub: 0.5 },
  });

  const cards = $$('.stack__card');
  cards.forEach((card, i) => {
    if (i === 0) return;
    // Incoming card swings in tilted and straightens as it docks.
    gsap.fromTo(
      card,
      { rotation: -9, xPercent: -4 },
      {
        rotation: 0,
        xPercent: 0,
        ease: 'none',
        scrollTrigger: { trigger: card, start: 'top bottom', end: 'top 11%', scrub: 0.4 },
      },
    );
    // The card underneath recedes.
    gsap.to(cards[i - 1], {
      scale: 0.92,
      filter: 'brightness(0.7)',
      ease: 'none',
      scrollTrigger: { trigger: card, start: 'top bottom', end: 'top 11%', scrub: 0.4 },
    });
  });
}

/* ───────── Founder ───────── */
function initFounder() {
  const st = { trigger: '.founder__card', start: 'top bottom', end: 'bottom top', scrub: true };
  gsap.fromTo('.founder__deco--star', { y: 120, rotation: -30 }, { y: -120, rotation: 25, ease: 'none', scrollTrigger: st });
  gsap.fromTo('.founder__deco--figure', { y: 80 }, { y: -140, ease: 'none', scrollTrigger: st });
  gsap.from('.founder__photo', {
    yPercent: 25,
    autoAlpha: 0,
    duration: 1.3,
    ease: 'power3.out',
    scrollTrigger: { trigger: '.founder__card', start: 'top 70%' },
  });
}

initHeader();
initReveals();
initHero();
initShift();
initPractices();
initPlay();
initRecognition();
initForYou();
initFounder();

// Recalculate trigger positions whenever the page height changes
// (late images, font swap, dev hot-reload of CSS).
let lastHeight = 0;
let refreshTimer = 0;
new ResizeObserver(() => {
  const h = document.body.scrollHeight;
  if (h === lastHeight) return;
  lastHeight = h;
  clearTimeout(refreshTimer);
  refreshTimer = window.setTimeout(() => ScrollTrigger.refresh(), 150);
}).observe(document.body);
