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

### 두 번째 노트북(2026-11-02, Claude 세션 worktree `folder-work-review-7b053a`)에서 한 것
- 처음 만든 Mac에도 2026-11-02 21:40에 Hermes를 설치하고(`setup-hermes.sh --runtime-only`, 음성 추가 설치) `npm run setup-hermes`로 프로필 3개를 만들었어요. `npm run bots`로 코코·러비·Rou 모두 `discord connected` 확인. 음성 패치도 적용됨.
- 두 번째 노트북에서는 원래 폴더가 아니라 worktree 폴더(`tudak-arena/.claude/worktrees/folder-work-review-7b053a/day6/homework/tudak-arena`)에서 작업했어요. `.env`, `hermes-agent/`, `hermes-home/`도 거기 있어요(git 제외).
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

### 코코가 말끝에 "어바웃" (2026-11-02 23시 50분, 처음 만든 Mac)
- 원인: 코코는 말끝을 "~"로 늘이는데(예: "얄미워~"), 영어 목소리(Jessica)가 "~"를 "about"(약)으로 읽었어요.
- Hermes 패치 6번(`tools/tts_text_normalize.py`의 `prepare_spoken_text`): 목소리로 만들 글에서만 "~"를 빼요. 채팅 글은 그대로. Hermes로 "아 진짜 얄미워~"를 만들어 들어 보니 "얄미워"로 끝남.
- `common.md`에 "물결표(~) 쓰지 말고 '하자아'처럼 글자로 늘여"를 넣고, `coco.md`·`rou.md` 예시의 "~"도 뺐어요.
- 같이 찾은 것: Hermes 안내("📬 No home channel…")와 도구 표시("⚙️ tool_search…")가 코코 대사처럼 심판에게 잡혔어요(말풍선·대꾸). → 디스코드에는 도구 표시·중간 메시지·오래 걸림 안내를 끄고(`display.platforms.discord.*`), 홈 채널을 #투닥-중계2로(`DISCORD_HOME_CHANNEL`), 심판은 이런 줄을 대사로 치지 않아요.

### ElevenLabs 준비 (2026-11-02 23시 반, 처음 만든 Mac)
- Hermes에 ElevenLabs 패키지 설치(`npm run hermes -- pm install --extra voice --extra messaging --extra edge-tts --extra tts-premium`). 다른 노트북에서도 이 명령으로.
- `characters.json`: `tts.provider`("edge" | "elevenlabs", 지금은 edge), `tts.elevenlabsModel`(`eleven_flash_v2_5`, 가장 빠름), 봇마다 `elevenlabsVoice`(비어 있음). `setup-hermes`가 provider·voice_id·model_id와 `ELEVENLABS_API_KEY`를 프로필에 넣어요. elevenlabs인데 키나 목소리가 비면 멈추고 알려줘요.
- Hermes의 ElevenLabs는 `voice_id`, `model_id`만 읽어요(말 속도 설정 없음).
- `npm run voices`: 계정 목소리 목록 / `-- ko` 한국어 라이브러리 / `-- test <voice_id> "문장"` 맥 스피커로 바로 들어 보기.
- **ElevenLabs로 전환함**(2026-11-02 23시 40분). 무료 요금제(월 10,000 크레딧). 목소리는 계정 기본 목소리 중에서:
  - 코코 **Jessica** `cgSgspJ2msm6clMCkdW9` (playful, bright, young female)
  - 러비 **Will** `bIHbv24MWmeRgasZH58o` (relaxed, young male)
  - Rou **Liam** `TX3LPaxmHKxFdv7VOQHJ` (energetic, young male)
  - 영어 목소리라 한국어에 억양이 조금 섞여요. 사용자는 나중에 목소리만 바꿀 생각이에요.
- 한국어 원어민 라이브러리 목소리(예: 코코 후보 **Yooni** `n2fbxG88jqAoaVPUy3IG`, 서울, 젊은 여성)는 무료 요금제에서 API로 못 써요(402 paid_plan_required). 유료 구독하면 `elevenlabsVoice`만 바꾸고 `npm run setup-hermes` → 봇 재시작.
- 확인: 목소리 만들기 0.55~0.63초(첫 요청만 2초). Hermes 안에서 코코 설정으로 `text_to_speech_tool` 실행 → provider elevenlabs 성공(1.1초). 봇 3명 재시작 완료. 실제 음성방 재생은 사용자 확인 전.

### 사람 플레이어 호칭 "도도" + 대화 기록 진짜로 새로 시작 (2026-11-02 23시 15분, 처음 만든 Mac)
- 사용자를 **"도도"**라고 불러요. `characters.json`의 `player.callName`. 심판은 사건 문장에 이 호칭을 넣고, `common.md`의 `{{player}}`도 이걸로 바뀌어요("항상 도도라고 불러. 채팅 기록에 다른 이름이 보여도 따라 하지 마"). 웹 시작 화면에 적은 이름은 점수판에만 보여요.
- 봇이 시작 화면 이름으로 말하면 심판이 [수다]로 다른 친구에게 전할 때 "도도"로 바꿔요(옮지 않게).
- **앞의 "대화 보관"은 실제로는 새 대화가 아니었어요.** Hermes가 보관된 대화에 계속 이어 썼어요(코코 55개 메시지 중 19개에 예전 이름). 이번에는 봇을 끈 상태에서 각 프로필의 `state.db` `gateway_routing` 표와 `sessions/sessions.json`에서 디스코드 대화 연결을 지웠어요(대화 내용은 보관된 채로 남음). 지우기 전 백업: `hermes-home/profiles/<봇>/backups/state-before-reset-*.db`, `sessions-before-reset.json`.
- #투닥-중계에 남은 예전 메시지: 메시지 삭제는 되돌릴 수 없어서 Claude가 하지 않았어요. 대신 봇들이 채널의 예전 메시지를 읽지 않게 했어요(`DISCORD_HISTORY_BACKFILL=false`, 한도 0). 친구 말은 심판이 [수다]로 전해요. 채팅창을 정말 비우고 싶으면 사용자가 디스코드에서 직접(채널 복제 후 예전 채널 삭제 → 새 채널 ID를 `.env`에 넣고 `npm run setup-hermes`).
- 사용자가 채널을 복제해서 새 채널 **#투닥-중계2**(`1566818519742550177`)로 옮겼어요(예전 채널은 삭제). `.env`의 `DISCORD_TEXT_CHANNEL_ID`를 바꾸고 `npm run setup-hermes` → 봇·게임 서버 재시작. 심판이 #투닥-중계2에 연결된 것 확인.
- `patch-hermes.js`가 "글 먼저" 패치를 이미 적용됐는데도 못 알아보고 매번 되돌렸다가 다시 적용하던 것을 고쳤어요(고친 코드가 통째로 있으면 적용된 것으로 봄). 결과는 같았어요.
- 아직: 새 대화가 실제로 만들어지는지, "도도"라고 부르는지 게임으로 확인 전. 확인 방법: `npm run hermes -- -p coco sessions list`에 새 디스코드 대화가 생기는지.

### 말하는 동안 다음 친구가 준비하기 (2026-11-02 23시, 처음 만든 Mac)
- 문제: Hermes는 "목소리 만들기 → 재생 → 글 올리기" 순서라, 다음 친구는 앞 친구 말이 **다 끝난 뒤에야** 생각을 시작했어요(침묵 약 4.5초). 심판을 빼고 봇끼리 직접 멘션해도 1초 정도만 줄고, 끝없는 대화·목소리 겹침·멘션 읽기 문제가 생겨서 이 방식을 골랐어요.
- Hermes 패치 4번(`gateway/run_turn_persistence.py`): 대사가 나오면 **글을 바로 올리고** 목소리는 뒤에서 만들고 재생해요(`TUDAK_FLOOR_URL`이 있을 때만).
- Hermes 패치 5번(`plugins/platforms/discord/adapter.py`의 `play_in_voice_channel`): 음성방에서 말하기 전에 게임 서버(`http://127.0.0.1:3301/floor/acquire`)에서 **말하는 차례**를 받고, 다 말하면 돌려줘요(`/floor/release`). 게임 서버가 꺼져 있으면 차례 없이 말해요.
- 게임 서버 `server/floor.js`: 차례는 한 명씩, 앞사람이 끝나고 0.25초 뒤 다음 사람(`referee.json`의 `voiceFloor.gapMs`). 8초 넘게 기다린 말은 지난 얘기라 버려요(`waitMaxMs`). 봇이 꺼져서 차례를 안 돌려줘도 20초 뒤 풀려요.
- 심판: 대사(글)가 올라오면 그 봇이 말하는 동안 바로 다음 친구를 불러 준비시켜요(`chainDelaySec` [0, 0.2], `gapMs` 0). 차례를 기다리는 목소리가 있으면 더 부르지 않아요(반응이 밀리지 않게). 웹 말풍선은 그 봇의 목소리가 시작될 때 띄워요(목소리가 안 나오면 6초 뒤).
- 테스트: 진짜 `floor.js` + 패치한 파이썬 코드로 네 봇이 동시에 말하려 할 때 0.25초 간격으로 한 명씩, 2.5초 넘게 기다린 말은 버림. 가짜 봇(대사 2초, 목소리 준비 1초, 말 2.5초)으로 코코→루→러비→코코 대화에서 앞 친구가 끝나고 0.25~0.3초 뒤 다음 친구가 말함. 실제 음성방에서는 사용자 확인 전.

### 사람 플레이어 이름 안 부르기 (2026-11-02 22시 50분, 처음 만든 Mac)
- 봇들이 사용자를 "도한"이라고 불렀어요. 출처 세 곳:
  1. 웹 시작 화면에 적은 이름(이 브라우저에 "도한"으로 저장됨)을 심판이 사건 문장에 넣어 보냈어요.
  2. 처음 만든 `bots/common.md` 예시에 "남은 사람: 러비, 도한"이 들어 있었어요(Claude가 넣은 것).
  3. 봇들의 Hermes 대화 기록에 그 이름이 쌓였어요.
- 고친 것: 심판은 사람 플레이어를 항상 "사람 친구"라고 전해요(`referee.js`의 `name('player')`). `common.md`에 "사람 친구의 이름은 몰라. 이름·디스코드 닉네임으로 부르지 말고 '너', '야'로 불러. 예전에 들은 이름도 쓰지 마"를 넣었어요. 웹 점수판에는 시작 화면에 적은 이름이 그대로 보여요.
- 봇 3명의 디스코드 대화를 보관(`hermes sessions archive --source discord --include-open`)했지만, 실제로는 새 대화로 시작되지 않았어요(아래 "도도" 항목 참고).
- 남은 것: 새 대화를 시작할 때 봇은 #투닥-중계의 최근 12개 메시지를 같이 읽는데, 그중 7개에 예전 이름이 있어요. 게임을 조금 하면 밀려나요. 그동안은 위의 "예전 이름 쓰지 마" 규칙으로 막아요.

### 더 빠른 반응 + 봇끼리 대화 (2026-11-02 22시 40분, 처음 만든 Mac)
- 로그로 잰 한 번의 반응(Haiku): 심판 멘션 → Hermes가 받기까지 **2.2초 대기** → Haiku 1.8초 → 목소리 만들기 1.2초 → 재생 5.7초(35자) → 글 올림. 다음 친구는 글이 올라온 뒤에 불려요.
- 고친 것:
  - Hermes는 봇이 보낸 멘션 뒤에 "이어지는 메시지"를 2초 기다려요(`HERMES_DISCORD_TEXT_BATCH_SPLIT_DELAY_SECONDS`). 심판은 한 줄만 보내니 0.2초로 줄였어요(`setup-hermes`가 프로필 `.env`에 넣음).
  - 대사 길이: 게임 사건은 15자 안팎, 수다·대꾸는 25자 이내(`bots/common.md`). 짧을수록 목소리 만들기·재생이 빨라지고 다음 친구 차례도 빨리 와요.
  - 심판: 사건 묶는 시간 1초→0.4초, 줄 세운 중요한 말은 5초 지나면 버림(늦은 반응 방지).
- 봇끼리 대화:
  - 받아치는 대꾸는 그 봇의 휴식 시간(8~15초)을 무시해요(전에는 이것 때문에 대꾸가 자주 막혔어요). 분당 상한과 "한 번에 한 명"은 지켜요. 분당 상한 게임 중 10, 쉬는 시간 12.
  - 대꾸는 최대 3번까지 이어져요(Jev 기준 0.55 → 0.65 → 0.75, Jev 없으면 40% → 25% → 15%). 앞사람이 끝나면 0.2~0.8초 뒤 바로 받아쳐요(쉬는 시간이 안 끝났으면 최대 3초 기다림).
  - 대꾸할 때 그 친구 이름을 부르며 받아치고, 가끔 다른 친구를 끌어들이게 했어요(`common.md`). 이름이 나오면 Jev가 그 친구를 다음 차례로 골라요.
- 테스트: 가짜 Jev로 "코코 말 → Jev 0.90 → 루 대꾸"까지 이어지는 것 확인. 실제 음성방에서는 사용자 확인 전.

### 빠르게: 봇 모델 Haiku + Jev 판단 (2026-11-02 22시 반, 처음 만든 Mac)
- **봇 모델을 `claude-haiku-5-5`로 바꿨어요.** 같은 사건에 대한 Hermes 대답이 3~5초(이전 Opus 약 10초).
- **Jev(TypeSafe System One, `jev-latest`)는 말을 만들지 않고 판단만 해요.** `server/judge.js`에서 두 가지를 판단해요. 키(`TYPESAFE_API_KEY`)가 없거나 1.5초 안에 답이 없으면 예전 규칙대로 해요.
  1. **받아치기**: 친구 말이 받아칠 만한지(noul)와 누가 받을지(choice). `referee.json`의 `retortThreshold` [0.6, 0.75] 이상이면 대꾸(예전엔 40%·20% 무작위).
  2. **음성으로 누구에게 한 말인지**: 이름을 부르면 지금처럼 그 봇(Hermes 패치, 바로 판단). 이름이 없으면 Hermes 패치가 게임 서버의 `http://127.0.0.1:3301/voice-listener`(내 컴퓨터에서만 열림, 친구 공유 터널에는 안 열림)에 물어보고, 서버가 최근 대화 8줄(`recent`)과 함께 Jev에 물어요. 봇 3명이 같은 말을 물어도 Jev는 한 번만 불러요(10초 캐시). "모두에게"거나 서버가 꺼져 있으면 코코.
- 실제 Jev로 확인(한 번에 0.17~0.23초): "너 또 혼자 살아남았지"→러비, "작전은 무슨 또 떨어졌으면서"→Rou, "다들 한 판 더 할래?"→모두. 받아치기: "루 너 진짜! 나 왜 밀었어?" 0.92→Rou, "다들 수고했어~" 0.29→넘어감.
- TypeSafe 키는 이 Mac에서는 **셸 환경변수**(`~/.zshrc` 등)에 있어요. `.env`의 `TYPESAFE_API_KEY=`는 비어 있어도 셸 값이 쓰여요. 다른 노트북에서는 둘 중 한 곳에 넣어야 해요.
- 아직: 실제 음성방에서 이름 없이 말했을 때 맞는 친구가 대답하는지 사용자 확인 전.

### 봇이 나를 따라 음성방에 들어오기 (2026-11-02 22시, 처음 만든 Mac)
- 디스코드는 봇을 친구로 추가할 수 없어요(친구 초대 목록에 안 뜸). 친구 목록에 보이는 "에이전트"(예: COCOBI-AGENT)는 사람 계정을 프로그램으로 움직이는 셀프봇이라 약관 위반이어서 쓰지 않기로 했어요.
- 대신 Hermes 패치 3번(`plugins/platforms/discord/adapter.py`의 `on_voice_state_update`): `TUDAK_FOLLOW_USER`(=`DISCORD_OWNER_ID`)가 `TUDAK_FOLLOW_VOICE`(=`characters.json`의 `voiceChannel`, "투닥-아레나")에 들어가면 `/voice join`, 나가거나 다른 방으로 옮기면 `/voice leave`를 주인이 친 것처럼 처리해요. 이 값은 `setup-hermes`가 넣어요.
- 들어올 때 봇마다 "음성 채널에 참여했어요" 안내가 채팅에 올라와요. 심판은 이 안내를 대답으로 치지 않게 걸러요.
- 봇이 켜지기 전부터 음성방에 있었으면 따라오지 않아요(들어오는 순간을 봄). 한 번 나갔다 들어오면 돼요.
- **실제로 따라 들어오는 것 확인됨**(2026-11-02, 사용자가 음성방에 다시 들어가니 세 봇이 따라 들어옴).
- `npm run bots`는 이제 `kill`(SIGTERM)로 꺼도 게이트웨이에 Ctrl-C를 전해 줘요.

### 음성방 소리 확인 + 한 번에 한 명만 말하기 (2026-11-02 22시, 처음 만든 Mac)
- **음성방에서 소리로 대답하는 것 확인됨**(로그 "Playing TTS in voice channel"). 패치(`patch-hermes.js` 1번)가 동작해요.
- 문제: 봇들이 동시에 말했어요. 원인 두 가지.
  1. 사람이 음성으로 말하면 봇 3명이 각자 알아듣고 동시에 대답했어요. → Hermes 패치 2번: 말에서 **먼저 불린 봇 한 명만** 대답하고, 이름이 없으면 **코코**(`characters.json`의 `voiceDefault`)만 대답해요. 이름은 `setup-hermes`가 프로필 `.env`의 `TUDAK_VOICE_*`에 넣어요. "루"는 단어 첫머리일 때만 쳐요("하루"는 아님).
  2. 심판이 2명까지 동시에 부를 수 있었고, 탈락·우승은 그 제한도 무시했어요. → `maxSimultaneous: 1`. 말하는 봇의 글 대답이 올라오면(글은 목소리 재생이 끝난 뒤에 올라옴) 0.7초(`gapMs`) 쉬고 다음 봇을 불러요. 탈락·우승처럼 중요한 한마디는 줄 세웠다가 부르고, 8초(`queueMaxAgeSec`)가 지나면 버려요. 대답을 기다리는 한도는 25초(Opus가 느려서).
  - 사람이 음성으로 봇을 부르면 그 봇이 받아 적은 글(`**[음성]** ...`)을 먼저 올려요. 심판은 그걸 보고 그 봇이 대답할 때까지 다른 봇을 부르지 않아요.
- 테스트: 실제 패치 코드로 이름 나누기 7가지(항상 한 명), 심판 순서 시뮬레이션(일반 호출은 버림, 중요한 건 앞사람 끝나고 0.8초 뒤, 음성 대답 중에는 대기).
- **러비가 대답 대신 오류**(`anthropic` 패키지를 못 찾음)를 냈어요. 두 번째 노트북의 Rou 오류와 같아요. 봇이 동시에 켜져서 Hermes가 하나를 거절(75)하고 다시 켤 때 생겨요. → `npm run bots`가 앞 봇의 `gateway.log`에 "Gateway running"이 찍힌 뒤 다음 봇을 켜게 바꿨어요. 다시 켜니 거절 없이 셋 다 켜졌고, API로 셋 다 2~4초 만에 대답했어요.
- 아직: 실제 음성방에서 동시에 말하지 않는지는 사용자가 확인해야 해요(봇을 다시 켜서 `/voice join`을 다시 해야 함).

### 다음 판은 직접 시작 (2026-11-02, 처음 만든 Mac)
- 판이 끝나도 자동으로 다음 판이 시작되지 않아요. 우승 화면의 **다시 시작** 버튼(또는 Enter)을 눌러야 해요. 관전자에게는 "기다리는 중"이 보여요.
- 내가 먼저 떨어지면 **다시하기** 버튼(또는 Enter)이 나와요. 누르면 봇들 싸움을 기다리지 않고 바로 새 판을 시작해요. 그 판은 우승 기록이 없어요.
- 판 사이에 오래 기다리는 동안 봇들이 계속 떠들지 않도록, "조용하면 아무 말이나 하기" 수다는 게임 중에만 해요.
- 브라우저에서 탈락 → 다시하기 → 새 판 카운트다운을 확인했어요. 60초를 기다려도 다음 판이 자동으로 시작되지 않는 것도 시뮬레이션으로 확인했어요.

### 음성방 소리 문제 — 고침, 실제 디스코드 확인 전 (2026-11-02, 처음 만든 Mac)
- 증상: 봇이 음성방에 들어오는데, 대답 목소리를 채팅에 `voice-message.ogg` 파일로 올렸어요.
- 원인: Hermes `gateway/run_voice.py`의 `_deliver_voice_reply`가 `_get_guild_id(event)`로 서버 ID를 찾는데, 심판 메시지로 시작된 대답에서는 `None`이에요. 그러면 "음성방에 없음"으로 보고 파일로 보내요.
  - 서버 정보가 빠지는 곳 후보: 봇이 대답하는 중에 들어온 메시지를 줄 세웠다가 다시 만들 때(`gateway/run_busy.py`) `raw_message` 없이 새 이벤트를 만들어요. Opus 대답이 10초쯤 걸려서 심판 멘션이 자주 줄을 서요. 실제 로그로 확인하지는 않았어요.
- 고친 것: `scripts/patch-hermes.js`. 서버 ID를 못 찾으면 `/voice join` 때 저장된 `_voice_text_channels`(서버 → 텍스트 채널)에서 지금 채널과 묶인 서버를 찾아요. Hermes 자체의 `_voice_ack_guild_for`와 같은 방식이에요.
  - `npm run setup-hermes`와 `npm run bots`가 자동으로 적용해요(이미 적용돼 있으면 건너뜀). Hermes를 업데이트해서 코드가 바뀌면 "패치 실패"가 떠요.
  - 테스트: 최신 Hermes(0aab6dcf) 사본에 두 번 적용(두 번째는 건너뜀), 파이썬 문법 확인, 가짜 어댑터로 재현 — 고치기 전에는 파일로 보내고, 고친 뒤에는 음성방에서 재생, 다른 채널이면 예전처럼 파일로 보내요.
  - **실제 디스코드 음성방에서는 아직 확인 못 했어요.** 이 Mac에는 Hermes와 `.env`가 없어요. 두 번째 노트북에서 `git pull` → `npm run bots`(패치 자동 적용, 봇 재시작) → `/voice join` → 게임으로 확인해요.

### 아직 안 된 것
- 아직 확인 못 한 것:
  - 위 음성방 소리 수정이 실제로 되는지
  - `tts.speed`, `tts.edge.speed` 키가 실제로 적용되는지 (음성방 재생이 돼야 확인 가능)
  - `platform_toolsets.discord: [todo]`로 도구를 줄인 설정이 먹히는지
  - 친구가 `npm run share` 주소로 들어와서 하는 것

## 다음 할 일
1. 두 번째 노트북에서 `git pull` → `npm run bots` → 봇 1개로 음성방 소리 확인(위 "음성방 소리 문제")
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
