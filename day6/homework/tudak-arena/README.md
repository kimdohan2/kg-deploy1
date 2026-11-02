# 투닥 아레나

코코, 러비, Rou와 밀치기 게임을 하면서, 세 봇 친구가 **디스코드 음성방에서 진짜 친구처럼 떠드는** 에이전트 프로젝트예요.

- 웹 게임: 원형 경기장에서 부딪혀 밀어내기. 경기장은 점점 좁아지고, 마지막 1명이 우승.
- 봇 3명: Hermes 에이전트 프로필 3개. 각자 Soul.md 성격대로 게임 상황에 반응하고, 목소리로 말해요.
- 심판 봇: 게임 사건을 보고 "누가, 언제" 말할지 정해서 봇을 부르는 사회자. 수다가 너무 많거나 적지 않게 조절해요.

```
웹 게임 (localhost:3300)
   │  사건: "Rou가 코코를 밀어 떨어뜨림"
   ▼
심판 봇 ── #투닥-중계에 "@코코 [게임] 사건: 루가 너를 밀어서 떨어뜨림 ..." 
   │
   ▼
코코 (Hermes) ── 채팅으로 대답 + 음성방 "투닥-아레나"에서 목소리로 말함
   │
   └─ 심판이 확률에 따라 다른 봇에게 "대꾸해"를 넘김 (최대 3마디)
```

## 과제 체크리스트

| 항목 | 어디에 |
|---|---|
| 별도 포트 | 웹 게임 **3300**, Hermes API 서버는 봇마다 따로: 코코 **8651**, 러비 **8652**, Rou **8653** (`config/characters.json`의 `apiPort`) |
| 이름 | 코코 · 러비 · Rou(말할 땐 "루") · 심판, 게임 이름 "투닥 아레나" |
| 설명 | 아래 "봇 소개 문구" |
| 프로필 사진 | `public/img/coco.png`, `lovey.png`, `rou.png`, `referee.png` (픽셀아트) |
| Soul.md | `bots/coco.md`, `lovey.md`, `rou.md` + 공통 규칙 `bots/common.md` → 설정 스크립트가 합쳐서 각 프로필의 `SOUL.md`로 넣어요 |

### 봇 소개 문구
- **코코**: 투닥 아레나 분위기 메이커! 밀리면 서운하고, 이기면 다 같이 칭찬해. 한 판 더 하자~
- **러비**: 투닥 아레나 생존 담당. 말은 짧게, 승부는 끝까지. ...시끄러우면 밀어버림.
- **Rou**: 투닥 아레나 자칭 돌진왕. 혼자 떨어져도 그건 작전이었음. 크하하!
- **심판**: 투닥 아레나 진행 담당. 경기 소식을 전하고, 누가 말할 차례인지 정해요.

## 처음 한 번만 하는 준비

### 1. `.env` 채우기
`.env`가 없으면(새 노트북) 먼저 `cp .env.example .env`로 만들어요. `.env` 파일을 열어 `=` 뒤에 메모해 둔 값을 붙여넣어요. (git에는 올라가지 않아서 노트북마다 따로 채워야 해요)

- `ANTHROPIC_API_KEY`
- `DISCORD_TOKEN_COCO`, `DISCORD_TOKEN_LOVEY`, `DISCORD_TOKEN_ROU`, `DISCORD_TOKEN_REFEREE`
- `DISCORD_OWNER_ID` (내 사용자 ID), `DISCORD_TEXT_CHANNEL_ID` (#투닥-중계 채널 ID)

### 2. Hermes 설치 (이 폴더 안에)
Hermes는 노트북 전체가 아니라 이 프로젝트 폴더 안에 설치해요. 코드는 `hermes-agent/`, 봇 데이터는 `hermes-home/`에 들어가요(둘 다 git에는 안 올라가요). 터미널에서 `tudak-arena` 폴더로 가서 차례로 실행하세요.

```bash
git clone https://github.com/nousresearch/hermes-agent hermes-agent
```

```bash
HERMES_HOME="$PWD/hermes-home" ./hermes-agent/setup-hermes.sh --runtime-only
```

디스코드 음성 기능용 추가 설치:

```bash
npm run hermes -- pm install --extra voice --extra messaging --extra edge-tts
```

음성 처리 프로그램도 필요해요. 처음 쓰는 노트북이면 `brew install ffmpeg opus portaudio`를 실행하세요.

> `hermes` 명령은 `npm run hermes -- <명령>`으로 써요. 이렇게 해야 이 폴더의 Hermes와 `hermes-home/`을 써요. 예: `npm run hermes -- profile list`

### 3. 봇 3명 설정 (한 번에)

```bash
npm run setup-hermes
```

프로필 `coco`, `lovey`, `rou`를 `hermes-home/profiles/` 아래에 각각 만들어요. 각자의 SOUL.md, 디스코드 토큰, 목소리, 모델, **API 포트**를 넣고, 게이트웨이도 봇마다 따로 돌게 설정해요. 여러 번 실행해도 괜찮아요.

## 놀 때마다 하는 것

1. **봇 켜기**: 터미널 하나에서 `npm run bots` (봇 3개의 게이트웨이가 각자 포트로 함께 켜져요. 이 창은 켜 둔 채로, 끌 때는 Ctrl-C)
2. **게임 켜기**: 다른 터미널에서 `npm start` → 브라우저로 http://localhost:3300
3. **음성방 연결**: 디스코드 음성방 **투닥-아레나**에 들어간 뒤, **#투닥-중계** 채팅창에서 `/voice join`을 봇마다 한 번씩 (목록에서 코코·러비·Rou 앱을 골라 3번)
4. 웹에서 이름 넣고 **시작하기** → 게임하면서 음성방에서 봇들 수다 듣기

조작: 방향키 / WASD 이동, 스페이스 돌진. 웹 화면 오른쪽 위 **봇 수다** 버튼으로 수다를 잠깐 끌 수 있어요(토큰 절약).

## 친구들과 같이 하기
내 노트북에서 게임과 봇을 켜 두고, 게임 주소만 인터넷에 열어서 공유해요. 노트북이 켜져 있는 동안만 돼요.

1. 위 "놀 때마다 하는 것" 1~3번대로 봇, 게임, 음성방을 켜요. `/voice join`은 나만 할 수 있어요.
2. 터미널을 하나 더 열어 `npm run share`를 실행해요. 처음 쓰는 노트북이면 `brew install cloudflared`를 먼저 하세요.
   - 화면에 나오는 `https://….trycloudflare.com` 주소를 친구에게 보내요. 주소는 켤 때마다 바뀌어요.
   - 켜 둔 동안 노트북이 잠들지 않아요. Ctrl-C를 누르면 주소가 닫혀요.
3. 친구는 디스코드 서버 "투닥-봇과함께"에 들어와서(서버 이름 → 초대하기로 링크를 만들어 보내요) 음성방 **투닥-아레나**에 들어와요. 그리고 받은 주소로 게임을 열어요.

- 한 번에 1명만 플레이하고, 나중에 들어온 사람은 관전해요. 플레이어가 나가면 관전하던 사람 화면에 시작 화면이 다시 나와서 이어서 할 수 있어요.
- 봇은 게임 사건(심판이 부를 때)에만 말해요. 친구가 채팅으로 봇에게 직접 말을 걸면 대답하지 않아요.
- 봇 대화 비용은 전부 내 Anthropic 키로 나가요. 주소를 아는 사람은 누구나 **봇 수다** 버튼을 켜고 끌 수 있어요.

## 조절하기

| 바꾸고 싶은 것 | 파일 |
|---|---|
| 수다 빈도, 간격, 대꾸 확률 | `config/referee.json` (서버 재시작) |
| 봇 이름, 목소리, 말 속도, 모델, 포트 | `config/characters.json` → `npm run setup-hermes` → `npm run bots` 재시작 |
| 성격, 말투 | `bots/*.md` → `npm run setup-hermes` |

- **반응 속도**: 기본 모델은 Claude Opus 5.5(`claude-opus-5-5`)예요. 대답이 늦게 느껴지면 `config/characters.json`의 `model`을 `claude-haiku-5-5`로 바꿔 보세요. 훨씬 빠르고 저렴해요.
- **ElevenLabs로 바꾸기 (완성 단계)**: 각 프로필 `hermes-home/profiles/<이름>/config.yaml`에서 `tts.provider: elevenlabs`, `tts.elevenlabs.voice_id: <목소리 ID>`로 바꾸고, `hermes-home/profiles/<이름>/.env`에 `ELEVENLABS_API_KEY`를 넣어요.

## 문제 해결

- **봇이 대답을 안 해요**: Developer Portal에서 봇마다 *메시지 콘텐츠 인텐트*가 켜져 있는지, `.env`의 `DISCORD_OWNER_ID`와 채널 ID가 맞는지 확인하세요. `npm run hermes -- -p coco logs -f`로 로그를 볼 수 있어요.
- **채팅은 오는데 소리가 안 나요**: `/voice join`을 했는지, 봇이 음성방 멤버 목록에 보이는지 확인하세요.
- **웹 오른쪽 위가 "디스코드 미연결"**: `.env`에 심판 토큰과 채널 ID가 비어 있으면 게임만 돌고 사건은 터미널에만 찍혀요.

## 폴더 구조

```
tudak-arena/
├─ server/
│  ├─ index.js      웹 서버 + 게임 루프 + 심판 시작
│  ├─ game.js       물리, 탈락, 우승 판정
│  ├─ bot-ai.js     봇 움직임 (Rou 막 돌진 · 러비 침착 · 코코 추격)
│  └─ referee.js    사회자 규칙, 디스코드 멘션, 대꾸 연결
├─ public/          웹 화면 (캔버스, 효과음 합성, 말풍선)
├─ bots/            Soul.md 원본 (공통 규칙 + 캐릭터별)
├─ config/          characters.json, referee.json
├─ scripts/
│  ├─ setup-hermes.js  봇 프로필 3개 만들기·맞추기
│  ├─ start-bots.js    봇 게이트웨이 3개 켜기 (npm run bots)
│  └─ hermes.js        이 폴더의 Hermes 실행 (npm run hermes -- ...)
├─ hermes-agent/    Hermes 코드 (노트북마다 clone, git 제외)
└─ hermes-home/     Hermes 데이터: profiles/coco, lovey, rou (git 제외)
```
