# 허브집사 (6일차 과제)

키글 앱허브([kigle-apphub.pages.dev](https://kigle-apphub.pages.dev/))에 모아 둔 링크와 담당자를 디스코드에서 바로 물어보는 Hermes 봇이에요.

| 과제 항목 | 내용 |
|---|---|
| 이름 | **허브집사** |
| 설명 | "앱허브 링크·담당자, 디스코드에서 바로 물어보세요" |
| 프로필 사진 | `bot/avatar.png` |
| Soul.md | `bot/SOUL.md` (링크를 다 외우는 꼼꼼한 집사, 빈 링크를 보면 살짝 잔소리) |
| 별도 포트 | Hermes API 서버 **8661** (투닥 아레나 8651~8653과 겹치지 않게) |

## 할 수 있는 것
1. **링크 바로 찾기**: "코코비 치과 애드몹", "덴티스트 플레이콘솔 링크 줘"
2. **담당자 묻기**: "코코비 치과 기획 누구야?", "도한님이 맡은 프로젝트 뭐 있어?"
3. **내 프로젝트 모아 보기**: "내 거 보여줘" → 앱허브 이름을 한 번 알려 주면 그 대화에서는 기억해요

봇은 앱허브 데이터를 **읽기만** 해요. 링크를 고치거나 지울 수 없어요.

## 앱허브와의 관계 (떼어내기 쉽게)
- 앱허브 코드(`~/Documents/kg-tools/kigleAppBoard`)는 **한 줄도 고치지 않았어요.**
- 봇은 이 Mac에 이미 있는 앱허브 배포용 wrangler 로그인(`~/.config/kigle-wrangler`)으로 D1 데이터베이스 `kigle-apphub`를 직접 읽어요.
- 봇이 실행하는 SQL은 `scripts/apphub.js`에 미리 적어 둔 SELECT 하나뿐이에요. AI가 SQL을 만들지 않아요.
- **떼어낼 때는 이 폴더를 지우면 끝이에요.** 앱허브 쪽에는 남는 게 없어요.
- 참고: wrangler 로그인은 쓰기 권한도 있는 계정이에요. 과제가 끝나면 봇을 꺼 두세요.

---

## 1단계. 디스코드에서 봇 만들기

천천히 하나씩 따라 하세요. 10분 정도 걸려요.

### ① 애플리케이션 만들기
1. [Discord Developer Portal](https://discord.com/developers/applications)에 들어가서 로그인해요.
2. 오른쪽 위 **New Application**을 눌러요.
3. 이름에 **허브집사**를 쓰고, 약관에 체크한 뒤 **Create**를 눌러요.
4. 지금 보이는 **General Information** 화면에서:
   - **App Icon**에 `bot/avatar.png`를 올려요.
   - **Description**에 설명을 써요: `키글 앱허브의 링크와 담당자를 디스코드에서 바로 찾아 드려요.`
   - **Save Changes**를 눌러요.
   - **Application ID**를 복사해서 메모장에 적어 둬요. ⑤에서 써요.

### ② 봇 설정
1. 왼쪽 메뉴에서 **Bot**을 눌러요.
2. **Username**이 "허브집사"인지 확인하고, 아이콘 자리에도 `bot/avatar.png`를 올려요.
3. **Public Bot**은 **끄세요**(OFF). 다른 사람이 아무 서버에나 이 봇을 넣지 못하게 해요.
4. **Require OAuth2 Code Grant**는 꺼 둔 채로 둬요.

### ③ 인텐트 켜기 (가장 중요해요)
같은 **Bot** 화면을 아래로 내리면 **Privileged Gateway Intents**가 있어요.
- **Server Members Intent** → **켜기**
- **Message Content Intent** → **켜기** (꺼져 있으면 봇이 아예 접속을 못 해요)
- Presence Intent → 꺼 둬도 돼요

맨 아래 **Save Changes**를 눌러요.

### ④ 봇 토큰 받기
1. 같은 **Bot** 화면의 **Token**에서 **Reset Token**을 누르고 확인해요.
2. 나온 토큰을 복사해요. **한 번만 보여요.**
3. 이 폴더의 `.env` 파일을 열어서 `DISCORD_BOT_TOKEN=` 뒤에 붙여 넣고 저장해요.
   - 토큰은 채팅이나 슬랙에 붙여 넣지 마세요. 토큰이 있으면 누구나 이 봇을 조종할 수 있어요.

### ⑤ 서버에 초대하기
Public Bot을 껐기 때문에 초대 주소를 직접 만들어요. 아래 주소에서 `앱ID`를 ①에서 적어 둔 Application ID로 바꿔서 브라우저에 붙여 넣어요.

```
https://discord.com/oauth2/authorize?client_id=앱ID&scope=bot+applications.commands&permissions=309237763136
```

1. **서버에 추가**에서 봇을 넣을 서버를 고르고 **계속하기** → **승인**을 눌러요.
   - 서버 목록에 안 보이면, 그 서버의 **서버 관리** 권한이 없는 거예요. 서버 관리자에게 이 주소를 보내 달라고 하세요.
2. 서버 멤버 목록에 허브집사가 **오프라인**으로 보이면 성공이에요. 아직 봇을 켜지 않아서 오프라인인 게 맞아요.

### ⑥ 전용 채널 만들고 ID 복사하기
1. 서버에 채팅 채널 **#허브집사**를 만들어요. 봇은 이 채널에서만 대답해요.
2. 디스코드 **설정 → 고급 → 개발자 모드**를 켜요.
3. **#허브집사** 채널을 오른쪽 클릭 → **채널 ID 복사**를 눌러요.
4. `.env`의 `DISCORD_CHANNEL_ID=` 뒤에 붙여 넣고 저장해요.

여기까지 하면 디스코드 쪽 준비는 끝이에요.

---

## 2단계. Hermes 설치 (노트북마다 한 번)

Hermes는 노트북 전체가 아니라 이 폴더 안에 설치해요. 코드는 `hermes-agent/`, 봇 데이터는 `hermes-home/`에 들어가요(둘 다 git에는 안 올라가요).

```bash
cd day6/homework/kigleapphub
git clone https://github.com/nousresearch/hermes-agent hermes-agent
HERMES_HOME="$PWD/hermes-home" ./hermes-agent/setup-hermes.sh --runtime-only
npm run hermes -- pm install --extra messaging
npm install
```

## 3단계. 봇 설정하고 켜기

1. `.env`를 채워요(`cp .env.example .env`). `ANTHROPIC_API_KEY`, `DISCORD_BOT_TOKEN`, `DISCORD_CHANNEL_ID`가 필요해요.
   - 디스코드 값이 비어 있어도 `npm run setup-hermes`는 돼요. 그때는 디스코드만 빼고 설정돼서 터미널에서 먼저 시험해 볼 수 있어요(아래 "터미널에서 시험하기").
2. 앱허브를 읽을 수 있는지 먼저 확인해요. 링크 몇 개가 나오면 성공이에요.
   ```bash
   npm run ask -- 찾기 애드몹
   ```
   - "로그인"이나 "Authentication" 오류가 나면, 앱허브 폴더에서 `npm run cf:login`을 한 번 실행하세요.
3. 봇 프로필을 만들어요(여러 번 실행해도 괜찮아요).
   ```bash
   npm run setup-hermes
   ```
4. 봇을 켜요. 터미널을 닫으면 봇도 꺼져요.
   ```bash
   npm run bot
   ```
5. 디스코드 **#허브집사** 채널에서 말을 걸어 보세요. 멘션 없이 그냥 쓰면 돼요.

### 터미널에서 시험하기 (디스코드 없이)
터미널 두 개를 써요. 이 Hermes는 대화할 때 게이트웨이에 붙는데, 처음 켜는 데 1분 넘게 걸려서 먼저 켜 둬야 해요(안 켜 두면 "Gateway starting: deadline" 오류가 나요).
```bash
npm run bot
```
다른 터미널에서:
```bash
npm run hermes -- -p hubjipsa chat -t mcp-apphub
```
`-t mcp-apphub`는 디스코드와 똑같이 앱허브 도구만 쓰게 하는 옵션이에요.

## 바꾸고 싶을 때

| 바꿀 것 | 어디서 | 그다음 |
|---|---|---|
| 성격, 말투 | `bot/SOUL.md` | `npm run setup-hermes` → `npm run hermes -- -p hubjipsa sessions refresh-prompts` |
| 모델, 포트 | `.env`의 `BOT_MODEL`, `BOT_API_PORT` | `npm run setup-hermes` → 봇 다시 켜기 |
| 대답하는 채널 | `.env`의 `DISCORD_CHANNEL_ID` | `npm run setup-hermes` → 봇 다시 켜기 |

## 문제 해결
- **봇이 오프라인이에요**: Developer Portal → Bot에서 **Message Content Intent**가 켜져 있는지 확인하세요. 로그는 `npm run hermes -- -p hubjipsa logs -f`로 봐요.
- **봇이 대답을 안 해요**: `.env`의 채널 ID가 **#허브집사** 채널 ID인지 확인하세요(서버 ID와 헷갈리기 쉬워요).
- **"앱허브를 읽지 못했어요"**: `npm run ask -- 찾기 애드몹`으로 먼저 확인하세요.

## 파일 구조
```
kigleapphub/
├─ bot/SOUL.md           허브집사 성격·말투·규칙 (원본)
├─ bot/avatar.png        프로필 사진
├─ scripts/apphub.js     앱허브 D1 읽기 + 찾기 (고정 SELECT, 3분 캐시)
├─ scripts/apphub-mcp.js 허브집사가 쓰는 도구 3개 (MCP 서버)
├─ scripts/setup-hermes.js  프로필 hubjipsa 만들기·맞추기
├─ scripts/hermes.js     이 폴더의 Hermes 실행 (npm run hermes -- ...)
├─ hermes-agent/         Hermes 코드 (git 제외)
└─ hermes-home/          Hermes 데이터 (git 제외)
```
