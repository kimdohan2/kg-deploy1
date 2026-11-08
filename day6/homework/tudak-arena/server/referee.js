// 심판(사회자) 봇 — 게임 사건을 보고 "누가, 언제" 말할지 정해서 디스코드에서 그 봇을 멘션한다.
// 봇들(Hermes)은 멘션받을 때만 말하므로, 수다의 양과 간격은 전부 여기서 조절된다.
import { Client, GatewayIntentBits, Events } from 'discord.js';
import { Judge } from './judge.js';

const rand = (a, b) => a + Math.random() * (b - a);
const pick = arr => arr[Math.floor(Math.random() * arr.length)];

// 받침 있으면 첫 번째, 없으면 두 번째 조사 (한글이 아니면 받침 없음으로 본다)
function josa(word, withBatchim, without) {
  const code = word.charCodeAt(word.length - 1);
  const has = code >= 0xac00 && code <= 0xd7a3 && (code - 0xac00) % 28 !== 0;
  return word + (has ? withBatchim : without);
}
const iga = w => josa(w, '이', '가');
const eulreul = w => josa(w, '을', '를');

// 토큰 첫 부분은 봇 사용자 ID를 base64로 담고 있다
function idFromToken(token) {
  try { return Buffer.from(token.split('.')[0], 'base64').toString('utf8'); } catch { return null; }
}

export class Referee {
  constructor({ game, bots, player, cfg, env, io, voice, clips }) {
    this.game = game;
    this.clips = clips;           // 즉시 감탄사 (clips.js)
    this.callName = player?.callName || '사람 친구';   // 봇들이 사람 플레이어를 부르는 이름
    this.voice = voice;           // 음성방 말하는 차례 (floor.js)
    this.bots = bots;
    this.cfg = cfg;
    this.env = env;
    this.io = io;
    this.enabled = true;
    this.discord = null;
    this.status = 'off';
    this.botIds = new Map();      // botId -> 디스코드 사용자 ID
    this.idToBot = new Map();     // 디스코드 사용자 ID -> botId
    this.nextFree = new Map();    // botId -> 다시 말할 수 있는 시각
    this.speaking = new Map();    // botId -> 대답을 기다리기 시작한 시각 (말하는 중인 봇)
    this.floorAt = 0;             // 앞사람이 말을 끝낸 뒤 잠깐 쉬는 시간이 끝나는 시각
    this.queue = [];              // 누가 말하는 중이라 미뤄 둔 중요한 한마디 (탈락·우승)
    this.pending = new Map();     // botId -> 대꾸 깊이
    this.recent = [];             // 최근 1분 동안 부른 시각
    this.buffer = [];
    this.lastSpeech = Date.now();
    this.log = [];                // 최근 대화 (Jev 판단에 흐름으로 넘긴다)
    this.bubbles = new Map();     // botId -> 목소리가 나오면 웹에 띄울 말풍선
    // 웹 말풍선은 그 봇의 목소리가 나오기 시작할 때 띄운다 (글이 목소리보다 먼저 올라오므로)
    voice?.on('speak', (id, isClip) => { if (!isClip) this.showBubble(id); });
    this.judge = new Judge({ env, bots });
    console.log(`[심판] Jev 판단: ${this.judge.enabled ? '켜짐' : '꺼짐 (TYPESAFE_API_KEY 없음 → 규칙대로)'}`);
    this.resetStats();
    for (const b of bots) {
      const id = env[b.tokenEnv] ? idFromToken(env[b.tokenEnv]) : null;
      if (id) { this.botIds.set(b.id, id); this.idToBot.set(id, b.id); }
    }
    game.on('event', ev => this.onGameEvent(ev));
    setInterval(() => this.idleCheck(), 5000);
    setInterval(() => this.pump(), 300);
  }

  // 사건 순간의 즉시 감탄사: 미리 만든 짧은 소리라 Claude를 거치지 않고 바로 나온다.
  // 상황에 맞는 긴 말(수다)은 아래 묶음 처리(flush → react)로 따로, 조금 뒤에 나온다.
  // 그 봇의 kind 감탄사를 확률 p로 낸다 (봇이 아니거나 감탄사가 없으면 아무 일 없음).
  playClip(id, kind, p = 1) {
    if (!this.clips || !this.bots.some(b => b.id === id) || Math.random() >= p) return;
    const text = this.clips.play(id, kind);
    if (text) this.io.emit('say', { id, text });
  }

  instantClip(ev) {
    if (!this.clips) return;
    const isBot = id => this.bots.some(b => b.id === id);
    const say = (id, kind, p) => this.playClip(id, kind, p);
    if (ev.type === 'out') {
      say(ev.victim, ev.pusher ? 'out' : 'oops');
      if (ev.pusher) say(ev.pusher, 'gotcha', 0.6);
    } else if (ev.type === 'hard_hit') {
      say(ev.victim, 'hit', 0.5);
    } else if (ev.type === 'win') {
      if (isBot(ev.winner)) say(ev.winner, 'win');
      else say(pick(this.bots).id, 'lose');
    }
  }

  resetStats() {
    this.pushes = {};      // pushes[a][b] = a가 b를 떨어뜨린 횟수
    this.selfOuts = {};
    this.streak = { id: null, n: 0 };
    this.roundLog = [];
  }

  async start() {
    const { DISCORD_TOKEN_REFEREE: token, DISCORD_TEXT_CHANNEL_ID: channelId } = this.env;
    if (!token || !channelId) {
      console.log('[심판] 디스코드 토큰이나 채널 ID가 없어서 콘솔에만 기록합니다.');
      return;
    }
    const client = new Client({
      intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent],
    });
    client.on(Events.MessageCreate, msg => this.onDiscordMessage(msg));
    try {
      await client.login(token);
      this.channel = await client.channels.fetch(channelId);
      this.discord = client;
      this.setStatus('connected');
      console.log(`[심판] 디스코드 연결됨: #${this.channel.name}`);
    } catch (err) {
      this.setStatus('error');
      console.error('[심판] 디스코드 연결 실패:', err.message);
    }
  }

  setStatus(s) {
    this.status = s;
    this.io.emit('status', { discord: s, chatter: this.enabled });
  }

  setEnabled(on) {
    this.enabled = on;
    this.setStatus(this.status);
  }

  // ---------- 이름과 기억 ----------

  // 사람 플레이어는 시작 화면에 적은 이름 대신 정해 둔 호칭(characters.json의 player.callName)으로 알려준다
  name(id) {
    if (id === 'player') return this.callName;
    return this.bots.find(b => b.id === id)?.speakName ?? id;
  }

  aliveExcept(target) {
    return this.game.alive().map(e => e.id).filter(id => id !== target).map(id => this.name(id));
  }

  memoryPushed(victim, pusher) {
    const n = this.pushes[pusher]?.[victim] || 0;
    return n >= 2 ? `오늘 ${this.name(pusher)}한테 ${n}번째로 당함` : '';
  }

  memoryPusher(victim, pusher) {
    const n = this.pushes[pusher]?.[victim] || 0;
    return n >= 2 ? `오늘 ${eulreul(this.name(victim))} ${n}번째 떨어뜨림` : '';
  }

  memorySelf(id) {
    const n = this.selfOuts[id] || 0;
    return n >= 2 ? `오늘 혼자 떨어진 게 ${n}번째` : '';
  }

  memoryWin(id) {
    if (this.streak.id === id && this.streak.n >= 2) return `${this.streak.n}연승 중`;
    const n = this.game.wins[id] || 0;
    return n >= 2 ? `오늘 ${n}번째 우승` : '';
  }

  // ---------- 게임 사건 ----------

  onGameEvent(ev) {
    this.instantClip(ev);
    if (ev.type === 'round_start') { this.roundLog = []; return; }
    if (ev.type === 'out') {
      this.roundLog.push(ev);
      if (ev.pusher) {
        this.pushes[ev.pusher] ??= {};
        this.pushes[ev.pusher][ev.victim] = (this.pushes[ev.pusher][ev.victim] || 0) + 1;
      } else {
        this.selfOuts[ev.victim] = (this.selfOuts[ev.victim] || 0) + 1;
      }
    }
    if (ev.type === 'win') {
      this.streak = this.streak.id === ev.winner ? { id: ev.winner, n: this.streak.n + 1 } : { id: ev.winner, n: 1 };
      setTimeout(() => this.summary(), this.cfg.summaryDelaySec * 1000);
    }
    const kind = this.classify(ev);
    if (!kind) return;
    this.buffer.push({ ...ev, kind });
    if (this.buffer.length === 1) setTimeout(() => this.flush(), this.cfg.batchWindowMs);
  }

  classify(ev) {
    const isBot = id => id && id !== 'player';
    switch (ev.type) {
      case 'out':
        if (isBot(ev.victim)) {
          if (!ev.pusher) return 'self_out';
          return ev.pusher === 'player' ? 'player_pushed_bot' : 'pushed_out';
        }
        return ev.pusher ? 'player_out' : 'player_self_out';
      case 'hard_hit': return isBot(ev.victim) ? 'hard_hit' : null;
      case 'close_call': return isBot(ev.id) ? 'close_call' : null;
      case 'duel': return 'duel';
      case 'win': return ev.winner === 'player' ? 'player_win' : 'bot_win';
      default: return null;
    }
  }

  // 1초 안에 몰린 사건 중 가장 중요한 것 하나만 말하게 한다
  flush() {
    const events = this.buffer;
    this.buffer = [];
    const prio = e => this.cfg.events[e.kind].priority;
    const ev = events.sort((a, b) => prio(b) - prio(a))[0];
    if (ev) this.react(ev);
  }

  react(ev) {
    const r = this.cfg.events[ev.kind];
    const bots = this.bots.map(b => b.id);
    const chance = p => Math.random() < p;
    const say = (id, desc, mem, important = false) => {
      // 판이 끝난 뒤에는 "남은 사람"이 의미 없으니 뺀다
      const left = this.game.phase === 'playing' ? this.aliveExcept(id) : [];
      let text = `[게임] 사건: ${desc}`;
      if (left.length) text += ` / 남은 사람: ${left.join(', ')}`;
      if (mem) text += ` / 기억: ${mem}`;
      this.call(id, text, { important, depth: 0 });
    };
    const n = id => this.name(id);

    switch (ev.kind) {
      case 'pushed_out': {
        const { victim: v, pusher: p } = ev;
        say(v, `${iga(n(p))} 너를 밀어서 떨어뜨림`, this.memoryPushed(v, p), true);
        if (chance(r.pusher)) say(p, `네가 ${eulreul(n(v))} 밀어서 떨어뜨림`, this.memoryPusher(v, p));
        const by = bots.filter(id => id !== v && id !== p);
        if (by.length && chance(r.bystander)) say(pick(by), `${iga(n(p))} ${eulreul(n(v))} 밀어서 떨어뜨림`);
        break;
      }
      case 'self_out': {
        const v = ev.victim;
        say(v, '아무도 안 밀었는데 너 혼자 떨어짐', this.memorySelf(v), true);
        const others = bots.filter(id => id !== v);
        const mocker = others.includes(r.preferMocker) ? r.preferMocker : pick(others);
        if (mocker && chance(r.mocker)) say(mocker, `${iga(n(v))} 아무도 안 밀었는데 혼자 떨어짐`, this.memorySelf(v));
        break;
      }
      case 'player_pushed_bot': {
        const v = ev.victim;
        say(v, `${iga(n('player'))} 너를 밀어서 떨어뜨림`, this.memoryPushed(v, 'player'), true);
        break;
      }
      case 'player_out': {
        const p = ev.pusher;
        if (p !== 'player' && chance(r.pusher)) say(p, `네가 ${eulreul(n('player'))} 밀어서 떨어뜨림`, this.memoryPusher('player', p));
        const others = bots.filter(id => id !== p);
        if (chance(r.other)) say(pick(others), `${iga(n(p))} ${eulreul(n('player'))} 밀어서 떨어뜨림`);
        break;
      }
      case 'player_self_out':
        if (chance(r.other)) say(pick(bots), `${iga(n('player'))} 아무도 안 밀었는데 혼자 떨어짐`, this.memorySelf('player'));
        break;
      case 'hard_hit':
        if (chance(r.victim)) say(ev.victim, `${iga(n(ev.attacker))} 돌진해서 너를 세게 들이받음 (안 떨어지고 버팀)`);
        break;
      case 'close_call':
        if (chance(r.self)) say(ev.id, '경기장 끝에서 떨어질 뻔했는데 아슬아슬하게 버팀');
        break;
      case 'duel': {
        const inDuel = ev.ids.filter(id => id !== 'player');
        if (inDuel.length && chance(r.one)) {
          const me = pick(inDuel);
          const rival = ev.ids.find(id => id !== me);
          say(me, `이제 너랑 ${n(rival)}만 남음. 1:1 마지막 승부`);
        }
        break;
      }
      case 'bot_win': {
        const w = ev.winner;
        say(w, '네가 이번 판 우승함!', this.memoryWin(w), true);
        for (const id of bots) if (id !== w && chance(r.others)) say(id, `${iga(n(w))} 이번 판 우승함`, this.memoryWin(w));
        break;
      }
      case 'player_win':
        for (const id of bots) if (chance(r.each)) say(id, `${iga(n('player'))} 이번 판 우승함`, this.memoryWin('player'));
        break;
    }
  }

  summary() {
    if (!this.roundLog.length) return;
    const parts = this.roundLog.map(o => o.pusher
      ? `${iga(this.name(o.pusher))} ${eulreul(this.name(o.victim))} 떨어뜨림`
      : `${iga(this.name(o.victim))} 혼자 떨어짐`);
    const text = `[수다] 이번 판 정리: ${parts.join(', ')}. 우승은 ${this.name(this.game.winner)}. 판 끝나고 쉬는 시간이니 한마디 해.`;
    const free = this.bots.map(b => b.id).filter(id => this.available(id));
    if (free.length) this.call(pick(free), text, { depth: 0 });
  }

  idleCheck() {
    const g = this.game;
    // 판 사이에는 다시 시작을 기다리는 동안 계속 떠들지 않게, 게임 중에만
    if (!g.human.active || g.phase !== 'playing') return;
    if (Date.now() - this.lastSpeech < this.cfg.idleSec * 1000) return;
    const free = this.bots.map(b => b.id).filter(id => this.available(id));
    if (free.length) this.call(pick(free), '[수다] 다들 조용하다. 게임이나 친구들 얘기로 아무 말이나 가볍게 꺼내.', { depth: 0 });
  }

  // ---------- 말 시키기 ----------

  // 한 번에 한 명만 대사를 만든다. 대사(글)가 나오면 그 봇이 말하는 동안 다음 봇을 불러 미리 준비시킨다.
  // 목소리는 floor.js가 한 명씩 이어 준다. 차례를 기다리는 목소리가 있으면 더 부르지 않는다(늦은 반응 방지).
  floorFree() {
    const now = Date.now();
    for (const [bid, since] of this.speaking) {
      if (now - since > this.cfg.speakingTimeoutSec * 1000) this.speaking.delete(bid);
    }
    return this.speaking.size < this.cfg.maxSimultaneous && now >= this.floorAt && !(this.voice?.waiting > 0);
  }

  available(id) {
    const now = Date.now();
    if (!this.enabled) return false;
    if ((this.nextFree.get(id) || 0) > now) return false;
    this.recent = this.recent.filter(t => now - t < 60000);
    const cap = this.cfg.perMinuteCap[this.game.phase === 'playing' ? 'playing' : 'intermission'];
    if (this.recent.length >= cap) return false;
    return this.floorFree();
  }

  // 중요한 한마디는 누가 말하는 중이면 버리지 않고 줄 세웠다가, 말이 끝나면 부른다 (오래된 건 버림)
  enqueue(item) {
    this.queue = this.queue.filter(q => q.id !== item.id);
    this.queue.push(item);
    if (this.queue.length > 3) this.queue.shift();
  }

  pump() {
    if (!this.queue.length || !this.enabled || !this.floorFree()) return;
    const now = Date.now();
    this.queue = this.queue.filter(q => now - q.at < this.cfg.queueMaxAgeSec * 1000);
    const next = this.queue.shift();
    if (next) this.call(next.id, next.text, { important: true, depth: next.depth });
  }

  chainAvailable() {
    const now = Date.now();
    this.recent = this.recent.filter(t => now - t < 60000);
    const cap = this.cfg.perMinuteCap[this.game.phase === 'playing' ? 'playing' : 'intermission'];
    return this.enabled && this.recent.length < cap && this.floorFree();
  }

  release(id) {
    if (this.speaking.delete(id)) this.floorAt = Date.now() + this.cfg.gapMs;
  }

  // important: 자기가 떨어졌거나 우승한 순간은 휴식 시간·상한을 무시하고 부른다 (말하는 중이면 기다림)
  // chain: 친구 말에 받아치는 대꾸. 그 봇의 휴식 시간은 무시하고, 말하는 사람이 없을 때만 (분당 상한은 지킴)
  async call(id, text, { important = false, chain = false, depth = 0 } = {}) {
    if (!this.enabled) return;
    const now = Date.now();
    if (important && !this.floorFree()) return this.enqueue({ id, text, depth, at: now });
    if (chain && !this.chainAvailable()) return;
    if (!important && !chain && !this.available(id)) return;
    this.nextFree.set(id, now + rand(...this.cfg.cooldownSec) * 1000);
    this.recent.push(now);
    this.speaking.set(id, now);
    this.pending.set(id, depth);
    this.lastSpeech = now;

    const userId = this.botIds.get(id);
    console.log(`[심판 → ${this.name(id)}] ${text}`);
    if (!this.discord || !userId) return;
    try {
      await this.channel.send({ content: `<@${userId}> ${text}`, allowedMentions: { users: [userId] } });
    } catch (err) {
      console.error('[심판] 메시지 전송 실패:', err.message);
    }
  }

  // ---------- 봇의 대답 ----------

  onDiscordMessage(msg) {
    if (msg.channelId !== this.env.DISCORD_TEXT_CHANNEL_ID) return;
    const id = this.idToBot.get(msg.author.id);
    if (!id) return;
    // 봇이 사람 목소리를 알아들으면 받아 적은 글을 먼저 올린다. 이 봇이 대답할 때까지 다른 봇은 기다린다.
    if (/^\*\*\[(음성|Voice)\]\*\*|^🎙️/.test(msg.content)) {
      this.speaking.set(id, Date.now());
      this.lastSpeech = Date.now();
      this.remember(`플레이어(음성): ${msg.content.replace(/^.*?:\s*/, '')}`);
      return;
    }
    // 봇이 시작 화면 이름으로 부르면 호칭으로 바꿔서 전한다 (다른 친구에게 옮지 않게)
    const typed = this.game.human.name;
    // [laughs] 같은 목소리 감정 표시는 소리로만 나오고 글에서는 뺀다
    let line = msg.content.replace(/<@!?\d+>/g, '').replace(/\[[a-z][a-z ]{0,20}\]\s*/gi, '').trim();
    if (typed && typed !== this.callName) line = line.split(typed).join(this.callName);
    if (!line) return;
    // 음성방 들어감·나감 같은 안내 문구는 대답이 아니다
    if (/\/voice (leave|join)|음성 채널에서 나갔어요|음성 채널에 참여하고 있지|voice channel/i.test(line)) return;
    // Hermes 안내·도구 표시(📬 홈 채널, ⚙️ 도구, ⏳ 작업 중 등)도 대사가 아니다
    if (/^(📬|⚙️|⚙|⏳|🔧|💭|⚠️|❌)|\/sethome|home channel/i.test(line)) return;
    console.log(`[${this.name(id)}] ${line}`);
    this.queueBubble(id, line);
    this.release(id);
    this.lastSpeech = Date.now();
    this.remember(`${this.name(id)}: ${line}`);

    const depth = this.pending.get(id);
    this.pending.delete(id);
    if (depth === undefined || depth >= this.cfg.chainChance.length) return;
    this.chain(id, line, depth);
  }

  queueBubble(id, text) {
    clearTimeout(this.bubbles.get(id)?.timer);
    // 벌써 말하는 중이면 바로, 아니면 목소리가 시작될 때. 음성방에 없어서 목소리가 안 나와도 6초 뒤엔 띄운다.
    if (this.voice?.speaking === id) return this.io.emit('say', { id, text });
    this.bubbles.set(id, { text, timer: setTimeout(() => this.showBubble(id), 6000) });
  }

  showBubble(id) {
    const b = this.bubbles.get(id);
    if (!b) return;
    clearTimeout(b.timer);
    this.bubbles.delete(id);
    this.io.emit('say', { id, text: b.text });
  }

  remember(text) {
    this.log.push(text);
    if (this.log.length > 8) this.log.shift();
  }

  // 친구 말에 다른 친구가 받아칠지: Jev가 되면 말의 내용으로, 안 되면 정해진 확률로 정한다
  async chain(id, line, depth) {
    const started = Date.now();
    const others = this.bots.filter(b => b.id !== id);
    let next = null;
    const judged = await this.judge.retort(id, line, this.log.slice(0, -1));
    if (judged) {
      const ok = judged.p >= this.cfg.retortThreshold[depth];
      console.log(`[Jev] 받아칠 확률 ${judged.p.toFixed(2)} → ${ok ? `${this.name(judged.next)} 대꾸` : '넘어감'} (${this.judge.lastMs}ms)`);
      if (!ok) return;
      next = others.find(b => b.id === judged.next);
    } else {
      if (Math.random() >= this.cfg.chainChance[depth]) return;
      // 대답에 이름이 나온 친구가 받아치고, 없으면 아무나
      next = others.find(b => line.includes(b.speakName) || line.includes(b.name)) ?? pick(others);
    }
    if (!next) return;
    const wait = Math.max(0, rand(...this.cfg.chainDelaySec) * 1000 - (Date.now() - started));
    // 앞사람이 말을 끝내고 쉬는 시간(gapMs)이 지나 자리가 비면 바로 받아친다. 3초 안에 안 비면 포기.
    const until = Date.now() + wait + 3000;
    const tryCall = () => {
      if (this.chainAvailable()) {
        this.call(next.id, `[수다] ${iga(this.name(id))} "${line}"라고 함. ${this.name(id)}한테 대꾸해.`, { chain: true, depth: depth + 1 });
      } else if (Date.now() < until) {
        setTimeout(tryCall, 150);
      }
    };
    setTimeout(tryCall, wait);
  }

  // 사람이 음성으로 한 말을 누가 들을지 (Hermes 패치가 봇마다 물어본다 → 같은 말은 한 번만 판단)
  voiceListener(speech) {
    const now = Date.now();
    this.listenCache = (this.listenCache || []).filter(c => now - c.at < 10000);
    const hit = this.listenCache.find(c => c.speech === speech);
    if (hit) return hit.result;
    const result = (async () => {
      const t = Date.now();
      const who = await this.judge.listener(speech, this.log);
      const bot = this.bots.some(b => b.id === who) ? who : null;
      console.log(`[Jev] "${speech}" → ${bot ? this.name(bot) : who === 'group' ? '모두에게 (기본 친구)' : '판단 못 함 (기본 친구)'} (${Date.now() - t}ms)`);
      return { bot, by: who ? 'jev' : 'none' };
    })();
    this.listenCache.push({ speech, at: now, result });
    return result;
  }
}
