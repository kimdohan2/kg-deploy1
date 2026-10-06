(() => {
  const S = window.SITE;
  const { makeTitle, renderChrome, revealLogo, Sound, $ } = window.UI;
  gsap.registerPlugin(Draggable);

  renderChrome("home");

  const works = S.works;
  const track = $(".Works-track");
  const stack = $(".Titles .stack");
  const label = $(".Titles .label");
  let index = 0;
  let mode = "strips";
  let busy = false;

  // 이미지가 아직 없으면 tone 색 그라디언트로 대체
  const mediaHTML = (w) =>
    `<div class="Work-media" style="background-image:linear-gradient(160deg, ${w.tone}, #111)"><img src="${w.img}" alt="" onerror="this.remove()"></div>`;

  // ---------- 스트립 ----------
  works.forEach((w, i) => {
    const el = document.createElement("div");
    el.className = "Work";
    el.innerHTML = `<div class="Work-inner">${mediaHTML(w)}</div>`;
    el.dataset.i = i;
    track.appendChild(el);
  });
  const items = [...track.children];

  // 타이틀은 미리 만들어 두고 교체
  const titles = works.map((w) => {
    const t = makeTitle(w.title, w.ornament);
    t.style.visibility = "hidden";
    stack.appendChild(t);
    return t;
  });
  $(".Titles .sub").textContent = S.subheading;

  function metrics() {
    const probe = items.find((el) => !el.classList.contains("active")) || items[0];
    const w = parseFloat(getComputedStyle(probe).getPropertyValue("--strip-w")) || probe.offsetWidth;
    const base = probe.classList.contains("active") ? probe.offsetWidth / 2 : probe.offsetWidth;
    const gap = parseFloat(getComputedStyle(track).columnGap) || 20;
    return { w: base || w, gap };
  }
  const xFor = (i) => {
    const { w, gap } = metrics();
    return innerWidth / 2 - (i * (w + gap) + w);
  };
  const indexFor = (x) => {
    const { w, gap } = metrics();
    return gsap.utils.clamp(0, works.length - 1, Math.round((innerWidth / 2 - x - w) / (w + gap)));
  };

  function showTitle(next, prev, dir = 1) {
    if (prev != null && titles[prev]) {
      const out = titles[prev];
      gsap.to(out.querySelectorAll(".ch"), {
        yPercent: -110 * dir, duration: .6, stagger: .018, ease: "expo.in",
        onComplete: () => { out.style.visibility = "hidden"; },
      });
    }
    const t = titles[next];
    t.style.visibility = "visible";
    const chars = t.querySelectorAll(".ch");
    gsap.fromTo(chars, { yPercent: 110 * dir }, { yPercent: 0, duration: 1.1, stagger: .03, ease: "expo.out", delay: prev != null ? .45 : 0 });
    gsap.fromTo(t.querySelectorAll(".orn"), { rotate: -14, scale: .6 }, { rotate: 0, scale: 1, duration: 1.4, ease: "elastic.out(1, .6)", delay: prev != null ? .6 : .15 });
    gsap.to(label, { opacity: 0, duration: .3, onComplete: () => {
      label.textContent = works[next].label;
      gsap.to(label, { opacity: 1, duration: .6, delay: .3 });
    } });
  }

  function setActive(i, { instant = false } = {}) {
    i = gsap.utils.clamp(0, works.length - 1, i);
    const prev = index;
    if (i === prev && !instant) { gsap.to(track, { x: xFor(i), duration: .8, ease: "expo.out" }); return; }
    index = i;
    items.forEach((el, k) => el.classList.toggle("active", k === i));
    gsap.to(track, { x: xFor(i), duration: instant ? 0 : 1, ease: "expo.inOut" });
    if (!instant) showTitle(i, prev, i > prev ? 1 : -1);
    if (mode === "single") renderSingle(i > prev ? 1 : -1);
    location.hash !== "#all" && history.replaceState(null, "", "#" + (i + 1));
  }

  // 드래그: 놓는 순간 가장 가까운 스트립으로 스냅
  let dragged = false;
  Draggable.create(track, {
    type: "x",
    trigger: ".Works",
    dragResistance: .1,
    onPress() { dragged = false; gsap.killTweensOf(track); },
    onDrag() { dragged = true; },
    onRelease() {
      if (!dragged) return;
      const v = this.getDirection("velocity") === "left" ? .5 : this.getDirection("velocity") === "right" ? -.5 : 0;
      setActive(indexFor(this.x) + Math.round(v));
    },
    onClick(e) {
      const el = e.target.closest(".Work");
      if (el) setActive(+el.dataset.i);
    },
  });

  // 휠 / 트랙패드
  let wheelLock = 0, wheelAcc = 0;
  addEventListener("wheel", (e) => {
    if (document.body.classList.contains("news-open") || $(".AllWorks").classList.contains("open")) return;
    wheelAcc += Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
    const now = performance.now();
    if (Math.abs(wheelAcc) > 40 && now > wheelLock) {
      setActive(index + Math.sign(wheelAcc));
      wheelLock = now + 750; wheelAcc = 0;
    }
  }, { passive: true });
  addEventListener("keydown", (e) => {
    if (e.key === "ArrowRight") setActive(index + 1);
    if (e.key === "ArrowLeft") setActive(index - 1);
  });
  addEventListener("resize", () => { gsap.set(track, { x: xFor(index) }); if (mode === "single") layoutSlices(); });

  // ---------- 싱글 모드: 한 이미지를 6개 세로 조각으로 분할 ----------
  // l, w, t, h: 컨테이너 기준 %
  const SLICES = [
    { l: 0,  w: 12, t: 6, h: 84 },
    { l: 14, w: 12, t: 0, h: 96 },
    { l: 28, w: 12, t: 3, h: 92 },
    { l: 42, w: 12, t: 0, h: 88 },
    { l: 56, w: 12, t: 1, h: 92 },
    { l: 86, w: 12, t: 0, h: 98 },
  ];
  const single = $(".Single");
  const slicesWrap = $(".Single-slices");
  slicesWrap.innerHTML = SLICES.map(() => `<div class="Slice"><div class="Slice-img"></div></div>`).join("") +
    `<div class="Single-tag"><span class="tag-label"></span><span class="play">▶</span></div>` +
    `<div class="Single-vtitle"><span class="vt"></span><span class="meta"></span></div>`;
  const sliceEls = [...slicesWrap.querySelectorAll(".Slice")];

  function layoutSlices() {
    const W = slicesWrap.offsetWidth, H = slicesWrap.offsetHeight;
    sliceEls.forEach((el, k) => {
      const s = SLICES[k];
      Object.assign(el.style, { left: s.l + "%", width: s.w + "%", top: s.t + "%", height: s.h + "%" });
      const img = el.firstElementChild;
      img.style.backgroundSize = `${W}px ${H}px`;
      img.style.backgroundPosition = `${-W * s.l / 100}px ${-H * s.t / 100}px`;
    });
    const tag = slicesWrap.querySelector(".Single-tag");
    Object.assign(tag.style, { left: "calc(14% - 34px)", top: "6%" });
    const vt = slicesWrap.querySelector(".Single-vtitle");
    Object.assign(vt.style, { left: "71%", top: "0" });
  }

  function fillSingle() {
    const w = works[index];
    sliceEls.forEach((el) => {
      el.firstElementChild.style.backgroundImage = `url(${w.img}), linear-gradient(160deg, ${w.tone}, #111)`;
    });
    slicesWrap.querySelector(".tag-label").textContent = w.label.replace(/^Project:\s*/, "");
    const vt = slicesWrap.querySelector(".vt");
    vt.innerHTML = ""; vt.appendChild(makeTitle(w.title, w.ornament, { mask: false }));
    slicesWrap.querySelector(".meta").textContent = S.subheading;
    const p = works[(index - 1 + works.length) % works.length];
    const n = works[(index + 1) % works.length];
    $(".Single-nav.prev .t").textContent = p.title;
    $(".Single-nav.next .t").textContent = n.title;
  }

  function renderSingle(dir = 1) {
    const tl = gsap.timeline();
    tl.to(sliceEls, { clipPath: dir > 0 ? "inset(0 0 100% 0)" : "inset(100% 0 0 0)", duration: .6, stagger: .05, ease: "expo.in" })
      .to(slicesWrap.querySelectorAll(".Single-tag, .Single-vtitle"), { opacity: 0, duration: .3 }, 0)
      .add(fillSingle)
      .fromTo(sliceEls, { clipPath: dir > 0 ? "inset(100% 0 0 0)" : "inset(0 0 100% 0)" }, { clipPath: "inset(0% 0 0% 0)", duration: 1.1, stagger: .07, ease: "expo.out" })
      .to(slicesWrap.querySelectorAll(".Single-tag, .Single-vtitle"), { opacity: 1, duration: .8 }, "-=.7");
  }

  function setMode(m) {
    if (m === mode || busy) return;
    busy = true;
    mode = m;
    document.querySelectorAll(".ModeToggle button").forEach((b) => b.classList.toggle("active", b.dataset.mode === m));
    if (m === "single") {
      document.body.classList.add("single-mode");
      layoutSlices(); fillSingle();
      gsap.timeline({ onComplete: () => (busy = false) })
        .to(items, { y: -40, opacity: 0, duration: .6, stagger: .03, ease: "expo.in" })
        .to(".Titles", { opacity: 0, duration: .4 }, 0)
        .fromTo(sliceEls, { clipPath: "inset(100% 0 0 0)" }, { clipPath: "inset(0% 0 0% 0)", duration: 1.2, stagger: .08, ease: "expo.out" }, "-=.1")
        .fromTo(".Single-tag, .Single-vtitle, .Single-nav", { opacity: 0 }, { opacity: 1, duration: .8 }, "-=.6");
    } else {
      gsap.timeline({ onComplete: () => { document.body.classList.remove("single-mode"); busy = false; } })
        .to(".Single-tag, .Single-vtitle, .Single-nav", { opacity: 0, duration: .3 })
        .to(sliceEls, { clipPath: "inset(0 0 100% 0)", duration: .6, stagger: .05, ease: "expo.in" }, 0)
        .fromTo(items, { y: 40, opacity: 0 }, { y: 0, opacity: 1, duration: 1, stagger: .04, ease: "expo.out" })
        .to(".Titles", { opacity: 1, duration: .6 }, "-=.6");
    }
  }
  document.querySelectorAll(".ModeToggle button").forEach((b) => b.addEventListener("click", () => setMode(b.dataset.mode)));
  $(".Single-nav.prev").addEventListener("click", () => setActive((index - 1 + works.length) % works.length));
  $(".Single-nav.next").addEventListener("click", () => setActive((index + 1) % works.length));

  // ---------- 전체 작업 그리드 ----------
  const all = $(".AllWorks");
  $(".AllWorks-grid").innerHTML = works.map((w, i) => `
    <button class="AllWorks-card" data-i="${i}">
      <div class="ph" style="background:linear-gradient(160deg, ${w.tone}, #111)"><img src="${w.img}" alt="" loading="lazy" onerror="this.remove()"></div>
      <h3>${w.title}</h3><span>${w.label}</span>
    </button>`).join("");
  $(".SeeAll").textContent = `See all ${works.length} works`;

  function openAll() {
    all.classList.add("open");
    gsap.timeline()
      .set(all, { visibility: "visible" })
      .to(all, { opacity: 1, duration: .6, ease: "power2.out" })
      .fromTo(all.querySelectorAll("h2, .AllWorks-card"), { y: 50, opacity: 0 }, { y: 0, opacity: 1, duration: 1, stagger: .05, ease: "expo.out" }, "-=.3");
  }
  function closeAll() {
    all.classList.remove("open");
    gsap.to(all, { opacity: 0, duration: .5, onComplete: () => gsap.set(all, { visibility: "hidden" }) });
    if (location.hash === "#all") history.replaceState(null, "", "#" + (index + 1));
  }
  $(".SeeAll").addEventListener("click", (e) => { e.preventDefault(); openAll(); });
  all.querySelector(".close").addEventListener("click", closeAll);
  all.querySelectorAll(".AllWorks-card").forEach((c) => c.addEventListener("click", () => { closeAll(); setActive(+c.dataset.i); }));
  addEventListener("hashchange", () => { if (location.hash === "#all") openAll(); });

  // ---------- 진입 연출 ----------
  function enterHome() {
    revealLogo(.1);
    gsap.set(track, { x: xFor(index) });
    items[index].classList.add("active");
    gsap.timeline()
      .fromTo(items, { y: () => innerHeight * .6, opacity: 0 }, { y: 0, opacity: 1, duration: 1.6, stagger: .06, ease: "expo.out" })
      .fromTo(".Titles .sub", { opacity: 0, y: 10 }, { opacity: 1, y: 0, duration: .8 }, "-=1")
      .add(() => showTitle(index, null), "-=.9")
      .fromTo(".IconBtn, .Controls", { opacity: 0 }, { opacity: 1, duration: 1 }, "-=.6");
    if (location.hash === "#all") openAll();
  }

  const intro = $("#Intro");
  const hashIdx = parseInt(location.hash.slice(1), 10);
  if (hashIdx >= 1 && hashIdx <= works.length) index = hashIdx - 1;

  let seen = false;
  try { seen = sessionStorage.getItem("introSeen") === "1"; } catch (e) {}

  if (seen) {
    intro.remove();
    enterHome();
  } else {
    $("#Intro .big").textContent = S.brand;
    $("#Intro .copy").innerHTML = S.intro;
    $("#Intro .top .sig").textContent = S.brand;
    gsap.set(".IconBtn, .Controls, .Logo", { opacity: 0 });
    const introTl = gsap.timeline({ delay: .3 })
      .to("#Intro .big", { clipPath: "inset(0 0% 0 0)", duration: 2.4, ease: "power2.inOut" })
      .from("#Intro .top", { opacity: 0, y: -10, duration: 1 }, .4)
      .from("#Intro .copy", { opacity: 0, y: 14, duration: 1 }, "-=1")
      .from("#Intro .enter", { opacity: 0, duration: .8 }, "-=.5");

    const finish = () => {
      if (finish.done) return; finish.done = true;
      try { sessionStorage.setItem("introSeen", "1"); } catch (e) {}
      gsap.set(".Logo", { opacity: 1 });
      gsap.to(intro, { opacity: 0, duration: 1, ease: "power2.inOut", onComplete: () => intro.remove() });
      enterHome();
    };

    $("#Intro .enter").addEventListener("click", () => {
      introTl.progress(1).kill();
      Sound.start();
      const words = [...intro.querySelectorAll(".seq span")];
      words.forEach((w) => { const t = makeTitle(w.textContent, JSON.parse(w.dataset.orn || "[]"), { mask: false }); w.textContent = ""; w.appendChild(t); });
      const tl = gsap.timeline({ onComplete: finish });
      tl.to("#Intro .big, #Intro .copy, #Intro .enter, #Intro .top .hint", { opacity: 0, duration: .8, ease: "power2.in" })
        .to("#Intro .skip", { opacity: 1, pointerEvents: "auto", duration: .5 });
      words.forEach((w) => {
        tl.set(w, { opacity: 1 })
          .fromTo(w.querySelectorAll(".ch"), { opacity: 0, filter: "blur(8px)", y: 12 }, { opacity: 1, filter: "blur(0px)", y: 0, duration: .9, stagger: .05, ease: "power2.out" })
          .to(w.querySelectorAll(".ch"), { opacity: 0, filter: "blur(8px)", duration: .6, stagger: .03, ease: "power2.in" }, "+=.5");
      });
      $("#Intro .skip").addEventListener("click", () => { tl.kill(); finish(); });
    });
  }
})();
