// 두 페이지가 공유하는 UI: 로고, 메뉴, 뉴스 사이드바, 사운드, 장식 타이틀
(() => {
  const S = window.SITE;
  const $ = (s, r = document) => r.querySelector(s);

  // 글자 단위 span으로 쪼갠 타이틀. ornament 인덱스 글자는 스크립트체로.
  function makeTitle(text, ornament = [], { mask = true } = {}) {
    const el = document.createElement("span");
    el.className = "Title";
    [...text].forEach((c, i) => {
      const ch = document.createElement("span");
      ch.className = "ch" + (ornament.includes(i) ? " orn" : "");
      ch.textContent = c;
      if (mask) {
        const m = document.createElement("span");
        m.className = "mask";
        m.appendChild(ch);
        el.appendChild(m);
      } else el.appendChild(ch);
    });
    return el;
  }

  const MENU = [
    { label: "Home", href: "index.html", orn: [2] },
    { label: "Work", href: "index.html#all", orn: [1] },
    { label: "Story", href: "story.html", orn: [2] },
    { label: "FAQ", href: "story.html#faq", orn: [0] },
  ];
  const FLOURISH = "M2 10 C 30 2, 60 16, 95 8 S 150 2, 190 10 C 200 12, 205 6, 198 4";

  function renderChrome(page) {
    const logo = document.createElement("a");
    logo.className = "Logo"; logo.href = "index.html";
    logo.innerHTML = `<span>${S.brand}</span>`;

    const news = document.createElement("button");
    news.className = "IconBtn"; news.id = "NewsToggle"; news.setAttribute("aria-label", "News");
    news.innerHTML = `<svg width="16" height="18" viewBox="0 0 16 18" fill="currentColor"><path d="M8 0c.6 0 1 .4 1 1v.7c2.6.5 4.5 2.8 4.5 5.5v4.3L16 14v1H0v-1l2.5-2.5V7.2C2.5 4.5 4.4 2.2 7 1.7V1c0-.6.4-1 1-1zM6 16h4a2 2 0 0 1-4 0z"/></svg><span class="dot"></span>`;

    const menuBtn = document.createElement("button");
    menuBtn.className = "IconBtn"; menuBtn.id = "MenuToggle"; menuBtn.setAttribute("aria-label", "Menu");
    menuBtn.innerHTML = `<span class="bars"><i></i><i></i><i></i></span>`;

    const menu = document.createElement("nav");
    menu.id = "Menu";
    MENU.forEach((m) => {
      const a = document.createElement("a");
      a.href = m.href;
      if ((page === "home" && m.label === "Home") || (page === "story" && m.label === "Story")) a.classList.add("active");
      a.appendChild(makeTitle(m.label, m.orn, { mask: true }));
      a.insertAdjacentHTML("beforeend", `<svg class="flourish" viewBox="0 0 200 16" preserveAspectRatio="none"><path d="${FLOURISH}"/></svg>`);
      menu.appendChild(a);
    });

    const overlay = document.createElement("div");
    overlay.id = "Overlay";

    const side = document.createElement("section");
    side.id = "NewsSidebar";
    side.innerHTML = `
      <div class="NewsSidebar-nav">
        <button class="close" aria-label="Close"><svg width="14" height="14" viewBox="0 0 14 14" stroke="currentColor"><path d="M1 1l12 12M13 1L1 13"/></svg></button>
        <span class="vert mono">News &amp; Updates</span>
        <span class="mono">✦</span>
      </div>
      <div class="NewsSidebar-content">
        <div class="NewsSidebar-topbar stagger">What's new</div>
        ${S.news.map((n) => `
          <article class="NewsSidebar-entry stagger">
            <div class="ph"><img src="${n.img}" alt="" loading="lazy" onerror="this.remove()"></div>
            <h2>${n.title}</h2>
            <p>${n.desc}</p>
            <a class="cta mono" href="#">${n.cta}</a>
          </article>`).join("")}
      </div>`;

    document.body.prepend(logo, news, menuBtn, menu, overlay, side);
    bindChrome();
  }

  function bindChrome() {
    const body = document.body;
    const menu = $("#Menu");
    const side = $("#NewsSidebar");

    const menuTl = gsap.timeline({ paused: true })
      .to(menu, { y: 0, duration: .9, ease: "expo.inOut" })
      .from(menu.querySelectorAll(".ch"), { yPercent: 110, duration: .8, stagger: .025, ease: "expo.out" }, "-=.35");

    const newsTl = gsap.timeline({ paused: true })
      .to(side, { x: 0, duration: .9, ease: "expo.inOut" })
      .from(side.querySelectorAll(".stagger"), { y: 40, opacity: 0, duration: .8, stagger: .08, ease: "expo.out" }, "-=.4");

    const setMenu = (open) => {
      body.classList.toggle("menu-open", open);
      open ? menuTl.timeScale(1).play() : menuTl.timeScale(1.6).reverse();
    };
    const setNews = (open) => {
      body.classList.toggle("news-open", open);
      open ? newsTl.timeScale(1).play() : newsTl.timeScale(1.6).reverse();
    };

    $("#MenuToggle").addEventListener("click", () => { setNews(false); setMenu(!body.classList.contains("menu-open")); });
    $("#NewsToggle").addEventListener("click", () => { setMenu(false); setNews(!body.classList.contains("news-open")); });
    side.querySelector(".close").addEventListener("click", () => setNews(false));
    $("#Overlay").addEventListener("click", () => { setMenu(false); setNews(false); });
    addEventListener("keydown", (e) => { if (e.key === "Escape") { setMenu(false); setNews(false); } });

    // 같은 페이지 내 링크는 메뉴만 닫고 해시 이벤트에 맡김
    menu.querySelectorAll("a").forEach((a) => a.addEventListener("click", (e) => {
      const url = new URL(a.href);
      if (url.pathname === location.pathname) {
        e.preventDefault();
        setMenu(false);
        if (url.hash) { history.replaceState(null, "", url.hash); dispatchEvent(new HashChangeEvent("hashchange")); }
      }
    }));
  }

  // 로고 손글씨 리빌
  function revealLogo(delay = 0) {
    gsap.fromTo(".Logo span", { clipPath: "inset(0 100% 0 0)" }, { clipPath: "inset(0 0% 0 0)", duration: 1.6, delay, ease: "power2.inOut" });
  }

  // WebAudio로 만든 잔잔한 앰비언트 패드 (외부 음원 없음)
  const Sound = {
    ctx: null, master: null, on: false,
    start() {
      if (!this.ctx) {
        const ctx = (this.ctx = new (window.AudioContext || window.webkitAudioContext)());
        this.master = ctx.createGain(); this.master.gain.value = 0;
        const lp = ctx.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 1200;
        lp.connect(this.master); this.master.connect(ctx.destination);
        [196, 246.94, 293.66, 392, 493.88].forEach((f, i) => {
          const o = ctx.createOscillator(); o.type = i % 2 ? "sine" : "triangle"; o.frequency.value = f;
          const g = ctx.createGain(); g.gain.value = .05;
          const lfo = ctx.createOscillator(); lfo.frequency.value = .05 + i * .03;
          const lg = ctx.createGain(); lg.gain.value = .04; lfo.connect(lg); lg.connect(g.gain);
          o.connect(g); g.connect(lp); o.start(); lfo.start();
        });
      }
      this.ctx.resume();
      this.master.gain.setTargetAtTime(.5, this.ctx.currentTime, 1.2);
      this.on = true; this.sync();
    },
    stop() {
      if (this.ctx) this.master.gain.setTargetAtTime(0, this.ctx.currentTime, .4);
      this.on = false; this.sync();
    },
    toggle() { this.on ? this.stop() : this.start(); },
    sync() { document.querySelectorAll(".SoundBtn").forEach((b) => b.classList.toggle("on", this.on)); },
  };
  document.addEventListener("click", (e) => { if (e.target.closest(".SoundBtn")) Sound.toggle(); });

  window.UI = { makeTitle, renderChrome, revealLogo, Sound, $ };
})();
