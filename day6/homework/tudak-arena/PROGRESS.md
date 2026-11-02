# 진행 상황 (6일차 과제: 투닥 아레나)

> 마지막 갱신: 2026-11-02
> 다른 노트북에서 이어서 할 때는 이 문서를 먼저 읽으세요. Claude Code에는 "tudak-arena/PROGRESS.md 읽고 이어서 하자"라고 하면 돼요.

## 과제와 결정한 것

과제: "discord + hermes agent로 남들도 쓰고 싶은 에이전트 만들기". 별도 포트, 이름, 설명, 프로필 사진, Soul.md가 모두 있어야 해요.

- **게임**: Only One류 밀치기 웹 게임 "투닥 아레나". 사람 1명 + 봇 3명이 원형 경기장에서 부딪혀 밀어내고, 마지막 1명이 우승해요. 방향키(WASD) 이동, 스페이스 돌진, 경기장은 점점 좁아져요. 웹에서는 게임 효과음만 나요.
- **봇 3명**: 게임에서는 서버의 규칙 AI로 움직이고, 말은 Hermes 프로필(각자 Soul.md, 토큰, 목소리)이 디스코드 음성방에서 해요.
  - 코코(여, 활발, ESFJ, 추격형) / 러비(남, 시크, ISTJ, 생존형) / Rou(남, 장난꾸러기, ENFP, 막 돌진형)
  - 디스코드 이름은 2글자 이상이어야 해서 "루" 대신 "Rou"로 정했어요. 말할 때는 "루"라고 불러요.
- **심판 봇**: 4번째 디스코드 봇이고, 게임 서버 코드(`server/referee.js`)예요. 게임 사건을 보고 누구를 언제 멘션할지 정해요. Hermes 봇은 멘션받을 때만 말해요.
  - 사건별 확률(떨어진 봇·우승 100%, 충돌 25% 등), 대꾸 40% → 20% → 끝, 봇별 쿨다운 8~15초, 분당 6마디, 동시 최대 2명. 수치는 `config/referee.json`에 있어요.
  - 음성은 겹쳐도 괜찮다고 했어요(순서 장치 없음).
- **목소리**: 개발 중에는 Edge TTS(무료)를 써요. 코코 `ko-KR-SunHiNeural`, 러비 `ko-KR-InJoonNeural`, Rou `ko-KR-HyunsuMultilingualNeural`. **완성 단계에서 ElevenLabs로 바꾸기로** 했어요(비용 때문에 나중에).
- **모델**: `claude-opus-5-5`. 대답이 느리면 `config/characters.json`에서 `claude-haiku-5-5`로 바꿔요.
- **포트**: 웹 게임 3300. Hermes API 서버는 봇마다 따로: 코코 8651, 러비 8652, Rou 8653.
- **Hermes 구조** (수업 방식대로, 2026-11-02 변경): Hermes를 프로젝트 폴더 안에 clone해서 설치해요(`hermes-agent/`). 데이터는 `hermes-home/`에 있고, 둘 다 git에는 안 올려요.
  - 봇마다 프로필 폴더(`hermes-home/profiles/<이름>`)와 포트가 따로예요. 게이트웨이도 프로필마다 따로 떠요(`gateway.standalone: true`).
  - Hermes 기본값은 게이트웨이 하나가 모든 프로필을 같은 포트로 묶는 방식이에요. standalone은 Hermes가 "임시 호환 설정"이라고 경고하는 방식이라, 나중에 Hermes를 업데이트하면 없어질 수 있어요.
  - `npm run bots`가 게이트웨이 3개를 4초 간격으로 켜요. 동시에 켜면 Hermes가 하나만 남기고 끝내서, 끝나면 다시 켜게 했어요.
  - `hermes` 명령은 `npm run hermes -- ...`로 써요(`HERMES_HOME`을 이 폴더로 맞춰 줌).
  - 봇이 심판 메시지를 많이 받아도 막히지 않게 `gateway.bot_loop_guard.max_events`를 60으로 올렸어요(기본 5분에 20개).
- **디스코드 쪽 준비는 끝났어요**(노트북과 상관없음): 서버 "투닥-봇과함께"에 봇 4개(심판·코코·러비·Rou)를 초대했고, 메시지 콘텐츠 인텐트를 켰어요. 채널은 텍스트 `#투닥-중계`, 음성 `투닥-아레나`예요.

## 지금 상태

### 끝난 것 (2026-11-02, 처음 만든 Mac에서 테스트함)
- 웹 게임(`server/game.js`, `public/`): 카운트다운, 탈락, 우승, 점수판, 말풍선, 효과음을 브라우저에서 확인했어요.
- 봇 움직임(`server/bot-ai.js`): 시뮬레이션으로 맞췄어요. 한 판 25~30초, 우승 비율 러비 약 50%, 코코 약 25%, Rou 약 10%. Rou 탈락의 3분의 1 이상이 자멸이에요.
- 심판(`server/referee.js`): 대꾸 체인이 3마디에서 멈추는지, 이름이 언급된 친구에게 넘기는지 테스트했어요. 토큰이 없으면 터미널에만 찍혀요.
- Soul.md 원본(`bots/`), 프로필 사진(`public/img/`), 설정 스크립트(`scripts/setup-hermes.js`, 가짜 hermes로 테스트), README.

### 이 노트북(2026-11-02, Claude 세션 worktree `folder-work-review-7b053a`)에서 한 것
- 이 노트북에서는 원래 폴더가 아니라 worktree 폴더(`tudak-arena/.claude/worktrees/folder-work-review-7b053a/day6/homework/tudak-arena`)에서 작업했어요. `.env`, `hermes-agent/`, `hermes-home/`도 거기 있어요(git 제외).
- `npm install`, `brew install ffmpeg opus portaudio` 완료
- Hermes clone·설치·음성 추가 설치(voice, messaging, edge-tts) 완료
- `.env`를 채우고 `npm run setup-hermes`로 프로필 3개를 만들었어요.
- **디스코드 로그인 확인**: `npm run bots`에서 코코·러비·Rou 모두 `discord connected`, API 서버는 8651/8652/8653에서 열렸어요. `npm start`의 심판도 `#투닥-중계`에 연결됐어요.
  - 처음에 `DISCORD_TEXT_CHANNEL_ID`에 서버 ID가 들어가 "Unknown Channel"이 났어요. `#투닥-중계` 채널 ID(`1566460048127827988`)로 고쳤어요.

- **친구들과 같이 하기 (A 방식)**: 내 노트북에서 켜 두고 `npm run share`(Cloudflare 임시 터널 + `caffeinate`)로 게임 주소를 공유해요. 플레이어가 나가면 관전자 화면에 시작 화면이 다시 나와서 이어서 할 수 있게 고쳤어요(브라우저 두 탭으로 확인). `brew install cloudflared` 완료.
  - 터널 실행은 Claude Code 보안 확인이 막아서 **사용자가 직접 `npm run share`를 실행**해야 해요. 외부 주소로 접속하는 건 아직 확인 못 했어요.
  - 나중에 노트북 없이 24시간 돌리려면 클라우드 서버로 옮기는 방법(B)이 있어요.

- **게임 + 디스코드 채팅 연동 확인 (18시쯤)**: 게임을 여러 판 했고, 심판이 멘션하면 코코·러비·Rou가 성격대로 채팅에 대답했어요(`DISCORD_ALLOW_BOTS=mentions` 동작함). 대답은 Opus 5.5로 약 10초 걸렸어요.
  - `/voice`에서 mode를 **join**으로 골라야 봇이 음성방에 들어와요. mode 없이 보내면 사용법 안내만 와요.
  - Rou만 "Something went wrong"이 났어요. 처음 켤 때 Hermes가 부품을 설치하는 동안 Rou가 같이 켜져서 Claude 연결 부품(`anthropic`)을 못 찾은 거였어요. 봇을 다시 켜니 풀렸어요.
  - Claude 채팅창에서 `!`로 실행한 명령은 Claude 앱 안의 터미널 패널에서 돌아요. 봇은 맥 터미널 앱에서 켜고 끄는 게 덜 헷갈려요.

### 아직 안 된 것
- **봇이 음성방에서 소리로 말하지 않아요.** 음성방에는 들어오는데, 대답 목소리를 채팅에 `voice-message.ogg` 파일로 올려요.
  - 원인(로그로 확인): Hermes `hermes-agent/gateway/run_voice.py`의 `_deliver_voice_reply`가 `_get_guild_id(event)`로 서버 ID를 찾는데, 심판 메시지로 시작된 대답에서는 이 값이 `None`이에요. 그러면 "음성방에 없음"으로 보고 파일로 보내요. 같은 순간 봇의 음성 연결은 살아 있었어요(`guild=None ... clients={서버ID: True}`).
  - 고칠 방향: 서버 ID를 못 찾으면, 어댑터의 `_voice_text_channels`(서버 → `/voice join`한 텍스트 채널)에서 지금 채널(`event.source.chat_id`)과 연결된 서버를 찾아 쓰게 Hermes를 고쳐요. `hermes-agent/`는 git에서 빠져 있어서, 고친 내용을 프로젝트 안에 패치 파일로 두고 `setup-hermes`가 적용하게 해야 다른 노트북에서도 돼요.
  - 왜 서버 정보가 빠지는지(어디서 `raw_message`가 바뀌는지)는 아직 못 찾았어요.
- 아직 확인 못 한 것:
  - `tts.speed`, `tts.edge.speed` 키가 실제로 적용되는지 (음성방 재생이 돼야 확인 가능)
  - `platform_toolsets.discord: [todo]`로 도구를 줄인 설정이 먹히는지
  - 친구가 `npm run share` 주소로 들어와서 하는 것

## 다음 할 일
1. 위 "봇이 음성방에서 소리로 말하지 않아요" 고치기 → 봇 1개로 소리 확인
2. 봇 3개 모두 연결해서 수다 빈도 조절(`config/referee.json`). Opus 대답이 10초 정도라 느리면 `claude-haiku-5-5` 시험
3. `npm run share`로 친구와 시험
4. 완성 단계에서 ElevenLabs로 교체(README "조절하기")

## 노트북마다 할 것
깃에는 코드만 있어요. 아래는 노트북마다 따로 해야 해요(자세한 명령은 README "처음 한 번만 하는 준비").

1. `git pull` → `cd day6/homework/tudak-arena && npm install`
2. `brew install ffmpeg opus portaudio`
3. Hermes를 이 폴더에 clone·설치(README 2단계, 음성 추가 설치 포함)
4. `cp .env.example .env` 후 값 채우기. 키와 토큰은 채팅에 붙여넣지 말고 사용자가 직접 넣어요.
5. `npm run setup-hermes`
6. 친구들과 할 거면 `brew install cloudflared`

**봇은 한 노트북에서만 켜세요.** 두 노트북에서 동시에 `npm run bots`나 `npm start`를 켜면 같은 봇 토큰으로 두 번 접속해서, 대답이 두 번 나오거나 서로 꼬여요.
