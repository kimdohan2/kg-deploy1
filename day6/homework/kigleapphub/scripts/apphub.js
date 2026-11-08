// 앱허브 D1 데이터베이스를 읽고 찾는다. 읽기만 한다.
// 앱허브 코드는 건드리지 않고, 앱허브 배포용 wrangler 로그인으로 D1을 직접 읽는다.
// 실행하는 SQL은 아래 BOARD_SQL 하나뿐이다 (AI가 SQL을 만들지 않는다).
//
// 직접 확인할 때:
//   npm run ask -- 목록
//   npm run ask -- 찾기 코코비 치과 애드몹
//   npm run ask -- 담당 김도한
import { execFile } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

const root = fileURLToPath(new URL('..', import.meta.url));
const env = { ...(existsSync(`${root}.env`) ? dotenv.parse(readFileSync(`${root}.env`, 'utf8')) : {}), ...process.env };

const DB = env.APPHUB_D1_NAME || 'kigle-apphub';
const CACHE_MS = 3 * 60 * 1000;

const BOARD_SQL = [
  'SELECT id, name, status, period FROM projects ORDER BY created_at',
  'SELECT id, project_id, name, sort_order FROM slot_groups ORDER BY sort_order, created_at',
  'SELECT id, project_id, group_id, name, sort_order FROM custom_slots ORDER BY sort_order, created_at',
  'SELECT project_id, slot_id, url, memo FROM links',
  'SELECT id, name, role FROM people ORDER BY sort_order, created_at',
  'SELECT project_id, person_id FROM project_people',
].join('; ');

export const STATUSES = { plan: '기획중', dev: '개발중', live: '라이브', done: '종료' };
export const ROLES = { dev: '개발', plan: '기획', design: '디자인', sound: '사운드' };

function runWrangler() {
  const configHome = (env.WRANGLER_CONFIG_HOME || '~/.config/kigle-wrangler').replace(/^~/, homedir());
  return new Promise((resolve, reject) => {
    execFile(`${root}node_modules/.bin/wrangler`, ['d1', 'execute', DB, '--remote', '--json', '--command', BOARD_SQL], {
      cwd: root,
      env: { ...process.env, XDG_CONFIG_HOME: configHome, CLOUDFLARE_ACCOUNT_ID: env.CLOUDFLARE_ACCOUNT_ID || '',
        WRANGLER_SEND_METRICS: 'false' },
      timeout: 60_000,
      maxBuffer: 20 * 1024 * 1024,
    }, (err, stdout, stderr) => {
      if (err) return reject(new Error(`앱허브를 읽지 못했어요: ${(stderr || err.message).trim().split('\n').slice(-3).join(' ')}`));
      try { resolve(JSON.parse(stdout)); } catch { reject(new Error('앱허브 응답을 읽지 못했어요.')); }
    });
  });
}

function buildBoard(results) {
  const [projects, groups, slots, links, people, projectPeople] = results.map(r => r.results);
  const linkOf = new Map(links.map(l => [`${l.project_id}|${l.slot_id}`, l]));
  const personOf = new Map(people.map(p => [p.id, { name: p.name, role: ROLES[p.role] || p.role }]));

  const board = projects.map(p => {
    const myGroups = groups.filter(g => g.project_id === p.id).map(g => ({ id: g.id, name: g.name, items: [] }));
    const byId = new Map(myGroups.map(g => [g.id, g]));
    for (const s of slots.filter(s => s.project_id === p.id)) {
      const link = linkOf.get(`${p.id}|${s.id}`);
      const group = byId.get(s.group_id) || (byId.size ? myGroups[0] : null);
      const item = { name: s.name, url: link?.url || '', memo: link?.memo || '' };
      if (group) group.items.push(item);
    }
    return {
      name: p.name,
      status: STATUSES[p.status] || p.status,
      period: p.period || '',
      people: projectPeople.filter(pp => pp.project_id === p.id).map(pp => personOf.get(pp.person_id)).filter(Boolean),
      groups: myGroups.map(({ name, items }) => ({ name, items })),
    };
  });
  return { projects: board, people: people.map(p => personOf.get(p.id)) };
}

let cache = null;
export async function loadBoard() {
  if (cache && Date.now() - cache.at < CACHE_MS) return cache.board;
  const board = buildBoard(await runWrangler());
  cache = { at: Date.now(), board };
  return board;
}

// ---------- 찾기 ----------

// 대소문자·띄어쓰기 무시 ("코코비 치과" = "코코비치과")
const key = s => String(s ?? '').normalize('NFC').toLowerCase().replace(/[\s_\-·.]+/g, '');

// 영어나 줄임말로 부르는 항목 이름
const ALIASES = {
  구글플레이콘솔: ['플레이콘솔', '플레이스토어', '구글플레이', '플레이', 'googleplay', 'playconsole', '구글콘솔'],
  앱스토어커넥트: ['앱스토어', '앱스토어콘솔', '애플', 'appstore', 'appstoreconnect', 'asc', '아이폰'],
  파이어베이스: ['firebase', '파베'],
  파이어베이스이벤트: ['firebaseevent', '파베이벤트', '이벤트'],
  애드몹: ['admob', '광고'],
  깃랩: ['gitlab', '깃', 'git', '저장소'],
  기획서: ['기획', '기획문서'],
  앱스케쥴: ['앱스케줄', '스케줄', '스케쥴', '일정'],
  qa시트: ['qa', '큐에이', '테스트'],
  앱텍스트: ['텍스트', '번역', '번역텍스트'],
  앱소개글: ['소개글', '스토어소개', '설명'],
};

function bigrams(s) {
  const out = new Set();
  for (let i = 0; i < s.length - 1; i++) out.add(s.slice(i, i + 2));
  return out;
}

// 0~1 점수. 같으면 1, 한쪽이 다른 쪽에 들어 있으면 0.8, 아니면 두 글자씩 겹친 정도.
function score(query, name, aliases = []) {
  const q = key(query);
  if (!q) return 0;
  let best = 0;
  for (const n of [key(name), ...aliases.map(key)]) {
    if (!n) continue;
    if (q === n) return 1;
    if (n.includes(q) || q.includes(n)) best = Math.max(best, n === key(name) ? 0.8 : 0.75);
    const a = bigrams(q), b = bigrams(n);
    if (a.size && b.size) {
      let same = 0;
      for (const x of a) if (b.has(x)) same++;
      best = Math.max(best, (2 * same) / (a.size + b.size));
    }
  }
  return best;
}

const best = (list, query, nameOf, aliasesOf = () => []) => {
  const scored = list.map(x => ({ x, s: score(query, nameOf(x), aliasesOf(x)) })).filter(r => r.s >= 0.4);
  if (!scored.length) return [];
  const top = Math.max(...scored.map(r => r.s));
  return scored.filter(r => r.s >= top - 0.05).sort((a, b) => b.s - a.s).map(r => r.x);
};

const itemAliases = name => ALIASES[key(name)] || [];

function matchProjects(projects, query) {
  if (!query) return projects;
  // "코코비"처럼 모든 프로젝트에 붙는 말은 빼고 비교한다
  const strip = s => key(s).replace(/^코코비/, '');
  const q = strip(query);
  const direct = best(projects, q || key(query), p => strip(p.name));
  return direct;
}

export async function listProjects({ status } = {}) {
  const { projects } = await loadBoard();
  const list = status ? projects.filter(p => key(p.status) === key(status) || key(STATUSES[status] || '') === key(p.status)) : projects;
  return {
    projects: list.map(p => ({
      name: p.name, status: p.status, period: p.period || undefined,
      people: p.people.map(x => `${x.name}(${x.role})`),
      emptyLinks: p.groups.flatMap(g => g.items).filter(i => !i.url).length,
    })),
    itemNames: [...new Set(projects.flatMap(p => p.groups.flatMap(g => g.items.map(i => i.name))))],
  };
}

export async function findLinks({ project, item } = {}) {
  const { projects } = await loadBoard();
  const matched = matchProjects(projects, project);
  if (project && !matched.length) {
    return { found: false, reason: `'${project}' 프로젝트를 찾지 못했어요.`, projectNames: projects.map(p => p.name) };
  }
  if (!project && !item) return { found: false, reason: '프로젝트 이름이나 항목 이름을 알려 주세요.' };
  if (matched.length > 5 && item) {
    // 프로젝트 없이 항목만 물으면("각 프로젝트 기획서") 모든 프로젝트를 한 줄씩 한 번에 돌려준다
    const rows = matched.map(p => {
      const all = p.groups.flatMap(g => g.items);
      const [hit] = best(all, item, i => i.name, i => itemAliases(i.name));
      return { project: p.name, status: p.status, item: hit?.name ?? null, url: hit?.url || null };
    }).filter(r => r.item);
    if (!rows.length) {
      return { found: false, reason: `'${item}' 항목을 찾지 못했어요.`,
        itemNames: [...new Set(matched.flatMap(p => p.groups.flatMap(g => g.items.map(i => i.name))))] };
    }
    return { found: true, allProjects: rows, emptyCount: rows.filter(r => !r.url).length };
  }
  const results = [];
  for (const p of matched.slice(0, 5)) {
    const all = p.groups.flatMap(g => g.items.map(i => ({ ...i, group: g.name })));
    const items = item ? best(all, item, i => i.name, i => itemAliases(i.name)) : all;
    results.push({
      project: p.name, status: p.status,
      items: items.map(i => ({ group: i.group, name: i.name, url: i.url || null, memo: i.memo || undefined })),
      ...(item && !items.length ? { itemNames: all.map(i => i.name) } : {}),
    });
  }
  return { found: results.some(r => r.items.length), results };
}

export async function who({ project, person } = {}) {
  const { projects, people } = await loadBoard();
  if (person) {
    const found = best(people, person, p => p.name);
    if (!found.length) {
      return { found: false, reason: `앱허브에 '${person}' 담당자가 없어요.`, people: people.map(p => `${p.name}(${p.role})`) };
    }
    return {
      found: true,
      people: found.map(x => ({
        name: x.name, role: x.role,
        projects: projects.filter(p => p.people.some(pp => pp.name === x.name)).map(p => ({
          name: p.name, status: p.status, period: p.period || undefined,
          emptyLinks: p.groups.flatMap(g => g.items).filter(i => !i.url).map(i => i.name),
        })),
      })),
    };
  }
  if (project) {
    const matched = matchProjects(projects, project);
    if (!matched.length) return { found: false, reason: `'${project}' 프로젝트를 찾지 못했어요.`, projectNames: projects.map(p => p.name) };
    return {
      found: true,
      projects: matched.slice(0, 5).map(p => ({
        name: p.name, status: p.status,
        people: p.people.length ? p.people.map(x => `${x.name}(${x.role})`) : '담당자가 아직 등록되지 않았어요',
      })),
    };
  }
  return { found: true, people: people.map(p => `${p.name}(${p.role})`) };
}

// ---------- 직접 실행 ----------

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const [cmd, ...rest] = process.argv.slice(2);
  const words = rest.join(' ');
  const run = {
    목록: () => listProjects(),
    // "찾기 코코비 치과 애드몹" → 마지막 낱말을 항목으로 본다
    찾기: () => rest.length > 1 ? findLinks({ project: rest.slice(0, -1).join(' '), item: rest.at(-1) }) : findLinks({ item: words }),
    담당: () => who({ person: words }),
    누구: () => who({ project: words }),
  }[cmd];
  if (!run) {
    console.log('사용법: npm run ask -- 목록 | 찾기 [프로젝트] 항목 | 담당 이름 | 누구 프로젝트');
    process.exit(1);
  }
  run().then(r => console.log(JSON.stringify(r, null, 2))).catch(e => { console.error(`✗ ${e.message}`); process.exit(1); });
}
