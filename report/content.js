// 사이트에 나오는 글은 전부 이 파일에 있어요. 여기만 고치면 화면이 바뀌어요.
// 세 칸(intent 의도한 것, good 잘된 점, limit 한계 및 해결)에서 draft: true 는 "초안" 표시가 붙어요. 직접 고친 뒤 draft 줄을 지우면 표시가 사라져요.
// text 는 ["첫 줄", "둘째 줄"] 처럼 줄마다 따옴표로 나눠 적어요. 화면에는 줄마다 점(•)이 붙어요.
// text 를 빈 문자열("")로 두면 "직접 채울 자리"로 보여요. **굵게** 는 굵은 글씨가 돼요.

window.REPORT = {
  // 첫 화면은 위에서부터 course → title(큰 제목) → period → presenter 순서
  course: "키글 x 하비탄 AI 강의 2기",
  title: "AI Agent 강의 결과 발표",
  period: "2026.09.29 ~ 2026.11.10",
  presenter: "김도한 · 앱개발팀",

  // 회고 세 칸의 제목
  reflectionTitles: {
    intent: "의도한 것",
    good: "잘된 점",
    limit: "한계 및 해결",
  },

  projects: [
    {
      id: "landing",
      name: "랜딩페이지 + 챗봇",
      tagline: "코코비와 친구들을 소개하는 키글 놀이터 사이트",
      image: "assets/landing.jpg",
      color: "#e8930c",
      tags: ["Vercel", "Jev", "OpenAI", "관리자 페이지"],
      link: { label: "사이트 열기", url: "https://kg-deploy1-wheat.vercel.app" },
      features: [
        "친구들·영상관·게임·소개로 이어지는 한 장짜리 랜딩페이지",
        "화면의 캐릭터를 잡아서 던지는 놀이 요소",
        "배경·소품 그림은 이미지 생성 AI로 제작",
        "오른쪽 아래 챗봇: Jev(판단 전용 AI)가 자주 묻는 질문 중 맞는 답을 골라 줌",
        "관리자 페이지에서 질문·답변과 채팅 내역 관리",
      ],
      intent: { text: ["회사 '키글'을 소개하는 사이트를 만들려고 함", "회사 사이트, 캐릭터, 구글 스토어 앱 자료와 레퍼런스 사이트를 줌", "재미 요소와 앱 영상이 돋보이게 해 달라고 함"] },
      good: { text: ["전체 구성과 재미 요소, 영상이 부각되는 화면은 기대한 것보다 잘 나옴"] },
      limit: { text: ["구름, 커튼처럼 중간중간 들어가는 이미지는 여러 번 고쳤지만 기대한 만큼 나오지 않음"] },
    },
    {
      id: "russo",
      name: "루소 목공소 스무고개",
      tagline: "생각만 하면 목수 루소가 맞혀서 목각인형으로 만들어 줌",
      image: "assets/russo.jpg",
      color: "#b8642a",
      tags: ["OpenAI", "Jev", "Claude", "Cloudflare Workers", "관리자 페이지"],
      link: { label: "사이트 열기", url: "https://russo-workshop.dokh.workers.dev/" },
      features: [
        "주제 3개: 동물 51 · 음식 50 · 인물·캐릭터 100",
        "Jev가 채운 판단 표로 다음 질문을 고르고 정답을 좁혀 감",
        "목록에 없는 정답은 Claude가 새 질문을 하고 후보를 떠올림",
        "맞힌 정답을 OpenAI가 목각인형 그림으로 그려 상자에서 꺼냄",
        "관리자 페이지에서 기록과 사용량 확인",
      ],
      intent: { text: ["플레이어가 생각한 정답을 LLM(Claude)과 Jev(판단 전용 AI)를 이용해 유추해 나가게 함"] },
      good: { text: ["정답에 맞춰 키글 캐릭터를 이용한 이미지를 생성함", "LLM이 후보를 떠올리게 하니 정답률이 높아짐"] },
      limit: { text: [
        "주제를 셋으로 좁히고, 질문 55개와 Jev 확률표를 미리 만들어 비용과 대기 시간을 줄임",
        "대신 목록 밖 정답이나 비슷한 후보를 가리지 못해 오답이 많았음",
        "그래서 루소가 중간에 추측하고, 틀리면 LLM이 새 질문과 후보를 만들고 Jev가 확률로 채점하게 함",
        "**LLM은 떠올리고, Jev는 판단한다**",
      ] },
    },
    {
      id: "burger",
      name: "Show me the burger",
      tagline: "손님이 랩으로 주문하면 듣고 포스기에 찍는 버거집 게임",
      image: "assets/burger.jpg",
      color: "#d9a400",
      tags: ["Hermes", "Claude Haiku", "Discord 봇", "ElevenLabs"],
      link: { label: "사이트 열기", url: "https://show-me-the-burger.vercel.app/" },
      features: [
        "Hermes(오픈소스 AI 에이전트)로 만든 디스코드 봇 3명(코코·러비·루)이 손님",
        "손님이 자기 목소리로 인사하고 랩으로 주문 (미리 만든 랩 30곡)",
        "디스코드 음성방이나 채팅으로 주문을 3번까지 되물을 수 있음",
        "주문이 맞으면 기뻐하고, 틀리면 틀린 메뉴를 짚고 나감",
      ],
      intent: { text: ["랩 주문을 들은 뒤, 손님에게 무엇을 주문했는지 되물으며 Hermes를 통해 AI와 소통하게 함"] },
      good: { text: ["디스코드에서 캐릭터마다 Soul(성격 설정)을 정해, 각자 특성에 맞게 대화함", "ElevenLabs로 만든 랩이 실제 랩처럼 들림", "랩 목소리에 맞춰 캐릭터 목소리를 복제해, 말할 때와 랩할 때 같은 캐릭터로 들림"] },
      limit: { text: [
        "밀치기 게임에서는 봇들이 디스코드에서 각자 Soul대로 대화했지만, AI가 말하는 속도가 게임 속도를 따라가지 못함",
        "그래서 다 같이 떠드는 대신 버거집에서 1:1로 대화하는 방식으로 바꿈",
        "Hermes 무료 TTS로는 랩이 읽는 수준이라 쓸 수 없었음",
        "그래서 ElevenLabs로 랩을 따로 제작함",
      ] },
    },
    {
      id: "apphub",
      name: "앱허브",
      tagline: "프로젝트마다 흩어진 시트와 사이트 링크를 한곳에",
      badge: "추가 작업",
      image: "assets/apphub.jpg",
      color: "#5b6ef5",
      tags: ["Cloudflare Pages", "D1", "Google 로그인"],
      link: { label: "사이트 열기", url: "https://kigle-apphub.pages.dev/" },
      features: [
        "프로젝트별로 그룹(개별시트·공통시트·개발)과 링크 칸을 모아 보기",
        "새 프로젝트는 기본 구성으로 시작, 빈 칸은 누구나 채움",
        "전체 현황표와 담당자 화면, 초성 검색",
        "그룹의 사이트를 한 번에 모두 열기",
      ],
      intent: { text: [
        "담당 프로젝트가 늘면서 앱 개발에 필요한 여러 사이트의 즐겨찾기 관리가 번거로워짐",
        "한 사이트에서 담당자끼리 링크를 공유할 수 있게 함",
        "Claude가 시트를 참고하거나 스킬을 만들 때도 이 사이트 하나로 관리하길 기대함",
      ] },
      good: { text: ["담당 프로젝트를 한 번에 볼 수 있어 알아보기 편함", "허브집사 봇이 이 데이터를 읽어, 디스코드에서도 링크와 담당자를 바로 찾아 줌"] },
      limit: { text: ["개별시트·공통시트가 아닌 항목은 처음 한 번은 링크를 직접 만들어야 함", "자주 쓰는 링크는 기본 구성에 넣어, 새 프로젝트를 만들면 자동으로 채워지게 함"] },
    },
    {
      id: "debugview",
      name: "Firebase DebugView",
      tagline: "기기를 꽂고 버튼만 누르면 디버그 모드가 켜짐",
      badge: "추가 작업",
      image: "assets/debugview.jpg",
      color: "#f59e0b",
      tags: ["WebUSB", "Cloudflare Pages", "Google Sheets"],
      link: { label: "사이트 열기", url: "https://kg-debugview.pages.dev/" },
      features: [
        "터미널과 adb 설치 없이 브라우저가 기기에 직접 명령을 보냄",
        "버튼 하나로 디버그 설정 → 앱 재시작 → Firebase 콘솔 열기",
        "앱이 보낸 이벤트를 화면에 실시간 표시",
        "이벤트 시트와 대조해 안 들어온 이벤트와 오타를 찾는 확인표",
      ],
      intent: { text: ["Firebase 이벤트를 등록하면 콘솔에서 출력을 확인하는데, 이벤트가 많으면 알아보기 힘들고 과정도 번거로움", "콘솔 연결과 등록 이벤트 확인을 편하게 하는 데 초점을 둠"] },
      good: { text: ["버튼 하나로 디버그 모드를 켜고 콘솔까지 열림", "등록한 이벤트가 들어왔는지 시트와 대조해 바로 확인함"] },
      limit: {
        text: ["Unity나 Android Studio가 기기를 먼저 잡고 있으면 연결이 안 됐음", "버튼으로 adb를 끄고 다시 연결하는 도우미 앱을 따로 만듦"],
      },
    },
    {
      id: "untracked",
      name: "UNTRACKED",
      tagline: "눈 덮인 산을 자유롭게 타는 익스트림 스포츠 게임",
      image: "assets/untracked.jpg",
      video: "assets/untracked.mp4", // 작업물 장에서는 사진 대신 이 영상이 소리 없이 반복 재생돼요 (목록 화면은 사진)
      color: "#e2432c",
      tags: ["Fable 5.2", "GPT Image", "Tripo", "ElevenLabs", "Blender MCP", "three.js"],
      link: { label: "사이트 열기", url: "https://untracked-f2v.pages.dev/" },
      features: [
        "산 지도에서 출발 지점 5곳 중 하나를 골라 출발",
        "장비 5종: 걷기 · 보드 · 스키 · 윙슈트 · 패러글라이더",
        "레이스, 기록 도전, 트릭 점수 도전 · 실사와 포스터 화풍 전환",
      ],
      // 들어간 AI (이름, 맡은 일)
      aiTitle: "들어간 AI",
      ai: [
        ["Claude Code (Fable 5.2)", "게임 코드 전체. 서브에이전트 7개를 지휘하고 화면도 스스로 캡처해 확인"],
        ["GPT Image", "화풍 시안과 목표 화면, 캐릭터·소품 기준 그림, 메달·도장·로고"],
        ["Tripo P2 (fal)", "그림을 3D 모델로: 캐릭터, 나무 2종, 소품 5종"],
        ["ElevenLabs", "플레이어의 외침과 숨소리 12개"],
        ["Blender MCP", "모델 크기·방향 맞추기, 텍스처 줄이기, 동작 합치기"],
      ],
      aiNote: "AI가 아닌 것: 캐릭터 뼈대와 동작(Mixamo), 배경 음악(무료 음원)",
      intent: { text: ["Steep을 레퍼런스로, 눈 덮인 산맥을 자유롭게 돌아다니는 오픈월드 게임을 만들려고 함"] },
      good: { text: ["코드로 고칠 수 있는 부분을 최대한 다듬어, 조작감·파티클 등이 처음보다 많이 개선됨"] },
      limit: { text: [
        "첫 결과는 셰이더, 파티클, 머티리얼, 조작감 등 어색한 부분이 많아 직접 플레이하며 다듬어야 했음",
        "영상과 스크린샷으로 예시를 줘도 기대치만큼 나오기 어려운 부분이 있었음",
        "리소스 퀄리티를 올리면 지금보다 더 좋아질 것으로 봄",
      ] },
    },
  ],

  // 마지막 장: 느낀 점. title 은 굵은 큰 글씨, text 는 그 아래 작은 설명(따옴표 하나가 한 줄)
  closing: {
    title: "AI를 하면서 느낀 점",
    points: [
      {
        title: "강의 전과 후, 일하는 방식이 달라졌다",
        text: [
          "Opus 5.5를 기점으로 AI 활용 비중이 크게 높아짐",
          "예전엔 불안해서 직접 하던 부분이 점점 줄고, 업무를 어떻게 나눠 맡길지 고민하게 됨",
        ],
      },
      {
        title: "개발하는 사고방식이 달라지고 있다",
        text: [
          "예전엔 자료구조, 알고리즘, 아키텍처를 어떻게 짤지가 고민의 중심이었다면, 이제는 AI를 어떻게 효율적으로 돌릴지도 함께 고민함",
          "에이전트, 서브에이전트, 스킬, md로 반복 업무를 자동화하는 설계를 고민함",
        ],
      },
      {
        title: "그래도 마지막 검수는 사람이 해야 한다",
        text: [
          "AI 비중이 커질수록 불안도 있음",
          "AI도 실수할 수 있다는 걸 알기에, 결정과 마지막 검수는 아직 사람이 필요하다고 느낌",
        ],
      },
    ],
  },
};
