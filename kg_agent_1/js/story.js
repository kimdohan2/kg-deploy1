(() => {
  const S = window.SITE;
  const { makeTitle, renderChrome, revealLogo, $ } = window.UI;
  gsap.registerPlugin(ScrollTrigger);

  renderChrome("story");

  // 부드러운 스크롤 + ScrollTrigger 동기화
  const lenis = new Lenis({ lerp: .09 });
  lenis.on("scroll", ScrollTrigger.update);
  gsap.ticker.add((t) => lenis.raf(t * 1000));
  gsap.ticker.lagSmoothing(0);

  // ---------- 렌더 ----------
  $("#StoryTitle").appendChild(makeTitle("Our Story", [1, 6]));
  $(".Footer .sig").textContent = S.brand;

  const nav = $(".StoryNav");
  const wrap = $(".StorySections");
  S.story.forEach((s, i) => {
    const id = "s" + i;
    nav.insertAdjacentHTML("beforeend", `<a href="#${id}"><span>${s.nav}</span><span>${s.years}</span></a>`);
    const sec = document.createElement("section");
    sec.className = "StorySection"; sec.id = id;
    sec.innerHTML = `
      <span class="mono">${s.label}</span>
      <h1 class="PageTitle"></h1>
      <h2 class="split">${s.lead}</h2>
      <h3>${s.body}</h3>
      ${s.pieces.map((p) => `
        <div class="Piece">
          <p class="Piece-desc">${p.desc}</p>
          <div class="Piece-media"><img src="${p.img}" alt="" loading="lazy" onerror="this.remove()"></div>
        </div>`).join("")}`;
    sec.querySelector(".PageTitle").appendChild(makeTitle(s.title, s.ornament));
    wrap.appendChild(sec);
  });

  // FAQ
  nav.insertAdjacentHTML("beforeend", `<a href="#faq"><span>FAQ</span><span>Questions</span></a>`);
  const faq = document.createElement("section");
  faq.className = "StorySection"; faq.id = "faq";
  faq.innerHTML = `<span class="mono">Questions</span><h1 class="PageTitle"></h1>
    <div class="Faq">${S.faq.map((f) => `
      <div class="Faq-item"><button class="Faq-q"><span>${f.q}</span><span class="pm">+</span></button>
      <div class="Faq-a"><p>${f.a}</p></div></div>`).join("")}</div>`;
  faq.querySelector(".PageTitle").appendChild(makeTitle("FAQ", [0]));
  wrap.appendChild(faq);

  faq.querySelectorAll(".Faq-item").forEach((item) => {
    item.querySelector(".Faq-q").addEventListener("click", () => {
      const open = !item.classList.contains("open");
      item.classList.toggle("open", open);
      gsap.to(item.querySelector(".Faq-a"), { height: open ? "auto" : 0, duration: .7, ease: "expo.inOut", onComplete: () => ScrollTrigger.refresh() });
    });
  });

  // 텍스트를 실제 렌더링된 줄 단위로 나눔
  function splitLines(el) {
    const words = el.textContent.trim().split(/\s+/);
    el.innerHTML = words.map((w) => `<span class="w">${w}</span>`).join(" ");
    const lines = [];
    let top = null;
    el.querySelectorAll(".w").forEach((w) => {
      if (w.offsetTop !== top) { lines.push([]); top = w.offsetTop; }
      lines[lines.length - 1].push(w.textContent);
    });
    el.innerHTML = lines.map((l) => `<span class="Line"><span>${l.join(" ")}</span></span>`).join("");
    return el.querySelectorAll(".Line > span");
  }

  // ---------- 애니메이션 ----------
  function init() {
    revealLogo(.1);

    // 헤더 등장
    gsap.timeline({ delay: .2 })
      .from("#StoryTitle .ch", { yPercent: 110, duration: 1.2, stagger: .04, ease: "expo.out" })
      .from("#StoryTitle .orn", { rotate: -20, scale: .5, duration: 1.4, ease: "elastic.out(1,.6)" }, .3)
      .from(".PageSubtitle", { opacity: 0, y: 12, duration: 1 }, .5)
      .from(".Graphic img", { opacity: 0, y: 60, duration: 1.6, stagger: .15, ease: "expo.out" }, .6);

    // 일러스트 레이어 패럴랙스 (깊이별 속도 차이)
    const g = { trigger: ".Graphic", start: "top 60%", end: "bottom top", scrub: true };
    gsap.to(".Graphic .person", { yPercent: -18, scrollTrigger: g });
    gsap.to(".Graphic .desk", { yPercent: 22, scrollTrigger: g });
    gsap.to(".Graphic .papers", { yPercent: -60, rotate: 18, scrollTrigger: g });

    document.querySelectorAll(".StorySection").forEach((sec) => {
      const st = { trigger: sec, start: "top 78%" };
      gsap.from(sec.querySelector(":scope > .mono"), { opacity: 0, x: -20, duration: 1, scrollTrigger: st });
      gsap.from(sec.querySelectorAll(".PageTitle .ch"), { yPercent: 110, duration: 1.2, stagger: .035, ease: "expo.out", scrollTrigger: st });
      gsap.from(sec.querySelectorAll(".PageTitle .orn"), { rotate: -20, scale: .5, duration: 1.4, ease: "elastic.out(1,.6)", delay: .2, scrollTrigger: st });

      const h2 = sec.querySelector("h2.split");
      if (h2) gsap.from(splitLines(h2), { yPercent: 105, duration: 1.1, stagger: .08, ease: "expo.out", scrollTrigger: { trigger: h2, start: "top 85%" } });
      const h3 = sec.querySelector("h3");
      if (h3) gsap.from(h3, { opacity: 0, y: 30, duration: 1.2, ease: "expo.out", scrollTrigger: { trigger: h3, start: "top 88%" } });

      sec.querySelectorAll(".Piece").forEach((p) => {
        const media = p.querySelector(".Piece-media");
        gsap.fromTo(media, { clipPath: "inset(100% 0 0 0)" }, { clipPath: "inset(0% 0 0 0)", duration: 1.4, ease: "expo.inOut", scrollTrigger: { trigger: p, start: "top 82%" } });
        const img = media.querySelector("img");
        if (img) gsap.fromTo(img, { yPercent: -16 }, { yPercent: 0, ease: "none", scrollTrigger: { trigger: p, start: "top bottom", end: "bottom top", scrub: true } });
        gsap.from(p.querySelector(".Piece-desc"), { opacity: 0, y: 30, duration: 1.2, delay: .3, ease: "expo.out", scrollTrigger: { trigger: p, start: "top 82%" } });
      });

      gsap.from(sec.querySelectorAll(".Faq-item"), { opacity: 0, y: 30, duration: 1, stagger: .08, ease: "expo.out", scrollTrigger: { trigger: sec, start: "top 70%" } });
    });

    // 타임라인 내비: 등장, 현재 섹션 표시, 진행 바
    // 링크 자체의 opacity는 active 클래스가 제어하므로 안쪽 span만 애니메이션
    gsap.from(".StoryNav a > span", { opacity: 0, x: -20, duration: 1, stagger: .04, ease: "expo.out", scrollTrigger: { trigger: ".Story", start: "top 70%" } });
    const links = [...nav.querySelectorAll("a")];
    document.querySelectorAll(".StorySection").forEach((sec, i) => {
      ScrollTrigger.create({
        trigger: sec, start: "top 50%", end: "bottom 50%",
        onToggle: (self) => { if (self.isActive) links.forEach((l, k) => l.classList.toggle("active", k === i)); },
      });
    });
    gsap.to(".StoryNav .progress i", { height: "100%", ease: "none", scrollTrigger: { trigger: ".StorySections", start: "top 50%", end: "bottom 50%", scrub: true } });
    links.forEach((l) => l.addEventListener("click", (e) => { e.preventDefault(); lenis.scrollTo(l.getAttribute("href"), { offset: -60, duration: 1.6 }); }));

    gsap.from(".Footer > *", { opacity: 0, y: 30, duration: 1.2, stagger: .1, ease: "expo.out", scrollTrigger: { trigger: ".Footer", start: "top 85%" } });

    // 메뉴의 FAQ 링크 등 해시 이동
    const goHash = () => { if (location.hash && document.querySelector(location.hash)) lenis.scrollTo(location.hash, { offset: -60, duration: 1.6 }); };
    addEventListener("hashchange", goHash);
    setTimeout(goHash, 400);
  }

  // 폰트 로드 후 줄 나누기가 정확해짐
  (document.fonts ? document.fonts.ready : Promise.resolve()).then(init);
})();
