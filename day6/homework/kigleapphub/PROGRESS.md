# 진행 상황

마지막 갱신: 2026-11-10

## 과제
"discord + hermes agent로 키글 사람들이 쓰고 싶은 에이전트 만들기". 별도 포트, 이름, 설명, 프로필 사진, Soul.md가 모두 있어야 해요.

## 정한 것
- 이름 **허브집사**, Hermes 프로필 `hubjipsa`, API 포트 **8661**.
- 기능 3개: ① 링크 찾기 ② 담당자 묻기 ③ 내 프로젝트 모아 보기. 빈 링크 주간 알림은 이번 범위에서 뺐어요.
- 앱허브 코드는 안 고쳐요. D1(`kigle-apphub`)을 앱허브 배포용 wrangler 로그인(`~/.config/kigle-wrangler`)으로 직접 읽어요. 떼어낼 때는 이 폴더만 지우면 돼요.
- 도구는 MCP 서버(`scripts/apphub-mcp.js`)로 3개: `list_projects`, `find_links`, `who`. 데이터는 3분 동안 기억해요.
- 디스코드: #허브집사 채널에서만, 채널에 있는 누구나, 멘션 없이 대답. 같은 채널이어도 사람마다 대화를 따로 기억해요.
- 모델: `claude-haiku-5-5` (`.env`의 `BOT_MODEL`).
- 프로필 사진은 SVG로 직접 그림(`bot/avatar.svg` → `bot/avatar.png`).

## 지금 상태
- Hermes 설치 완료(2026-11-08 18:3x). 처음엔 GitHub 릴리스 다운로드(KittenTTS)가 504라 실패했고, 복구된 뒤 재시도로 설치됨. `pm install --extra messaging`도 완료.
- 프로필 `hubjipsa` 생성. `.env`에 디스코드 값이 없어서 디스코드만 빼고 설정된 상태.
- 게이트웨이를 켜면 8661 포트가 열리는 것 확인.
- 터미널 시험(`chat -Q -q … -t mcp-apphub`): 치과 애드몹, 덴티스트 플레이스토어(→ 코코비 치과의사로 알아들음), 뽀로로 기획서(빈 칸 → 아쉬워하며 앱허브 안내), 공룡월드 담당자, 내 프로젝트(이름 먼저 물어봄 → 빈 링크 많은 순), 링크 삭제 부탁(읽기 전용이라 거절) 모두 정상. 개수를 셀 때 가끔 하나씩 틀림(12를 13이라고 함).
- 알게 된 것: 이 Hermes 버전은 터미널 대화도 게이트웨이에 붙는데, 첫 부팅이 60초 제한을 넘어서 "Gateway starting: deadline" 오류가 남. `npm run bot`을 먼저 켜 두면 됨.
- `.env`에 ANTHROPIC_API_KEY는 투닥 아레나 값을 옮겨 뒀어요. DISCORD_BOT_TOKEN, DISCORD_CHANNEL_ID는 아직 비어 있어요.

- 2026-11-08 19:3x: `.env`에 토큰·채널 ID 들어옴(앱 이름 KigleApphub_agent, 앱ID 1568929164948414537). `setup-hermes` 후 `npm run bot` → "discord connect timed out after 30s".
  - 디스코드 API로 확인해 보니 토큰은 정상인데 **인텐트 둘 다 꺼짐(flags 0)**, **봇이 아직 어느 서버에도 없음(서버 0개)**, 그래서 채널도 Unknown Channel.
  - 참고: 터미널 시험 때 Hermes가 스스로 띄운 게이트웨이가 남아서 `npm run bot`이 "already running"으로 실패했었음 → `npm run hermes -- -p hubjipsa gateway stop`으로 끄고 다시 켬.

- 19:42: 사용자가 인텐트 켜고 서버 **KigleApphub**(1568931919301705808)에 초대함. 그런데 `.env`의 채널 ID가 **서버 ID**였음 → 봇 전용 채팅 채널 **#agent** `1568932139708190910`으로 바꿈 → `setup-hermes` → `gateway stop` → `npm run bot` → **"Connected as KigleApphub_agent#3410", discord connected**. 봇이 #agent를 볼 수 있음도 확인.

- 19:43: #agent에 보낸 메시지에 ✅만 뜨고 대답 없음 → 로그 "Unauthorized user: 411915038367023124 (DokD)". `DISCORD_ALLOWED_CHANNELS`는 대답할 채널만 정하고, 사람 허용은 따로 필요했음(gateway/authz_mixin.py). 디스코드에는 채널 허용 환경변수가 없어서 config.yaml `gateway.platforms.discord.extra.group_allowed_chats: [#agent ID]`를 `setup-hermes`에 추가 → 그 채널 사람은 누구나 허용, DM·다른 채널은 계속 막힘. 19:46 다시 켜서 discord connected.

- **19:48~19:50 디스코드에서 대답 성공** (사용자 확인). "치과 애드몹", "개발자 김도한 담당프로젝트 알려줘", "각 프로젝트들의 기획서 링크만 알려줘" 모두 `mcp__apphub__*` 도구로 대답.
  - 다만 "각 프로젝트들의 기획서"는 `find_links`가 프로젝트 없이 항목만 물으면(5개 초과) 되돌려 보내서, 허브집사가 프로젝트마다 15번 따로 불러 21초 걸림.
- 봇을 다시 켤 때마다 Hermes가 홈 채널(#agent)에 "⚠️ Hermes is shutting down" 안내를 올림(정상 동작).

- 19:53 고침: `find_links`에 프로젝트 없이 항목만 주면 모든 프로젝트의 그 항목을 한 번에(`allProjects`, `emptyCount`) 돌려줌. 도구 설명에도 "프로젝트마다 따로 부르지 말고 한 번만". 봇 재시작 후 "각 프로젝트들의 기획서 링크만 알려줘" → 도구 2번(list_projects + find_links), 대답 약 4초(전엔 16번·21초). 기획서는 15개 중 2개만 채워져 있음.

- **2026-11-10 새 노트북(KIGLEui-MacBookPro)으로 옮김**: 이 노트북에는 Hermes·`node_modules`·`.env`가 없었음.
  - `npm install` 완료(npm이 esbuild·workerd 설치 스크립트를 건너뛰었지만 앱허브 읽기는 정상). `npm run ask -- 찾기 애드몹` 성공 → wrangler 로그인(`~/.config/kigle-wrangler`)은 이 노트북에도 있음.
  - `.env`를 만들고 `DISCORD_CHANNEL_ID`(#agent `1568932139708190910`)만 채움. `ANTHROPIC_API_KEY`, `DISCORD_BOT_TOKEN`은 비어 있음.
  - Claude의 자동 권한 검사가 투닥 아레나 `.env`에서 API 키 옮기는 걸 막음 → 키는 사용자가 직접 넣기로.
  - **Hermes는 새로 설치하지 않고 이미 있는 걸 같이 씀**: `hermes-agent`는 투닥 아레나 작업 폴더의 Hermes(`../tudak-arena/.claude/worktrees/folder-work-review-7b053a/day6/homework/tudak-arena/hermes-agent`, e534ed0, 디스코드 패키지 설치됨)를 가리키는 링크. 데이터(`hermes-home/`)는 이 폴더에 따로. `npm run hermes -- --version` 정상.
    - 그 작업 폴더를 지우면 허브집사도 안 켜짐 → 그때는 README 2단계로 이 폴더에 직접 설치.
    - 링크는 `.gitignore`의 `hermes-agent/`에 안 걸려서 `/`를 뺌.
    - 참고: `~/.local/bin/hermes`는 없어진 `~/Documents/kg-kdh-agent`를 가리켜서 안 됨.
  - 이 노트북의 투닥 아레나 봇 3개(8651~8653)는 같은 Hermes로 돌고 있음. 허브집사 8661과 안 겹침.
  - 처음 `setup-hermes`가 `No module named 'ruamel'`로 실패: 이 Hermes는 **데이터 폴더마다 패키지 환경을 따로 둠**(`<HERMES_HOME>/installs/<설치키>`, `pm/environments.py`). 새 `hermes-home`엔 그게 없었음.
    → `hermes-home/installs/7b16130431893402`를 투닥 아레나 `hermes-home/installs/7b16130431893402`로 가는 링크로 만들어 패키지 환경(디스코드 포함)을 같이 씀. 프로필·대화 기록은 이 폴더에 따로.
  - 사용자가 `.env`에 키 두 개 넣음 → `setup-hermes` 성공 → `npm run bot` → 13:52 **"Connected as KigleApphub_agent#3410", discord connected**, 포트 8661 열림.
  - 13:54 디스코드에서 "식충식물 기획서 문서 보여줘" → `mcp__apphub__find_links`로 대답(19초). 투닥 아레나 봇 3개도 그대로 켜져 있고, 같이 쓰는 패키지 환경에 새로 깔린 것 없음.

## 다음 할 일
1. 봇은 지금 Claude 세션의 백그라운드 작업으로 켜져 있음. 계속 켜 두려면 사용자 터미널에서 `npm run bot`
2. 옛 노트북에서 봇이 켜져 있으면 끄기(둘 다 켜져 있으면 대답이 두 번 감)
3. (선택) Developer Portal에서 봇 이름을 허브집사로, Public Bot 끄기
