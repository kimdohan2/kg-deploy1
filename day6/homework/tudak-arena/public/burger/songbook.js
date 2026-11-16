// 주문 랩 모음: 곡마다 듣기 + 주문 + 가사. review.html과 게임 안 "랩 모음" 탭이 같이 쓴다.
//   Songbook.mount(상자, { fold })  fold: 주문·가사(=정답)를 접어 두고 눌러야 보이게 (게임 안에서)
//   Songbook.stop(상자)             틀던 곡 멈춤
window.Songbook = (() => {
  const CHAR = { coco: { name: '코코', color: 'var(--coco)' }, lovey: { name: '러비', color: 'var(--lovey)' }, rou: { name: '루', color: 'var(--rou)' } };
  const LV = { '쉬움': '#5fd38a', '보통': '#ffcf4a', '어려움': '#ff6b6b' };
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  async function mount(root, { fold = false } = {}) {
    // faded.json(곡마다 md5)을 주소 뒤에 붙여서, 곡을 다시 만들면 브라우저가 예전 소리를 안 틀게 한다
    const [menu, { songs }, ver] = await Promise.all([
      fetch('data/menu.json').then(r => r.json()),
      fetch('data/songs.json').then(r => r.json()),
      fetch('songs/faded.json').then(r => r.json()).catch(() => ({})),
    ]);
    const items = Object.fromEntries(Object.values(menu).flat().map(m => [m.id, m]));

    const card = s => {
      const ordered = s.order.map(o => items[o.item]);
      const words = [...ordered.flatMap(m => m.say.map(w => [w, 'o'])), ...s.decoys.flatMap(d => items[d].say.map(w => [w, 'd']))].sort((a, b) => b[0].length - a[0].length);
      const re = new RegExp(words.map(([w]) => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|'), 'gi');
      const kind = Object.fromEntries(words.map(([w, k]) => [w.toLowerCase(), k]));
      const hi = line => esc(line).replace(re, w => `<mark class="${kind[w.toLowerCase()] === 'd' ? 'decoy' : ''}">${w}</mark>`);
      const answer = `
        <div class="sb-order">${s.order.map(o => `<span class="sb-chip"><img src="img/menu/${o.item}.jpg" alt="">${esc(items[o.item].name)} <b>×${o.qty}</b></span>`).join('')}</div>
        ${s.decoys.length ? `<div class="sb-trap">함정: ${s.decoys.map(d => esc(items[d].name)).join(', ')} (말만 하고 안 시킴)</div>` : ''}
        <div class="sb-lyr">${s.parts.filter(p => p.lines.length).map(p =>
          `<p class="sb-tag" style="color:${CHAR[p.who].color}">[${esc(p.part)}] ${CHAR[p.who].name}</p>` + p.lines.map(l => `<p>${hi(l)}</p>`).join('')).join('')}</div>`;
      return `<article class="sb-song">
        <header>${s.customers.map(c => `<img src="img/${c}-base.png" alt="">`).join('')}
          <b>${s.customers.map(c => `<span style="color:${CHAR[c].color}">${CHAR[c].name}</span>`).join(' + ')}</b>
          <span class="sb-lv" style="background:${LV[s.level]}">${s.level}</span></header>
        <div class="sb-genre">${esc(s.id)} · ${esc(s.genre)} · 약 ${Math.round(s.parts.reduce((a, p) => a + p.ms, 0) / 1000)}초</div>
        <audio controls preload="none" src="songs/${esc(s.id)}.mp3${ver[s.id] ? `?v=${ver[s.id].slice(0, 8)}` : ''}" onerror="this.outerHTML='<div class=sb-nosong>노래 아직 없음</div>'"></audio>
        ${fold ? `<details class="sb-answer"><summary>주문·가사 보기 (정답)</summary>${answer}</details>` : answer}
      </article>`;
    };

    root.innerHTML = `<h2 class="sb-title">주문 랩 ${songs.length}곡</h2><div class="sb-filters"></div><section class="sb-songs"></section>`;
    const box = root.querySelector('.sb-filters'), list = root.querySelector('.sb-songs');
    const solo = id => songs.filter(s => s.customers.length === 1 && s.customers[0] === id).length;
    const count = lv => songs.filter(s => s.level === lv).length;
    const opts = [['all', `전체 ${songs.length}`], ['coco', `코코 ${solo('coco')}`], ['lovey', `러비 ${solo('lovey')}`], ['rou', `루 ${solo('rou')}`],
      ['duo', `둘이 ${songs.filter(s => s.customers.length > 1).length}`], ['보통', `보통 ${count('보통')}`], ['어려움', `어려움 ${count('어려움')}`]];
    box.innerHTML = opts.map(([k, l]) => `<button type="button" data-k="${k}">${l}</button>`).join('');
    const keep = f => s => f === 'all' || s.level === f || (f === 'duo' ? s.customers.length > 1 : s.customers.length === 1 && s.customers[0] === f);
    const pick = f => {
      for (const b of box.children) b.classList.toggle('on', b.dataset.k === f);
      list.innerHTML = songs.filter(keep(f)).map(card).join('');
    };
    for (const b of box.children) b.onclick = () => pick(b.dataset.k);
    pick('all');
    // 한 번에 한 곡만: 다른 곡을 틀면 앞 곡은 멈춤
    root.addEventListener('play', e => { for (const a of root.querySelectorAll('audio')) if (a !== e.target) a.pause(); }, true);
  }

  const stop = root => { for (const a of root.querySelectorAll('audio')) a.pause(); };
  return { mount, stop };
})();
