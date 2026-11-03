// hermes-agent/는 git에 안 올라가서, 우리가 고친 부분은 여기서 다시 적용한다.
// 여러 번 실행해도 안전하다(이미 고쳐져 있으면 건너뜀). setup-hermes와 bots가 자동으로 부른다.
// 패치 내용을 바꿨으면 그 파일을 Hermes 원본으로 되돌린 뒤 새로 적용한다.
//   node scripts/patch-hermes.js
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const hermesDir = `${root}hermes-agent`;
const MARK = '# tudak-arena patch';

const PATCHES = [
  {
    // 심판 메시지로 시작된 대답은 이벤트에 서버(guild) 정보가 없을 때가 있다(바쁠 때 줄 세운 메시지 등).
    // 그러면 음성방에 있는데도 소리 대신 voice-message.ogg 파일로 보낸다.
    // 서버를 못 찾으면 /voice join 한 텍스트 채널 목록에서 지금 채널과 묶인 서버를 찾는다.
    name: '음성방 대답 서버 찾기',
    file: 'gateway/run_voice.py',
    after: 'async def _deliver_voice_reply(',
    find: '        guild_id = self._get_guild_id(event)\n',
    replace: `        guild_id = self._get_guild_id(event)
        if not guild_id:  ${MARK}: fall back to the guild whose /voice join bound this text channel
            bound = getattr(adapter, "_voice_text_channels", None)
            if isinstance(bound, dict):
                guild_id = next((gid for gid, ch in bound.items()
                                 if str(ch) == str(event.source.chat_id)), None)
`,
  },
  {
    // 사람이 음성방에서 말하면 봇 3명이 모두 알아듣고 동시에 대답한다.
    // 말에서 먼저 불린 봇 한 명만 대답한다. 이름이 없으면 게임 서버가 Jev로 고른 봇이,
    // 게임 서버가 꺼져 있거나 Jev가 못 고르면 기본 봇(voiceDefault)이 대답한다.
    // 이름은 setup-hermes가 프로필 .env에 넣는다(TUDAK_VOICE_*). 값이 없으면 원래대로 동작.
    name: '음성 대답은 한 명만',
    file: 'gateway/run_voice.py',
    after: 'async def _handle_voice_channel_input(',
    find: '        if not text_ch_id:\n            return\n',
    replace: `        if not text_ch_id:
            return
        import os as _tos, re as _tre  ${MARK}: only the first bot named in the speech answers (default bot when none)
        def _first(key):
            hits = [m.start() for n in _tos.getenv(key, "").split(",") if n
                    for m in [_tre.search(r"(?<![0-9A-Za-z가-힣])" + _tre.escape(n), transcript, _tre.I)] if m]
            return min(hits) if hits else None
        if _tos.getenv("TUDAK_VOICE_NAMES"):
            _mine, _other = _first("TUDAK_VOICE_NAMES"), _first("TUDAK_VOICE_OTHERS")
            if _mine is None and _other is None and _tos.getenv("TUDAK_JUDGE_URL"):
                # no name said: the game server asks Jev who the player was talking to (same answer for every bot)
                def _ask_judge():
                    import json as _tj, urllib.request as _tu
                    _rq = _tu.Request(_tos.environ["TUDAK_JUDGE_URL"], data=_tj.dumps({"speech": transcript}).encode(),
                                      headers={"Content-Type": "application/json"})
                    with _tu.urlopen(_rq, timeout=2.5) as _r:
                        return _tj.load(_r).get("bot")
                try:
                    _bot = await asyncio.to_thread(_ask_judge)
                except Exception:
                    _bot = None
                if _bot:
                    if _bot != _tos.getenv("TUDAK_VOICE_ID"):
                        return
                    _mine = 0
            if _mine is None and (_other is not None or _tos.getenv("TUDAK_VOICE_DEFAULT") != "1"):
                return
            if _mine is not None and _other is not None and _other < _mine:
                return
`,
  },
  {
    // 봇을 친구처럼: 주인(TUDAK_FOLLOW_USER)이 음성방(TUDAK_FOLLOW_VOICE)에 들어가면 따라 들어가고, 나가면 같이 나간다.
    // 주인이 /voice join, /voice leave를 친 것과 똑같이 처리한다. 값이 없으면 원래대로 동작.
    name: '주인 따라 음성방 들어가기·나가기',
    file: 'plugins/platforms/discord/adapter.py',
    after: 'async def on_voice_state_update(member, before, after):',
    find: '                """Track voice channel join/leave events."""\n',
    replace: `                """Track voice channel join/leave events."""
                try:  ${MARK}: follow the owner into/out of the voice channel like /voice join|leave
                    import os as _tos
                    from types import SimpleNamespace as _NS
                    _who, _vc, _text = (_tos.getenv(k, "") for k in
                                        ("TUDAK_FOLLOW_USER", "TUDAK_FOLLOW_VOICE", "TUDAK_FOLLOW_TEXT"))
                    _target = lambda ch: ch is not None and (not _vc or _vc in (str(ch.id), ch.name))
                    if _who and _text and str(member.id) == _who and before.channel != after.channel:
                        _cmd = ("/voice join" if _target(after.channel)
                                else "/voice leave" if _target(before.channel) else None)
                        if _cmd:
                            logger.info("Following %s: %s", member.display_name, _cmd)
                            _src = adapter_self.build_source(
                                chat_id=_text, chat_type="group", user_id=str(member.id),
                                user_name=member.display_name, guild_id=str(member.guild.id))
                            await adapter_self.handle_message(MessageEvent(
                                text=_cmd, message_type=MessageType.COMMAND, source=_src,
                                raw_message=_NS(guild_id=member.guild.id, guild=None)))
                except Exception as _e:
                    logger.warning("Following the owner into voice failed: %s", _e)
`,
  },
  {
    // 말하는 동안 준비하기 ①: Hermes는 목소리를 다 재생한 뒤에 글을 올려서, 다음 친구는 앞 친구 말이 끝나야 생각을 시작한다.
    // 목소리는 뒤에서 재생하고 글을 바로 올린다. 목소리가 겹치지 않게 하는 건 ②의 차례 자물쇠가 한다.
    // TUDAK_FLOOR_URL이 없으면(자물쇠가 없으면) 원래대로 기다린다.
    name: '글 먼저 올리고 목소리는 뒤에서',
    file: 'gateway/run_turn_persistence.py',
    after: 'async def _hmwa_deliver_turn_response(',
    find: '            await self._send_voice_reply(event, response)\n',
    replace: `            if __import__("os").getenv("TUDAK_FLOOR_URL"):  ${MARK}: speak in the background, post the text now
                _tv = asyncio.ensure_future(self._send_voice_reply(event, response))
                _tvs = self.__dict__.setdefault("_tudak_voice_tasks", set())
                _tvs.add(_tv)
                _tv.add_done_callback(_tvs.discard)
            else:
                await self._send_voice_reply(event, response)
            ${MARK}: [laughs] 같은 감정 표시는 목소리에만 쓰고 채팅 글에서는 뺀다
            response = __import__("re").sub(r"\\[[a-zA-Z][a-zA-Z ]{0,20}\\]\\s*", "", response).strip() or response
`,
  },
  {
    // 말하는 동안 준비하기 ②: 음성방에서 말하기 전에 게임 서버(TUDAK_FLOOR_URL)에서 "말하는 차례"를 받는다.
    // 봇 셋이 차례대로 한 명씩 말한다. 너무 오래(서버가 정한 시간) 기다린 말은 지난 얘기라 재생하지 않는다.
    // 게임 서버가 꺼져 있으면 차례 없이 그냥 말한다.
    name: '음성방 말하는 차례 자물쇠',
    file: 'plugins/platforms/discord/adapter.py',
    after: 'async def leave_voice_channel(',
    find: '    async def play_in_voice_channel(self, guild_id: int, audio_path: str) -> bool:\n',
    replace: `    async def play_in_voice_channel(self, guild_id: int, audio_path: str) -> bool:
        ${MARK}: one bot speaks at a time across all bots (the floor is held by the game server)
        import os as _tos, json as _tj, urllib.request as _tu
        _url, _me = _tos.getenv("TUDAK_FLOOR_URL", ""), _tos.getenv("TUDAK_VOICE_ID", "")

        def _floor(action, timeout):
            if not _url:
                return None
            try:
                _rq = _tu.Request(f"{_url}/{action}", data=_tj.dumps({"bot": _me}).encode(),
                                  headers={"Content-Type": "application/json"})
                with _tu.urlopen(_rq, timeout=timeout) as _r:
                    return bool(_tj.load(_r).get("granted", True))
            except Exception:
                return None

        _granted = await asyncio.to_thread(_floor, "acquire", 20)
        if _granted is False:
            logger.info("Skipping a stale voice line (waited too long for the floor)")
            return True
        try:
            return await self._tudak_play_in_voice_channel(guild_id, audio_path)
        finally:
            if _granted:
                await asyncio.to_thread(_floor, "release", 5)

    async def _tudak_play_in_voice_channel(self, guild_id: int, audio_path: str) -> bool:
`,
  },
  {
    // 영어로 학습된 목소리(ElevenLabs 기본 목소리)는 말끝 "~"를 "about"(약)으로 읽는다. 목소리로 만들 글에서만 뺀다.
    name: '목소리에서 물결표 빼기',
    file: 'tools/tts_text_normalize.py',
    after: 'def prepare_spoken_text(',
    find: '    spoken = text\n',
    replace: `    spoken = text.replace("~", "").replace("～", "")  ${MARK}: English voices read "~" as "about"
`,
  },
  {
    // 즉시 감탄사: 음성방에 들어가면 게임 서버(TUDAK_CLIP_URL)에 "내 감탄사 있어?"를 계속 물어보고,
    // 받으면 Claude를 거치지 않고 미리 만든 소리 파일을 말하는 차례 맨 앞에서 바로 튼다.
    name: '즉시 감탄사 받아서 바로 틀기',
    file: 'plugins/platforms/discord/adapter.py',
    after: 'async def join_voice_channel(',
    find: '            vc = await channel.connect()\n            self._voice_clients[guild_id] = vc\n',
    replace: `            vc = await channel.connect()
            self._voice_clients[guild_id] = vc
            if __import__("os").getenv("TUDAK_CLIP_URL") and not getattr(self, "_tudak_clip_task", None):
                ${MARK}: instant clips pushed by the game server, played ahead of the queued lines
                async def _tudak_clip_loop(adapter=self):
                    import os as _o, json as _j, urllib.request as _u
                    clip_url, floor_url, me = (_o.getenv(k, "") for k in ("TUDAK_CLIP_URL", "TUDAK_FLOOR_URL", "TUDAK_VOICE_ID"))

                    def _post(url, body, timeout):
                        rq = _u.Request(url, data=_j.dumps(body).encode(), headers={"Content-Type": "application/json"})
                        with _u.urlopen(rq, timeout=timeout) as r:
                            return _j.load(r)

                    while True:
                        try:
                            got = await asyncio.to_thread(_post, f"{clip_url}/next", {"bot": me}, 30)
                        except Exception:
                            await asyncio.sleep(3)
                            continue
                        path, gid = got.get("clip"), next(iter(adapter._voice_clients), None)
                        if not path or gid is None or not _o.path.exists(path):
                            continue
                        granted = None
                        if floor_url:
                            try:
                                granted = (await asyncio.to_thread(
                                    _post, f"{floor_url}/acquire", {"bot": me, "priority": True, "waitMs": 2500}, 5)).get("granted")
                            except Exception:
                                granted = None
                        if granted is False:
                            continue
                        try:
                            await getattr(adapter, "_tudak_play_in_voice_channel", adapter.play_in_voice_channel)(gid, path)
                        except Exception as _e:
                            logger.warning("Instant clip failed: %s", _e)
                        finally:
                            if granted:
                                try:
                                    await asyncio.to_thread(_post, f"{floor_url}/release", {"bot": me}, 5)
                                except Exception:
                                    pass

                self._tudak_clip_task = asyncio.ensure_future(_tudak_clip_loop())
`,
  },
];

// 고친 코드가 통째로 들어 있으면 적용된 것 (고친 코드 안에 원래 줄이 또 들어 있을 수 있어서 위치로 보지 않는다)
const isApplied = (src, p) => {
  const start = src.indexOf(p.after);
  return start >= 0 && src.indexOf(p.replace, start) >= 0;
};

export function patchHermes({ quiet = false } = {}) {
  const log = quiet ? () => {} : console.log;
  let ok = true;
  for (const file of [...new Set(PATCHES.map(p => p.file))]) {
    const path = `${hermesDir}/${file}`;
    if (!existsSync(path)) { console.error(`✗ 패치 대상이 없어요: hermes-agent/${file}`); ok = false; continue; }
    const patches = PATCHES.filter(p => p.file === file);
    let src = readFileSync(path, 'utf8');
    if (patches.every(p => isApplied(src, p))) {
      patches.forEach(p => log(`· 패치 이미 적용됨: ${p.name}`));
      continue;
    }
    // 예전 버전의 우리 패치가 남아 있으면 원본으로 되돌린 뒤 다시 적용한다
    if (src.includes(MARK)) {
      try {
        execFileSync('git', ['-C', hermesDir, 'checkout', '--', file], { stdio: 'ignore' });
        src = readFileSync(path, 'utf8');
      } catch {
        console.error(`✗ 예전 패치를 되돌리지 못했어요: hermes-agent/${file}`);
        ok = false;
        continue;
      }
    }
    for (const p of patches) {
      const start = src.indexOf(p.after);
      const at = start < 0 ? -1 : src.indexOf(p.find, start);
      if (at < 0) {
        console.error(`✗ 패치 실패: ${p.name} — Hermes 코드가 바뀌어 위치를 못 찾았어요 (hermes-agent/${file})`);
        ok = false;
        continue;
      }
      src = src.slice(0, at) + p.replace + src.slice(at + p.find.length);
      log(`✓ 패치 적용: ${p.name}`);
    }
    writeFileSync(path, src);
  }
  return ok;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) process.exit(patchHermes() ? 0 : 1);
