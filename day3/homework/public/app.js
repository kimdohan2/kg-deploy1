(() => {
  const D = window.WORK_DATA;
  const TASKS = D.tasks;

  // ---------- helpers ----------
  const $ = (s) => document.querySelector(s);
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const fmt = (n) => (Math.round(n * 10) / 10).toLocaleString('ko-KR');
  const sum = (arr, f) => arr.reduce((a, b) => a + f(b), 0);
  const hoursOf = (arr) => sum(arr, (t) => t.monthly);
  const TOTAL_H = hoursOf(TASKS);
  const pct = (h) => Math.round((h / TOTAL_H) * 100);
  const byId = Object.fromEntries(TASKS.map((t) => [t.id, t]));

  const ICONS = {
    user: '<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 4-6 8-6s8 2 8 6"/>',
    flow: '<rect x="3" y="4" width="6" height="5" rx="1"/><rect x="15" y="4" width="6" height="5" rx="1"/><rect x="9" y="15" width="6" height="5" rx="1"/><path d="M9 6.5h6M18 9v3h-6v3M6 9v3h6"/>',
    grid: '<rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    chart: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
    spark: '<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z"/><path d="M19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8z"/>',
    book: '<path d="M4 4h6a2 2 0 0 1 2 2v14a2 2 0 0 0-2-2H4z"/><path d="M20 4h-6a2 2 0 0 0-2 2v14a2 2 0 0 1 2-2h6z"/>',
    list: '<path d="M8 6h13M8 12h13M8 18h13"/><circle cx="4" cy="6" r="1"/><circle cx="4" cy="12" r="1"/><circle cx="4" cy="18" r="1"/>',
    calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>',
    box: '<path d="M12 3l8 4.5v9L12 21l-8-4.5v-9z"/><path d="M4 7.5l8 4.5 8-4.5M12 12v9"/>',
    code: '<path d="M8 7l-5 5 5 5M16 7l5 5-5 5M14 4l-4 16"/>',
    bug: '<rect x="7" y="8" width="10" height="12" rx="5"/><path d="M12 8v12M7 13H3M21 13h-4M5 7l2.5 2M19 7l-2.5 2M5 19l2.5-2M19 19l-2.5-2M9.5 5.5L12 8l2.5-2.5"/>',
    sound: '<path d="M4 9v6h4l5 4V5L8 9z"/><path d="M16 9a4 4 0 0 1 0 6M18.5 6.5a8 8 0 0 1 0 11"/>',
    build: '<path d="M12 3v12M7 8l5-5 5 5"/><path d="M4 15v4a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-4"/>',
    globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/>',
    store: '<path d="M5 8h14l-1 13H6z"/><path d="M9 8V6a3 3 0 0 1 6 0v2"/>',
    wrench: '<path d="M14.7 6.3a4 4 0 0 0-5.4 5.4L3 18l3 3 6.3-6.3a4 4 0 0 0 5.4-5.4l-2.5 2.5-2.4-.6-.6-2.4z"/>',
    chat: '<path d="M4 5h16v11H9l-5 4z"/>',
    left: '<path d="M20 12H5M11 6l-6 6 6 6"/>',
    right: '<path d="M4 12h15M13 6l6 6-6 6"/>',
  };
  const icon = (name) => `<svg viewBox="0 0 24 24" aria-hidden="true">${ICONS[name] || ''}</svg>`;

  const CATS = [
    { name: '프로젝트 관리', slug: 'pm', icon: 'calendar', c1: '#2d3e50', c2: '#4a90d9', desc: '킥오프 일정 작성부터 주간회의, 기획서를 구현 단위로 나누는 일까지 프로젝트 진행을 관리합니다.' },
    { name: '프로젝트 셋업', slug: 'setup', icon: 'box', c1: '#2b3340', c2: '#7b68ee', desc: '새 프로젝트마다 Unity·GitLab·SDK·템플릿을 세팅해 바로 개발할 수 있는 골격을 만듭니다.' },
    { name: '개발 구현', slug: 'dev', icon: 'code', c1: '#1f2f36', c2: '#00cccc', desc: '게임 로직, 씬·UI, 애니메이션 연출, 파티클, 밸런싱, 최적화까지 실제 앱을 만드는 핵심 업무입니다.' },
    { name: '피드백·QA', slug: 'qa', icon: 'bug', c1: '#3a2a2e', c2: '#e0605a', desc: '기획·사운드의 피드백을 정리해 반영하고, 기획QA·컨썸QA·기능QA에서 나온 이슈를 수정합니다.' },
    { name: '사운드 연동', slug: 'sound', icon: 'sound', c1: '#33301f', c2: '#e3a72f', desc: '사운드 담당자가 전달한 파일과 사운드 키를 프로젝트에 연결하고 정상 재생되는지 확인합니다.' },
    { name: '빌드·배포', slug: 'build', icon: 'build', c1: '#22332b', c2: '#3fbf7f', desc: 'Android/iOS 테스트 빌드를 만들어 팀에 공유하고, 빌드 오류와 버전을 관리합니다.' },
    { name: '다국어', slug: 'i18n', icon: 'globe', c1: '#232f3e', c2: '#5aa9e6', desc: '다국어 텍스트와 리소스를 반영하고 언어별 UI 깨짐을 확인합니다.' },
    { name: '출시·스토어', slug: 'release', icon: 'store', c1: '#352838', c2: '#c36fd1', desc: '스토어 등록, 스토어 정보 작성, 릴리즈 빌드, 심사 대응까지 출시를 마무리합니다.' },
    { name: '유지보수', slug: 'maint', icon: 'wrench', c1: '#2e2e2e', c2: '#9aa5b1', desc: '출시 후 코드 정리, Unity·SDK 버전 업, 크래시·리뷰 이슈에 대응합니다.' },
    { name: '커뮤니케이션', slug: 'comm', icon: 'chat', c1: '#24303a', c2: '#56c2c2', desc: '기획·사운드 담당자와 Slack으로 소통하고 필요한 리소스를 요청합니다.' },
  ];
  const catByName = Object.fromEntries(CATS.map((c) => [c.name, c]));

  const UNITS = [
    { name: '일간', slug: 'daily', desc: '거의 매일 하는 일' },
    { name: '주간', slug: 'weekly', desc: '주 1회 이상 하는 일' },
    { name: '프로젝트 단계별', slug: 'stage', desc: '특정 프로젝트 단계에서 반복하는 일' },
    { name: '비정기', slug: 'adhoc', desc: '프로젝트당 1회 또는 이슈가 생겼을 때 하는 일' },
  ];

  const PHASES = [
    { name: '기획', slug: 'plan', stages: ['기획(러프·킥오프)'], desc: '기획 러프를 검토해 구현 가능성을 의견으로 내고, 킥오프에서 범위와 일정을 확정합니다.' },
    { name: '준비', slug: 'prep', stages: ['셋업'], desc: '킥오프 후 한 달 이상의 준비 기간 동안 Unity·GitLab·SDK·템플릿을 세팅합니다.' },
    { name: '개발', slug: 'dev', stages: ['개발 구현'], desc: '기능·컨텐츠·연출·사운드를 구현하고, 테스트 빌드를 주기적으로 팀에 공유합니다.' },
    { name: 'QA', slug: 'qa', stages: ['QA'], desc: '기획QA → 컨썸QA → 기능QA 순서로 검수를 받고 이슈를 수정합니다. 기능QA와 함께 Firebase 이벤트도 적용합니다.' },
    { name: '출시', slug: 'release', stages: ['다국어', '출시 준비'], desc: '다국어를 반영한 뒤 스토어를 개설하고 릴리즈 빌드를 만들어 심사에 제출합니다.' },
    { name: '운영', slug: 'ops', stages: ['출시 후'], desc: '출시 전후로 코드를 정리하고, 이후 SDK 버전 업과 출시 후 이슈에 대응합니다.' },
  ];

  const AI_ORDER = ['상', '중', '하'];
  const aiBadge = (lv) => `<span class="badge ai-${esc(lv)}">AI ${esc(lv)}</span>`;
  const star = (t) => (t.pain ? ' <span class="star" title="불편 업무">★</span>' : '');
  const taskLink = (id) => (byId[id] ? `<a class="id" href="#/task/${id}">${id}</a>` : esc(id));

  function expandIds(str) {
    const out = [];
    String(str).split(',').forEach((part) => {
      const m = part.trim().match(/^([A-Z])-(\d+)\s*~\s*[A-Z]-(\d+)$/);
      if (m) {
        for (let i = +m[2]; i <= +m[3]; i++) out.push(`${m[1]}-${String(i).padStart(2, '0')}`);
      } else if (part.trim()) out.push(part.trim());
    });
    return out;
  }
  const aiForTask = (id) => D.ai.filter((a) => expandIds(a.ids).includes(id));

  function bars(rows, opts = {}) {
    const max = Math.max(...rows.map((r) => r.value), 0.0001);
    return `<div class="bars">${rows
      .map((r) => {
        const tag = r.href ? 'a' : 'div';
        const href = r.href ? ` href="${r.href}"` : '';
        return `<${tag} class="bar-row"${href}><span class="lbl">${esc(r.label)}</span><span class="bar-track"><span class="bar${r.pain ? ' pain' : ''}" style="width:${(r.value / max) * 100}%;display:block"></span></span><span class="val"><b>${fmt(r.value)}h</b>${opts.noPct ? '' : ` · ${pct(r.value)}%`}</span></${tag}>`;
      })
      .join('')}</div>`;
  }

  function taskTable(list, { showCat = false, total = true } = {}) {
    const rows = list
      .map(
        (t) => `<tr class="${t.pain ? 'pain' : ''}">
        <td>${taskLink(t.id)}</td>
        ${showCat ? `<td class="nowrap">${esc(t.cat)}</td>` : `<td class="nowrap">${esc(t.sub)}</td>`}
        <td>${esc(t.task)}${star(t)}</td>
        <td class="nowrap">${esc(t.unit)}</td>
        <td class="num">${fmt(t.monthly)}</td>
        <td>${aiBadge(t.ai)}</td>
      </tr>`
      )
      .join('');
    const foot = total
      ? `<tfoot><tr><td colspan="4">합계 ${list.length}개 작업</td><td class="num">${fmt(hoursOf(list))}</td><td></td></tr></tfoot>`
      : '';
    return `<div class="table-wrap"><table>
      <thead><tr><th>ID</th><th>${showCat ? '대분류' : '중분류'}</th><th>세부 작업</th><th>시간 단위</th><th class="num">월 소요(h)</th><th>AI 활용</th></tr></thead>
      <tbody>${rows}</tbody>${foot}</table></div>`;
  }

  const stats = (items) =>
    `<div class="stats">${items.map(([v, l]) => `<div class="stat"><b>${v}</b><span>${l}</span></div>`).join('')}</div>`;

  // ---------- page registry ----------
  const NODES = [];
  const NODE = {};
  function add(path, title, parent, render, mode = 'manual', extra = {}) {
    const n = { path, title, parent, render, mode, children: [], ...extra };
    NODES.push(n);
    NODE[path] = n;
    if (parent != null) NODE[parent].children.push(n);
    return n;
  }

  // Home
  add('', '업무 매뉴얼', null, () => {
    const sections = [
      ['about', '개발자 소개', 'user', '#2d3e50', '#00cccc', '직무, 팀 구성, 사용 도구와 하는 일을 한눈에 소개합니다.'],
      ['flow', '프로젝트 흐름', 'flow', '#1f2f36', '#4a90d9', '러프 전달 회의부터 유지보수까지 13단계로 진행되는 프로젝트 흐름입니다.'],
      ['areas', '업무 영역', 'grid', '#24303a', '#3fbf7f', '10개 대분류로 나눈 44개 작업과 영역별 시간 비중입니다.'],
      ['time', '시간 단위별 업무', 'clock', '#33301f', '#e3a72f', '매일, 매주, 프로젝트 단계별, 비정기로 하는 일을 묶어 봅니다.'],
      ['analysis', '업무 분석', 'chart', '#352838', '#c36fd1', '어디에 시간을 가장 많이 쓰는지, AI로 줄일 수 있는 시간은 얼마인지 분석합니다.'],
      ['ai', 'AI 활용 계획', 'spark', '#3a2a2e', '#e0605a', 'AI 에이전트로 자동화하거나 보조할 업무 9가지와 첫 실행 단계입니다.'],
      ['reference', '업무 레퍼런스', 'list', '#232f3e', '#5aa9e6', '모든 작업의 입력, 산출물, 도구, 소요 시간을 찾아볼 수 있습니다.'],
      ['guide', '분류 기준', 'book', '#2e2e2e', '#9aa5b1', '시간 단위, 반복성, AI 활용 가능성을 나눈 기준을 설명합니다.'],
    ];
    return `<h1>업무 매뉴얼</h1>
      <p class="lead">이 매뉴얼은 키글 스튜디오에서 <a href="#/about">Unity 클라이언트 개발자</a>로 일하며 맡고 있는 업무를 정리한 문서입니다. 프로젝트 하나를 기획 회의부터 출시와 운영까지 어떻게 맡는지, 어떤 일에 시간을 쓰는지, AI로 무엇을 줄이려는지를 처음부터 차례로 읽거나 필요한 부분만 찾아볼 수 있습니다.</p>
      <p>프로젝트마다 Unity 개발은 혼자 전담합니다. 개별 작업의 입력, 산출물, 소요 시간은 <a href="#/reference">업무 레퍼런스</a>에서 확인하세요.</p>
      <p>처음이라면 <a href="#/flow">프로젝트 흐름</a>부터 읽는 것을 권장합니다.</p>
      <hr>
      <h2>업무 매뉴얼 섹션</h2>
      <div class="cards">${sections
        .map(
          ([p, t, ic, c1, c2, d]) => `<a class="card" href="#/${p}">
            <div class="tile" style="--c1:${c1};--c2:${c2}">${icon(ic)}</div>
            <h3>${t}</h3><p>${d}</p></a>`
        )
        .join('')}</div>`;
  });

  // About
  add('about', '개발자 소개', '', () => {
    return `<h1>개발자 소개</h1>
      <p class="lead">${esc(D.meta.role)}입니다. 프로젝트 하나에 클라이언트 개발자, 기획자, 사운드 담당자가 한 명씩 참여하며, 그 프로젝트의 Unity 업무는 처음부터 끝까지 혼자 맡습니다.</p>
      ${stats([
        [TASKS.length, '세분화한 작업 수'],
        [CATS.length, '업무 영역(대분류)'],
        [D.flow.length, '프로젝트 진행 단계'],
        [`${fmt(TOTAL_H)}h`, '월 소요 시간(추정)'],
      ])}
      <h2>기본 정보</h2>
      <div class="table-wrap"><table class="kv"><tbody>
        <tr><th>직무</th><td>${esc(D.meta.role)}</td></tr>
        <tr><th>팀 구성</th><td>${esc(D.meta.team)}</td></tr>
        <tr><th>사용 도구</th><td>${esc(D.meta.tools)}</td></tr>
        <tr><th>협업 대상</th><td>기획, 사운드 (주간회의는 팀 전체)</td></tr>
      </tbody></table></div>

      <h2>팀 구성과 주고받는 것</h2>
      <div class="team">
        <div class="node"><b>기획</b><span>기획서 · 피드백 · QA 리스트</span></div>
        <div class="edge"><div>기획서 · 피드백 →</div><div>← 빌드 · 진행 상황</div></div>
        <div class="node me"><b>클라이언트 (Unity)</b><span>개발 · 빌드 · 출시 전담</span></div>
        <div class="edge"><div>← 사운드 파일 · 키 시트</div><div>테스트 빌드 · 공지 →</div></div>
        <div class="node"><b>사운드</b><span>사운드 리소스 · 사운드 피드백</span></div>
      </div>

      <h2>사용 도구</h2>
      <div class="table-wrap"><table><thead><tr><th>도구</th><th>주로 쓰는 업무</th></tr></thead><tbody>
        <tr><td class="nowrap"><b>Unity</b></td><td>기능·컨텐츠 개발, 연출, 파티클, 사운드 적용, 테스트·릴리즈 빌드, 프로파일링</td></tr>
        <tr><td class="nowrap"><b>GitLab</b></td><td>저장소 세팅, 커밋·브랜치·태그와 버전코드 관리, 진행 상황 확인</td></tr>
        <tr><td class="nowrap"><b>Slack</b></td><td>기획·사운드와의 소통, 피드백 수집, 테스트 빌드 배포 공지</td></tr>
        <tr><td class="nowrap"><b>스프레드시트</b></td><td>팀 스케줄 공유표, 피드백 시트, 사운드 키 시트, 다국어 시트</td></tr>
        <tr><td class="nowrap"><b>스토어 콘솔</b></td><td>Google Play Console, App Store Connect 앱 등록·심사 대응</td></tr>
      </tbody></table></div>

      <h2>한 달을 이렇게 씁니다</h2>
      <p>시간의 절반 가까이를 <a href="#/areas/dev">개발 구현</a>에, 4분의 1 정도를 <a href="#/areas/qa">피드백·QA</a>에 씁니다. 자세한 내용은 <a href="#/analysis">업무 분석</a>을 참고하세요.</p>
      ${bars(
        CATS.map((c) => ({ label: c.name, value: hoursOf(TASKS.filter((t) => t.cat === c.name)), href: `#/areas/${c.slug}` }))
          .sort((a, b) => b.value - a.value)
          .slice(0, 4)
      )}`;
  });

  // Flow
  add('flow', '프로젝트 흐름', '', () => {
    const always = TASKS.filter((t) => t.stage === '상시');
    return `<h1>프로젝트 흐름</h1>
      <p class="lead">프로젝트 하나는 아래 ${D.flow.length}단계로 진행됩니다. 단계마다 개발자가 하는 일과 다음 단계로 넘어가기 위한 완료 조건이 정해져 있습니다.</p>
      <div class="flow">${PHASES.map(
        (ph) => `<div class="flow-col"><a class="flow-head" href="#/flow/${ph.slug}">${ph.name}</a>${D.flow
          .filter((f) => f.group === ph.name)
          .map((f) => `<div class="flow-step"><small>${String(f.no).padStart(2, '0')}</small>${esc(f.stage)}</div>`)
          .join('')}</div>`
      ).join('')}</div>
      <h2>단계별 상세</h2>
      <div class="table-wrap"><table><thead><tr><th class="num">순서</th><th>구분</th><th>단계</th><th>시점·기간</th><th>개발자 주요 작업</th><th>완료 조건·산출물</th></tr></thead><tbody>
      ${D.flow
        .map(
          (f) => `<tr><td class="num">${f.no}</td><td class="nowrap">${esc(f.group)}</td><td class="nowrap"><b>${esc(f.stage)}</b></td><td>${esc(f.when)}</td><td>${esc(f.work)}${f.note ? `<br><span class="muted">※ ${esc(f.note)}</span>` : ''}</td><td>${esc(f.done)}</td></tr>`
        )
        .join('')}</tbody></table></div>
      <h2>단계와 상관없이 늘 하는 일</h2>
      <p>아래 작업은 특정 단계가 아니라 프로젝트 내내 이어집니다.</p>
      ${taskTable(always, { showCat: true })}`;
  });
  PHASES.forEach((ph) => {
    add(`flow/${ph.slug}`, `${ph.name} 단계`, 'flow', () => {
      const steps = D.flow.filter((f) => f.group === ph.name);
      const tasks = TASKS.filter((t) => ph.stages.includes(t.stage));
      return `<h1>${ph.name} 단계</h1>
        <p class="lead">${esc(ph.desc)}</p>
        ${steps
          .map(
            (f) => `<h3>${f.no}. ${esc(f.stage)}</h3>
          <div class="table-wrap"><table class="kv"><tbody>
            <tr><th>시점·기간</th><td>${esc(f.when)}</td></tr>
            <tr><th>개발자 주요 작업</th><td>${esc(f.work)}</td></tr>
            <tr><th>완료 조건·산출물</th><td>${esc(f.done)}</td></tr>
            ${f.note ? `<tr><th>비고</th><td>${esc(f.note)}</td></tr>` : ''}
          </tbody></table></div>`
          )
          .join('')}
        <h2>이 단계의 작업</h2>
        ${tasks.length ? taskTable(tasks, { showCat: true }) : '<p class="muted">업무 세분화 표에 이 단계로 분류된 작업이 없습니다.</p>'}`;
    });
  });

  // Areas
  add('areas', '업무 영역', '', () => {
    return `<h1>업무 영역</h1>
      <p class="lead">맡고 있는 업무를 ${CATS.length}개 대분류, ${TASKS.length}개 세부 작업으로 나눴습니다. 막대는 영역별 월 소요 시간과 전체 대비 비중입니다.</p>
      ${bars(
        CATS.map((c) => ({ label: c.name, value: hoursOf(TASKS.filter((t) => t.cat === c.name)), href: `#/areas/${c.slug}` })).sort((a, b) => b.value - a.value)
      )}
      <h2>영역 목록</h2>
      <div class="table-wrap"><table><thead><tr><th>영역</th><th>설명</th><th class="num">작업 수</th><th class="num">월 소요(h)</th></tr></thead><tbody>
      ${CATS.map((c) => {
        const ts = TASKS.filter((t) => t.cat === c.name);
        return `<tr><td class="nowrap"><a href="#/areas/${c.slug}">${c.name}</a></td><td>${esc(c.desc)}</td><td class="num">${ts.length}</td><td class="num">${fmt(hoursOf(ts))}</td></tr>`;
      }).join('')}</tbody></table></div>`;
  });
  CATS.forEach((c) => {
    add(`areas/${c.slug}`, c.name, 'areas', () => {
      const ts = TASKS.filter((t) => t.cat === c.name);
      const subs = [...new Set(ts.map((t) => t.sub))];
      const collab = [...new Set(ts.flatMap((t) => t.collab.split(',').map((s) => s.trim())).filter((s) => s && s !== '-'))];
      const tools = [...new Set(ts.flatMap((t) => t.tools.split(',').map((s) => s.trim())).filter((s) => s && s !== '-'))];
      const pains = ts.filter((t) => t.pain);
      return `<h1>${c.name}</h1>
        <p class="lead">${esc(c.desc)}</p>
        ${stats([
          [ts.length, '작업 수'],
          [`${fmt(hoursOf(ts))}h`, '월 소요 시간'],
          [`${pct(hoursOf(ts))}%`, '전체 시간 비중'],
          [ts.filter((t) => t.ai === '상').length, 'AI 활용 가능성 상'],
        ])}
        <div class="table-wrap"><table class="kv"><tbody>
          <tr><th>중분류</th><td>${subs.map(esc).join(', ')}</td></tr>
          <tr><th>도구</th><td>${tools.map(esc).join(', ') || '-'}</td></tr>
          <tr><th>협업 대상</th><td>${collab.map(esc).join(', ') || '-'}</td></tr>
        </tbody></table></div>
        ${pains.length ? `<div class="note"><p><b>불편 업무 ★</b></p>${pains.map((t) => `<p>${taskLink(t.id)} ${esc(t.task)}: 직접 '시간을 잡아먹는 일'로 꼽은 작업입니다.</p>`).join('')}</div>` : ''}
        <h2>작업 목록</h2>
        ${taskTable(ts)}
        <h2>AI 활용 아이디어</h2>
        <div class="table-wrap"><table><thead><tr><th>ID</th><th>작업</th><th>AI 활용 아이디어</th></tr></thead><tbody>
        ${ts
          .filter((t) => t.idea && t.idea !== '-')
          .map((t) => `<tr><td>${taskLink(t.id)}</td><td>${esc(t.task)}</td><td>${esc(t.idea)}</td></tr>`)
          .join('') || '<tr><td colspan="3" class="muted">없음</td></tr>'}
        </tbody></table></div>`;
    });
  });

  // Time units
  add('time', '시간 단위별 업무', '', () => {
    return `<h1>시간 단위별 업무</h1>
      <p class="lead">같은 업무라도 매일 하는 일과 프로젝트에 한 번 하는 일은 다르게 다뤄야 합니다. 작업을 얼마나 자주 하는지에 따라 네 가지로 묶었습니다.</p>
      <div class="table-wrap"><table><thead><tr><th>시간 단위</th><th>기준</th><th class="num">작업 수</th><th class="num">월 소요(h)</th><th class="num">비중</th></tr></thead><tbody>
      ${UNITS.map((u) => {
        const ts = TASKS.filter((t) => t.unit === u.name);
        return `<tr><td class="nowrap"><a href="#/time/${u.slug}">${u.name}</a></td><td>${esc(u.desc)}</td><td class="num">${ts.length}</td><td class="num">${fmt(hoursOf(ts))}</td><td class="num">${pct(hoursOf(ts))}%</td></tr>`;
      }).join('')}</tbody></table></div>
      ${bars(UNITS.map((u) => ({ label: u.name, value: hoursOf(TASKS.filter((t) => t.unit === u.name)), href: `#/time/${u.slug}` })))}
      <div class="tip"><p><b>읽는 법</b></p><p>일간 작업은 하나하나는 짧아도 모이면 가장 큰 시간이 됩니다. 반복이 잦은 일간·주간 작업이 자동화 효과가 큰 후보입니다.</p></div>`;
  });
  UNITS.forEach((u) => {
    add(`time/${u.slug}`, u.name, 'time', () => {
      const ts = TASKS.filter((t) => t.unit === u.name);
      return `<h1>${u.name} 업무</h1>
        <p class="lead">${esc(u.desc)}입니다. 모두 ${ts.length}개 작업, 월 ${fmt(hoursOf(ts))}시간(전체의 ${pct(hoursOf(ts))}%)입니다.</p>
        ${taskTable(ts, { showCat: true })}`;
    });
  });

  // Analysis
  add('analysis', '업무 분석', '', () => {
    const catRows = CATS.map((c) => ({ label: c.name, value: hoursOf(TASKS.filter((t) => t.cat === c.name)), href: `#/areas/${c.slug}` })).sort((a, b) => b.value - a.value);
    const aiRows = AI_ORDER.map((lv) => ({ label: `AI 활용 ${lv}`, value: hoursOf(TASKS.filter((t) => t.ai === lv)) }));
    const painTs = TASKS.filter((t) => t.pain);
    const top2 = catRows[0].value + catRows[1].value;
    const aiHigh = aiRows[0].value;
    const aiMid = aiRows[1].value;
    return `<h1>업무 분석</h1>
      <p class="lead">업무 세분화 표의 추정값으로 월 소요 시간을 계산했습니다. 전체 ${TASKS.length}개 작업, 월 약 <b>${fmt(TOTAL_H)}시간</b>입니다.</p>
      <div class="note"><p><b>추정값 안내</b></p><p>월 소요 시간 = 월 빈도 × 회당 소요 시간입니다. 실제 기록이 아닌 추정값이므로 비중을 보는 용도로 읽어 주세요.</p></div>
      <h2>요약</h2>
      <ul>
        <li><b>${catRows[0].label}</b>와 <b>${catRows[1].label}</b> 두 영역이 전체 시간의 <b>${pct(top2)}%</b>를 차지합니다.</li>
        <li>AI 활용 가능성이 <b>상</b>인 작업이 월 ${fmt(aiHigh)}시간(${pct(aiHigh)}%), <b>중</b>인 작업까지 더하면 ${fmt(aiHigh + aiMid)}시간(${pct(aiHigh + aiMid)}%)입니다.</li>
        <li>직접 꼽은 불편 업무 ★ ${painTs.length}개(${painTs.map((t) => taskLink(t.id)).join(', ')})는 월 ${fmt(hoursOf(painTs))}시간입니다.</li>
      </ul>
      <h2>영역별 월 소요 시간</h2>
      ${bars(catRows)}
      <h2>시간 단위별 월 소요 시간</h2>
      ${bars(UNITS.map((u) => ({ label: u.name, value: hoursOf(TASKS.filter((t) => t.unit === u.name)), href: `#/time/${u.slug}` })))}
      <h2>AI 활용 가능성별 월 소요 시간</h2>
      ${bars(aiRows)}
      <div class="table-wrap"><table><thead><tr><th>AI 활용 가능성</th><th>기준</th><th class="num">작업 수</th><th class="num">월 소요(h)</th></tr></thead><tbody>
      ${AI_ORDER.map((lv) => {
        const ts = TASKS.filter((t) => t.ai === lv);
        const rule = (D.meta.rules['AI 활용 가능성'] || '').split('/').map((s) => s.trim()).find((s) => s.startsWith(lv + ':')) || '';
        return `<tr><td>${aiBadge(lv)}</td><td>${esc(rule.replace(/^.:\s*/, ''))}</td><td class="num">${ts.length}</td><td class="num">${fmt(hoursOf(ts))}</td></tr>`;
      }).join('')}</tbody></table></div>
      <h2>시간이 많이 드는 작업 Top 10</h2>
      ${taskTable([...TASKS].sort((a, b) => b.monthly - a.monthly).slice(0, 10), { showCat: true, total: false })}`;
  });

  // AI plan
  add('ai', 'AI 활용 계획', '', () => {
    return `<h1>AI 활용 계획</h1>
      <p class="lead">AI 에이전트로 자동화하거나 보조할 업무를 우선순위대로 정리했습니다. 1, 2순위는 직접 '시간을 잡아먹는 일'로 꼽은 불편 업무 ★입니다.</p>
      <div class="table-wrap"><table><thead><tr><th class="num">순위</th><th>업무</th><th>관련 작업</th><th>난이도</th><th>기대 효과</th></tr></thead><tbody>
      ${D.ai
        .map(
          (a) => `<tr class="${a.name.includes('★') ? 'pain' : ''}"><td class="num">${a.rank}</td><td><a href="#/ai/${a.rank}">${esc(a.name.replace('★', '').trim())}</a>${a.name.includes('★') ? ' <span class="star">★</span>' : ''}</td><td class="nowrap">${expandIds(a.ids).map(taskLink).join(' ')}</td><td class="nowrap">${esc(a.diff)}</td><td>${esc(a.effect)}</td></tr>`
        )
        .join('')}</tbody></table></div>
      <div class="tip"><p><b>원칙</b></p><p>입력과 출력이 명확한 확인·정리 작업부터 자동화합니다. 회의 참석, 연출 감각, 스토어 입력처럼 사람의 판단이 핵심인 일은 AI가 초안과 체크리스트로 보조만 합니다.</p></div>`;
  });
  D.ai.forEach((a) => {
    const title = a.name.replace('★', '').trim();
    add(`ai/${a.rank}`, `${a.rank}. ${title}`, 'ai', () => {
      const items = a.can.split(/\n|(?=[①②③④⑤])/).map((s) => s.replace(/^[①②③④⑤]\s*/, '').trim()).filter(Boolean);
      const ids = expandIds(a.ids);
      return `<h1>${esc(title)}${a.name.includes('★') ? ' <span class="star">★</span>' : ''}</h1>
        <p class="lead">우선순위 ${a.rank}위 · 난이도 ${esc(a.diff)} · 기대 효과: ${esc(a.effect)}</p>
        <h2>지금 방식</h2>
        <p>${esc(a.now)}</p>
        <h2>AI가 해줄 수 있는 것</h2>
        <ol class="steps">${items.map((s) => `<li>${esc(s)}</li>`).join('')}</ol>
        <h2>필요한 재료·연결</h2>
        <p>${esc(a.need)}</p>
        <div class="tip"><p><b>바로 해볼 첫 단계</b></p><p>${esc(a.first)}</p></div>
        <h2>관련 작업</h2>
        ${taskTable(ids.map((id) => byId[id]).filter(Boolean), { showCat: true })}`;
    });
  });

  // Guide
  add('guide', '분류 기준', '', () => {
    const rule = (k) =>
      (D.meta.rules[k] || '')
        .split('/')
        .map((s) => s.trim())
        .filter(Boolean)
        .map((s) => {
          const i = s.indexOf(':');
          return `<tr><td class="nowrap"><b>${esc(s.slice(0, i))}</b></td><td>${esc(s.slice(i + 1).trim())}</td></tr>`;
        })
        .join('');
    return `<h1>분류 기준</h1>
      <p class="lead">업무를 세분화할 때 쓴 분류 기준입니다. 모든 작업은 대분류 → 중분류 → 세부 작업의 3단계로 나눴고, 아래 기준으로 속성을 붙였습니다.</p>
      <h2>시간 단위</h2>
      <div class="table-wrap"><table><thead><tr><th>값</th><th>기준</th></tr></thead><tbody>${rule('시간 단위')}</tbody></table></div>
      <h2>반복성</h2>
      <div class="table-wrap"><table><thead><tr><th>값</th><th>기준</th></tr></thead><tbody>${rule('반복성')}</tbody></table></div>
      <h2>AI 활용 가능성</h2>
      <div class="table-wrap"><table><thead><tr><th>값</th><th>기준</th></tr></thead><tbody>${rule('AI 활용 가능성')}</tbody></table></div>
      <h2>불편 업무 ★</h2>
      <p>본인이 직접 '시간을 잡아먹는 일'로 지목한 업무입니다. 표에서는 붉은 배경과 <span class="star">★</span>로 표시합니다.</p>
      <h2>월 소요 시간</h2>
      <p>월 빈도(회) × 회당 소요(h)로 계산한 추정값입니다. 예를 들어 주 1회, 30분 걸리는 일은 4 × 0.5 = 월 2시간입니다.</p>`;
  });

  // Reference
  add('reference', '업무 레퍼런스', null, () => {
    return `<h1>업무 레퍼런스</h1>
      <p class="lead">${TASKS.length}개 작업 전체 목록입니다. 작업 ID를 누르면 입력, 산출물, 도구, 협업 대상과 AI 활용 아이디어를 볼 수 있습니다.</p>
      <div class="filters" id="filters">
        <label>영역 <select data-k="cat"><option value="">전체</option>${CATS.map((c) => `<option>${c.name}</option>`).join('')}</select></label>
        <label>시간 단위 <select data-k="unit"><option value="">전체</option>${UNITS.map((u) => `<option>${u.name}</option>`).join('')}</select></label>
        <label>AI 활용 <select data-k="ai"><option value="">전체</option>${AI_ORDER.map((l) => `<option>${l}</option>`).join('')}</select></label>
        <label><input type="checkbox" data-k="pain"> 불편 업무 ★만</label>
        <span class="count" id="refCount"></span>
      </div>
      <div id="refTable"></div>`;
  }, 'reference', {
    after() {
      const box = $('#filters');
      const draw = () => {
        const f = {};
        box.querySelectorAll('[data-k]').forEach((el) => (f[el.dataset.k] = el.type === 'checkbox' ? el.checked : el.value));
        const list = TASKS.filter((t) => (!f.cat || t.cat === f.cat) && (!f.unit || t.unit === f.unit) && (!f.ai || t.ai === f.ai) && (!f.pain || t.pain));
        $('#refTable').innerHTML = list.length ? taskTable(list, { showCat: true }) : '<p class="muted">조건에 맞는 작업이 없습니다.</p>';
        $('#refCount').textContent = `${list.length}개 · 월 ${fmt(hoursOf(list))}h`;
      };
      box.addEventListener('change', draw);
      draw();
    },
  });
  CATS.forEach((c) => {
    add(`reference/${c.slug}`, c.name, 'reference', () => {
      const ts = TASKS.filter((t) => t.cat === c.name);
      return `<h1>${c.name}</h1>
        <p class="lead">${esc(c.desc)}</p>
        <p>영역 소개와 분석은 매뉴얼의 <a href="#/areas/${c.slug}">${c.name}</a> 페이지를 참고하세요.</p>
        ${taskTable(ts)}`;
    }, 'reference');
  });
  TASKS.forEach((t) => {
    const c = catByName[t.cat];
    add(`task/${t.id}`, t.id, `reference/${c.slug}`, () => {
      const ais = aiForTask(t.id);
      const sibs = TASKS.filter((x) => x.cat === t.cat && x.id !== t.id);
      const row = (k, v) => `<tr><th>${k}</th><td>${v}</td></tr>`;
      return `<h1><span class="mono" style="font-size:.7em;color:var(--muted)">${t.id}</span><br>${esc(t.task)}${star(t)}</h1>
        <p class="lead"><a href="#/areas/${c.slug}">${esc(t.cat)}</a> › ${esc(t.sub)} · ${aiBadge(t.ai)}</p>
        <h2>설명</h2>
        <p><b>${esc(t.input)}</b>을(를) 받아 <b>${esc(t.output)}</b>을(를) 만드는 작업입니다. ${esc(t.unit)} 업무로, ${t.collab && t.collab !== '-' ? `${esc(t.collab)}와(과) 협업합니다.` : '혼자 진행합니다.'}</p>
        <h2>속성</h2>
        <div class="table-wrap"><table class="kv"><tbody>
          ${row('대분류 / 중분류', `${esc(t.cat)} / ${esc(t.sub)}`)}
          ${row('프로젝트 단계', esc(t.stage))}
          ${row('시간 단위', esc(t.unit))}
          ${row('월 빈도', `${fmt(t.freq)}회`)}
          ${row('회당 소요', `${fmt(t.hours)}시간`)}
          ${row('월 소요', `<b>${fmt(t.monthly)}시간</b> (전체의 ${((t.monthly / TOTAL_H) * 100).toFixed(1)}%)`)}
          ${row('입력(받는 것)', esc(t.input))}
          ${row('산출물', esc(t.output))}
          ${row('도구', esc(t.tools))}
          ${row('협업 대상', esc(t.collab))}
          ${row('반복성', esc(t.repeat))}
          ${row('AI 활용 가능성', aiBadge(t.ai))}
          ${row('불편 업무', t.pain ? '<span class="star">★ 직접 꼽은 불편 업무</span>' : '-')}
        </tbody></table></div>
        <h2>AI 활용 아이디어</h2>
        <p>${t.idea && t.idea !== '-' ? esc(t.idea) : '<span class="muted">사람의 판단이 핵심인 작업이라 아이디어가 없습니다.</span>'}</p>
        ${ais.map((a) => `<div class="tip"><p><b>AI 활용 계획 ${a.rank}순위</b></p><p><a href="#/ai/${a.rank}">${esc(a.name.replace('★', '').trim())}</a>에 포함된 작업입니다. 첫 단계: ${esc(a.first)}</p></div>`).join('')}
        <h2>같은 영역의 다른 작업</h2>
        ${taskTable(sibs, { total: false })}`;
    }, 'reference', { label: t.task });
  });

  // Search
  add('search', '검색 결과', null, (q) => {
    const query = (q || '').trim();
    if (!query) return '<h1>검색</h1><p>검색어를 입력하세요.</p>';
    const terms = query.toLowerCase().split(/\s+/);
    const hit = (s) => terms.every((w) => s.toLowerCase().includes(w));
    const mark = (s) => {
      let out = esc(s);
      terms.forEach((w) => {
        if (!w) return;
        const re = new RegExp(esc(w).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
        out = out.replace(re, (m) => `<mark>${m}</mark>`);
      });
      return out;
    };
    const pages = NODES.filter((n) => n.mode === 'manual' && n.path !== 'search' && hit(n.title));
    const tasks = TASKS.filter((t) => hit([t.id, t.cat, t.sub, t.task, t.stage, t.unit, t.tools, t.collab, t.idea, t.input, t.output].join(' ')));
    return `<h1>검색 결과</h1>
      <p class="lead">'${esc(query)}' 검색 결과: 페이지 ${pages.length}개, 작업 ${tasks.length}개</p>
      ${pages.map((n) => `<div class="search-hit"><h3><a href="#/${n.path}">${mark(n.title)}</a></h3><p class="muted">${crumbs(n).map((x) => esc(x.title)).join(' › ')}</p></div>`).join('')}
      ${tasks
        .map(
          (t) => `<div class="search-hit"><h3><a href="#/task/${t.id}">${t.id} ${mark(t.task)}</a>${star(t)}</h3><p class="muted">${esc(t.cat)} › ${esc(t.sub)} · ${esc(t.unit)} · 월 ${fmt(t.monthly)}h</p>${t.idea && t.idea !== '-' ? `<p>${mark(t.idea)}</p>` : ''}</div>`
        )
        .join('')}
      ${!pages.length && !tasks.length ? '<p>일치하는 결과가 없습니다. 다른 검색어를 입력해 보세요.</p>' : ''}`;
  }, 'search');

  // ---------- layout ----------
  function crumbs(n) {
    const chain = [];
    for (let x = n; x; x = x.parent != null ? NODE[x.parent] : null) chain.unshift(x);
    return chain;
  }
  function order(mode) {
    const roots = NODES.filter((n) => n.parent == null && n.mode === mode);
    const out = [];
    const walk = (n) => {
      out.push(n);
      n.children.forEach(walk);
    };
    roots.forEach(walk);
    return out;
  }
  const ORDER = { manual: order('manual'), reference: order('reference') };

  function renderToc(current) {
    const mode = current.mode === 'reference' ? 'reference' : 'manual';
    const active = new Set(crumbs(current).map((n) => n.path));
    const item = (n) => {
      const kids = n.children;
      const open = active.has(n.path) || (n.path === '' && mode === 'manual');
      const label = n.label ? `<span class="tid">${esc(n.title)}</span>${esc(n.label)}` : esc(n.title);
      const link = `<a href="#/${n.path}" class="${n.path === current.path ? 'current' : ''}">${label}</a>`;
      if (!kids.length) return `<li><div class="row"><span class="leaf"></span>${link}</div></li>`;
      return `<li class="${open ? 'open' : ''}"><div class="row"><button class="tg" aria-label="펼치기"></button>${link}</div><ul>${kids.map(item).join('')}</ul></li>`;
    };
    $('#sidebarTitle').textContent = mode === 'reference' ? '업무 레퍼런스' : '매뉴얼';
    const root = NODES.find((n) => n.parent == null && n.mode === mode);
    const tree =
      mode === 'manual'
        ? `<ul>${item({ ...root, children: [] })}${root.children.map(item).join('')}</ul>`
        : `<ul>${item(root)}</ul>`;
    $('#toc').innerHTML = tree;
  }

  function renderNextPrev(current) {
    const list = ORDER[current.mode] || [];
    const i = list.indexOf(current);
    const prev = i > 0 ? list[i - 1] : null;
    const next = i >= 0 && i < list.length - 1 ? list[i + 1] : null;
    const html =
      (prev ? `<a href="#/${prev.path}" title="${esc(prev.title)}" aria-label="이전: ${esc(prev.title)}">${icon('left')}</a>` : '<span></span>') +
      (next ? `<a href="#/${next.path}" title="${esc(next.title)}" aria-label="다음: ${esc(next.title)}">${icon('right')}</a>` : '<span></span>');
    $('#nextprevTop').innerHTML = html;
    $('#nextprevBottom').innerHTML = html;
    const show = current.mode !== 'search';
    $('#nextprevTop').style.display = show ? '' : 'none';
    $('#nextprevBottom').style.display = show ? '' : 'none';
  }

  function route() {
    const raw = decodeURIComponent(location.hash.replace(/^#\/?/, ''));
    const [path, qs] = raw.split('?');
    const node = NODE[path] || NODE[''];
    const q = new URLSearchParams(qs || '').get('q') || '';

    $('#page').innerHTML = node.render(q);
    if (node.after) node.after();

    const chain = node.mode === 'search' ? [node] : crumbs(node);
    $('#breadcrumbs').innerHTML = chain
      .map((n, i) => (i < chain.length - 1 ? `<a href="#/${n.path}">${esc(n.title)}</a><span class="sep">›</span>` : `<span>${esc(n.label ? `${n.title} ${n.label}` : n.title)}</span>`))
      .join('');

    renderToc(node.mode === 'search' ? NODE[''] : node);
    renderNextPrev(node);

    document.querySelectorAll('.menu a').forEach((a) => a.classList.toggle('selected', a.dataset.mode === (node.mode === 'reference' ? 'reference' : 'manual')));
    document.title = node.path === '' ? '업무 매뉴얼 - Unity 클라이언트 개발자' : `${node.label ? `${node.title} ${node.label}` : node.title} - 업무 매뉴얼`;
    $('#searchInput').value = $('#searchInputMobile').value = q;
    document.body.classList.remove('nav-open');
    window.scrollTo(0, 0);
    const cur = $('#toc a.current');
    if (cur) cur.scrollIntoView({ block: 'nearest' });
  }

  // ---------- events ----------
  $('#toc').addEventListener('click', (e) => {
    const btn = e.target.closest('.tg');
    if (btn) btn.closest('li').classList.toggle('open');
  });
  const doSearch = (input) => (e) => {
    e.preventDefault();
    const v = input.value.trim();
    location.hash = `#/search?q=${encodeURIComponent(v)}`;
  };
  $('#searchForm').addEventListener('submit', doSearch($('#searchInput')));
  $('#searchFormMobile').addEventListener('submit', doSearch($('#searchInputMobile')));
  $('#navToggle').addEventListener('click', () => {
    const open = document.body.classList.toggle('nav-open');
    $('#navToggle').setAttribute('aria-expanded', String(open));
  });
  $('#scrim').addEventListener('click', () => document.body.classList.remove('nav-open'));
  window.addEventListener('hashchange', route);
  route();
})();
