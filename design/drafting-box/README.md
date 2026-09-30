# zanviq.dev 리디자인: 설계 도면 × 명함 한 통

홈페이지 리디자인 확정 시안이다. 이 폴더는 정적 목업이며, 실제 사이트
(`frontend/`, Next.js)에는 아직 적용되지 않았다. 이 문서는 다른 사람이나
AI가 이 시안을 실제 코드에 옮길 때 필요한 것을 모두 담는다.

- **기준 파일은 `index.html`이다.** 숫자·색·간격이 이 문서와 다르면
  `index.html`의 CSS가 맞다.
- **미리보기**: `index.html`을 브라우저로 열면 된다(더블클릭 가능).
  폰트만 인터넷(Google Fonts, jsDelivr)에서 받는다. 로컬 서버로 봐도 된다.

## 1. 사용자가 확정한 것

| 항목 | 결정 |
|---|---|
| 전체 톤 | 연보라 계열. 단, 핑크빛이 아닌 **차가운 슬레이트 라벤더**와 흑연색 잉크. 여성스러운 장식(꽃, 밀랍, 필기체, 펄)은 쓰지 않는다. 개발자·사업가 느낌. |
| 섹션 디자인 | "설계 도면" 스타일: 사양표, 도면 표제란 카드, 연도 축 타임라인, 끝에 눈금이 있는 섹션 구분선 |
| 히어로 | "명함 한 통" 인터랙션: 명함 상자(100매) 뚜껑이 열리고, 맨 위 명함이 올라와 기울어지고 뒤집힌 뒤 구석으로 날아가 붙는다 |
| 명함 | 흰 종이 + 오른쪽 슬레이트 패널 + Z 로고. 뒷면은 슬레이트 바탕에 워드마크와 링크 |
| 배경 | 모눈 없는 은은한 라벤더 회색 종이(`#f1f0f5` + 종이 질감) |
| 푸터 | 표제란·저작권 줄을 **없앴다**. 대신 빈 여백(최소 300px, 화면 높이 38%)을 두고, 가운데에 `zanviq.dev`만 연하게(불투명도 0.14) 적는다. 구석에 붙은 명함이 마지막 내용을 가리지 않게 스크롤할 공간이다. |
| 넣지 않는 것 | 이력서식 마무리 문구("위의 기재 사항은 사실과 다름없습니다", 날짜, 서명, 도장) |
| 기능 | 지금 사이트의 기능은 모두 유지한다. 헤더(작업·소개·이력·운전·KO/EN), 명함 스크롤 연출과 도킹, 소개, 작업 목록, 접히는 타임라인·자격, 프로젝트 상세 페이지, `/drive`, 관리자 페이지 |
| 아직 안 정한 것 | 헤더 로고(보조선이 그려진 Z)와 명함 로고(사각 타일 Z)의 모양이 다르다. 통일할지는 사용자 확인이 필요하다. |

## 2. 파일 구성

```
index.html   화면 전체: 마크업 템플릿과 테마 CSS, 명함 상자 연출(pose/frame 훅)
base.css     레이아웃 기본값, 명함 스테이지 구조, 접히는 목록(grid-rows 0fr→1fr)
stage.js     명함 엔진. frontend/src/components/card/CardStage.tsx를 그대로 옮기고
             pose(p)·frame(state) 훅만 추가했다(아래 5절)
paper.js     종이 질감 생성기. frontend/src/lib/card/paper.ts를 옮기고
             어두운 쪽 색만 차가운 보라(30,29,44)로 바꿨다
common.js    한/영 문구, 언어 전환, 타임라인 접기/펼치기, 다시 그리기
data.js      실제 사이트 콘텐츠 스냅숏(목업용). 실제 사이트는 API에서 읽는다
card.json    새 명함의 CardDesign JSON 초안(6절)
assets/      목업용 이미지(아바타, 프로젝트 표지)
```

## 3. 디자인 토큰

### 색

| 이름 | 값 | 용도 |
|---|---|---|
| paper | `#f1f0f5` | 페이지 배경(종이 질감 위에 깔림), 헤더 배경(88%, blur 8px) |
| sheet | `#fbfbfd` | 카드·시트 면 |
| ink | `#1d1b24` | 본문 글자, 굵은 선, 버튼 채움 |
| soft | `#5c5868` | 보조 글자 |
| line | `#d2cfdd` | 가는 구분선, 테두리 |
| lav | `#8580b8` | 보조선, 강조 선 |
| deep | `#433d7a` | 링크, 기간 표기, 타임라인 막대, 명함 패널·뒷면 |
| pale | `#e4e2f1` | 선택 영역, 사진 바탕 |
| slate | `#7e78b0` | (명함 상자 계열 보조) |
| board / board-dk | `#9e9ac0` / `#837fab` | 명함 상자 판지, 상자 옆면 |
| 명함 패널 글자 | `#cfcbea` | 명함 슬레이트 위의 보조 글자 |
| 명함 라벨 글자 | `#9591a5` | 명함 앞면 항목명(소속/웹/Mail) |

지금 `globals.css`의 `--paper / --ink / --leaf / --tangerine / --butter`
체계와 Tailwind 색 이름은 위 표로 **통째로 교체**한다. 원색(초록·주황·노랑)은
어디에도 남기지 않는다.

### 글꼴

| 글꼴 | 굵기 | 쓰는 곳 |
|---|---|---|
| IBM Plex Sans KR | 400 / 500 / 600 | 사이트 UI 전체: 헤더, 제목, 본문 |
| IBM Plex Mono | 400 / 500 | 데이터 성격의 짧은 글: 기간, 슬러그, 링크 주소, KO/EN, 스크롤 힌트, 사양표 값 |
| Pretendard | 400–700 | **명함 안의 글자**, 명함 상자 라벨 |
| Noto Serif KR | 700 | 명함 상자 라벨의 "명함" 한 단어만 |

- 지금 `layout.tsx`의 Fraunces와 Space Mono는 제거한다.
- 명함 글자는 `FONT_STACK.body`(`var(--font-body)`, Pretendard)를 쓰므로
  `--font-body`는 Pretendard로 유지한다.
- 사이트 UI 글꼴은 새 변수(예: `--font-ui`)로 IBM Plex Sans KR을 연결한다.
- `--font-mono`는 IBM Plex Mono로 바꾼다.

### 형태 규칙

- **테두리**: 1px만 쓴다. 굵은 2px 검정 테두리와 딱딱한 오프셋 그림자
  (`shadow-block`, `6px 6px 0 0 var(--ink)` 류)는 모두 없앤다.
- **그림자**: 부드러운 그림자 하나만 쓴다.
  `--lift: 0 1px 1px rgb(29 27 36 / .05), 0 18px 36px -26px rgb(40 36 90 / .35)`
- **모서리**: 시트·카드는 0, 버튼·언어 전환은 3px, 명함은 카드 폭의 1.6%.
- **섹션 구분선**: 제목 아래 1px 잉크 선, 양 끝에 9px 세로 눈금.
- **종이 질감**: 배경 `paper` 0.14, 시트 `cotton` 0.2, 명함 `cotton` 0.16,
  상자 `cotton` 0.28. 값은 `paper.js`의 알파 배율이다.
- **모션**: 사용자 동작(스크롤, 호버, 클릭)에 반응하는 것만 둔다.
  `prefers-reduced-motion`이면 명함 연출은 멈추고 앞면만 보인다.

## 4. 화면별 명세

실제 코드 파일을 괄호에 적었다.

### 헤더 (`components/Header.tsx`)
- 높이 60px, sticky, 배경 `paper` 88% + blur, 아래 1px `line`.
- **로고**: 보조선이 그려진 Z SVG(`index.html`의 `MARK()`) 28px + "zanviq"
  600 1.1rem.
- **메뉴**: 0.9rem 500 `soft`, 호버 시 `ink` + 밑줄(1px, 6px 띄움).
- **운전 버튼**: 1px `ink` 테두리, 3px 모서리, 핸들 아이콘 + 글자.
  호버 시 반전(`ink` 배경). 560px 이하에서는 아이콘만 보인다.
- **KO/EN**: 1px `line` 테두리 안의 두 칸, 현재 언어 칸은 `ink` 채움,
  IBM Plex Mono 0.72rem.
- `/drive`에서는 지금처럼 헤더를 숨긴다.

### 히어로: 명함 한 통 (`components/card/CardStage.tsx`)
- 스테이지 높이 260svh(`scroll.length = 2.6`).
- 명함 슬롯 비율 1.8(90×50 mm), 폭 `min(74vw, 700px, 46svh × 1.8)`.
- 스크롤 힌트는 화면 아래 4svh, Mono 0.75rem.
- 구성 요소(z 순서, 명함 슬롯 기준):
  - `tray`(z0): 상자 몸통. 슬롯 바깥으로 `inset: -9% -6%`, 판지색,
    아래 8px 옆면(`board-dk`). 안쪽 `inset 5.5% 4%`는 `#d9d6e8`에 안쪽
    그림자, 위 가운데에 손가락 홈.
  - `pile`(z1): 명함 더미. 슬롯 크기, 아래로 2–8px 쌓인 명함 가장자리를
    box-shadow로 표현.
  - 명함(`fly`, z2).
  - `lid`(z4): 뚜껑. `inset: -10% -7%`, 판지색 + 좌상단 광택, 아래 12px 옆면.
    가운데 흰 라벨: "명함 / 100매", 성명·규격(90 × 50 mm)·웹 표, 장식용 바코드.
- 스크롤 진행도 `p`(0–1, 기존 엔진의 부드럽게 따라가는 값)에 따른 연출:
  - `lid = smooth(0, .18, p)`: 뚜껑이 위로 130% 이동, -6° 회전, 사라짐.
  - `rise = smooth(.14, .34, p)`: 명함이 카드 높이의 8%만큼 올라오고 5% 커짐.
  - `tray = smooth(.30, .48, p)`: 상자와 더미가 아래로 40% 내려가며 사라짐.
  - 기울기는 `p = .30`부터, 뒤집기는 `.48 → .78`.
  - `p > .5`이면 상자 요소를 모두 `visibility: hidden`으로 숨긴다.
- 스테이지가 끝나면 지금과 똑같이 오른쪽 아래로 날아가 도킹(폭 260px)한다.
  클릭·Enter·Space로 뒤집히고, 호버 시 포인터 쪽으로 기울고, 누르면 작아진다.
- 정확한 수식은 `index.html` 맨 아래 `mount()`의 `pose()`와 `frame()`이다.

### 소개 (`components/HomeView.tsx`)
- 섹션 제목 "소개" + 눈금 구분선.
- `sheet`(1px `line` 테두리, `--lift`) 안에 2열(860px 이상에서 15rem / 1fr).
- **왼쪽**: 아바타. 정사각형, 흑백(`grayscale(1)`), `pale` 위에
  `mix-blend-mode: multiply`, 네 모서리에 14px 코너 마크. 캡션은 Mono
  "그림 1. {이름}".
- **오른쪽**: 첫 문단은 1.45rem 500(인사말), 나머지 본문은 1.04rem/1.9.
  그 아래 사양표(dt 8rem, 위 1px 잉크 선, 행마다 1px `line`):
  - 관심 분야: AI · 웹 개발
  - 주로 쓰는 도구: FastAPI, React
  - 소속
  - 연락: 링크들, Mono, `deep`
- 사양표 값은 지금 프로필 스키마에 없다. 소개 글에서 뽑아 목업에 넣은
  것이다. 실제 적용 시 프로필 필드를 추가하거나 고정 문구로 둘지 정해야 한다.

### 작업 목록 (`components/ProjectCard.tsx`)
- 2열 그리드(720px 이상), 간격 2rem.
- 카드: `sheet` + 1px `line` + `--lift`. 호버 시 테두리 `deep`, 3px 올라감,
  그림자 강조, 표지 1.02배 확대.
- 표지 16:10, 안쪽 여백 12px, 1px `line` 테두리.
- 그 아래 **도면 표제란**(1px 잉크 테두리 표):
  - 1행: 제목(600 1.2rem) + 요약(3줄 말줄임)
  - 2행: [슬러그 | 첫 번째 링크 주소 | 프로젝트 보기 ↗]
  - 셀 제목은 0.66rem, 값은 Mono 0.74rem
- "프로젝트 보기" 칸은 카드 호버 시 `deep` 채움 + 흰 글자.
- 01·02 같은 번호 배지는 없앤다.
- 섹션 제목 오른쪽에 Mono로 "프로젝트 N개".
- 비공개(draft) 배지는 목업에 없다. 기존 기능이므로 같은 톤(1px 테두리,
  Mono)으로 유지한다.

### 타임라인·자격 (`HomeView.tsx`의 `TimelineSection`)
- 두 섹션 모두 같은 컴포넌트다.
- 표 머리행: 기간 | 항목 | 연도 축(2자리 연도 눈금). 아래 1px 잉크 선.
- 행: `7.5rem | 1fr | minmax(12rem, 18rem)`.
  - 기간: Mono `deep`
  - 항목: 제목 600, 기관, 설명
  - **연도 축**: 기간 문자열을 파싱해("2021 – 2023"이나 "2022") 막대로 그린다.
    막대는 `deep`, 양 끝에 세로 눈금.
- 축의 범위는 두 목록(이력과 자격)의 최소·최대 연도를 합쳐 공유한다.
  구현은 `index.html`의 `yearsOf()`와 `axisRange()`를 보면 된다.
- 760px 이하에서는 축과 머리행을 숨기고 한 열로 쌓는다.
- 처음 3개만 보이고, "N개 더 보기" 버튼(1px 잉크 테두리, 호버 시 반전)으로
  지금처럼 grid-rows 0fr→1fr 전환하며 펼친다.
- 섹션 제목 오른쪽에 Mono로 축 범위(예: "2021–2026").

### 푸터 (`components/Footer.tsx`)
- 내용 없이 빈 여백 `min-height: max(300px, 38svh)`만 둔다.
- 가운데에 `zanviq.dev`(600, clamp(1.4rem, 3vw, 2rem), `ink`,
  불투명도 0.14) 한 줄만 적는다.
- `/drive`에서는 지금처럼 숨긴다.

### 이 목업에 없는 화면
프로젝트 상세(`ProjectView.tsx`), 마크다운 본문(`.prose-zanviq`), 관리자 화면,
`/drive` HUD는 목업에 없다. 같은 토큰으로 옮기면 된다.

- **상세 헤더**: 섹션 제목 규칙(눈금 구분선)과 Mono 메타 정보를 쓴다.
- **표지 이미지**: 1px `line` 테두리와 `--lift` 그림자.
- **본문 prose**:
  - 링크는 `deep`
  - 인용문은 왼쪽 2px `lav` 선
  - 코드 블록은 `ink` 배경(오프셋 그림자 없음)
  - 표는 1px `line`, 머리 셀은 `pale`
  - 목록 점은 4px `deep` 사각형
- `/drive`는 별도 3D 화면이므로 이번 범위가 아니다.

## 5. 명함 엔진 변경점 (`CardStage.tsx`)

`stage.js`는 `CardStage.tsx`의 계산을 줄 단위로 옮긴 것이다. 달라진 점은
다음뿐이다.

1. **`pose(p, base)` 훅**: 스크롤 포즈를 덮어쓴다.
   `{rx, ry, rz, sc, x, y}`를 돌려주며, x·y는 카드 크기 비율이다.
   명함 상자 연출은 기본 `cardPose()` 대신 다음을 쓴다.
   ```js
   rise = smooth(.14, .34, p); env = sin(PI * smooth(.3, 1, p)); flip = smooth(.48, .78, p)
   y  = -0.08 * rise * (1 - smooth(.4, .6, p))
   rx = 11 * env * (0.6 - flip)
   ry = 180 * flip + 8 * env * (1 - 0.6 * flip)
   rz = -2 * env * (1 - flip)
   sc = 1 + 0.05 * rise * (1 - smooth(.85, 1, p))
   ```
   도킹 비행 중에는 x·y 오프셋이 `1 - ease(win(t, 0, .5))`로 사라진다.
2. **`frame(state)` 훅**: 명함 주변 소품(상자)을 움직인다.
   매 프레임 `{p, t, docked, rx, ry}`를 받는다.
3. **`will-change: transform` 제거**: 명함 3D 요소에서 뺐다. 이게 있으면
   명함이 1.05배로 커질 때 글자가 번진다. 실제 코드의 `Card3D`에도 같은
   속성이 있으니 함께 확인해야 한다.
4. **부드러운 그림자 지원**: 새 명함은 딱딱한 오프셋 그림자 대신 이 그림자를 쓴다.
   `0 1px 2px rgb(28 27 34 / .1), 0 30px 50px -30px rgb(40 34 100 / .5)`
   (도킹 시 `0 16px 28px -14px …/.55`). 지금 `CardDesign.shadow`는
   오프셋 그림자만 표현한다. 방법은 둘 중 하나다.
   - `shadow.x = shadow.y = 0`일 때 위 부드러운 그림자를 쓴다.
   - `shadow`에 `soft: boolean` 같은 필드를 추가한다.

실제 코드에 옮길 때는 상자 연출을 `CardScroll`의 설정으로 두는 것을 권한다.
예를 들어 `intro: "none" | "box"`를 두고, `"box"`이면 소품을 그리고 위 pose를
쓴다. 그래야 `/admin/card`에서 켜고 끌 수 있다.

## 6. 명함 데이터 (`card.json`)

- **형식**: 새 명함을 `CardDesign`(`frontend/src/lib/card/types.ts`) 형식으로
  옮긴 초안이다.
- **크기**: 1080 × 600 단위(90×50 mm 비율).
- **좌표 환산**: 목업의 `cqw` 값을 `1cqw = 10.8 단위`로 바꿨다.
  글자 위치는 한두 단위 어긋날 수 있다.
- **확인 필요**: `/admin/card` 미리보기에서 `index.html`과 비교해 다듬어야
  한다. 실제 렌더러에서는 아직 확인하지 않았다.
- **Z 로고**: `image` 요소에 SVG data URL로 넣었다.
- **이름·한 줄 소개**: `{name}`, `{tagline}` 토큰이다.

**라이브 명함은 백엔드에 저장된 값이 우선이다.** `GET /api/card`에 값이
있으면 `normalizeCard()`가 그걸 쓰고, `defaultCard()`는 저장값이 없을 때만
쓰인다. 따라서 두 가지를 모두 해야 한다.

1. `frontend/src/lib/card/defaults.ts`
   - `defaultCard()`를 이 JSON 기준으로 바꾼다.
   - `PALETTE`를 3절 색으로 바꾼다.
2. 라이브 명함을 교체한다.
   - 관리자 편집기에서 저장하거나, 아래처럼 올린다.
     ```bash
     cp design/drafting-box/card.json content/about/card.json
     node tools/zanviq.mjs push card
     ```
   - `push`는 라이브에 바로 반영된다. 사용자 확인을 받은 뒤 실행한다.
   - 기존 명함은 먼저 `node tools/zanviq.mjs pull card`로 백업한다.

## 7. 적용 순서 제안

1. `globals.css`와 `tailwind.config.ts`의 토큰, `layout.tsx`의 글꼴을 교체한다.
2. `Header`, `Footer`를 바꾼다.
3. `HomeView`를 바꾼다: 섹션 제목, 소개 시트, `TimelineSection`에 연도 축 추가.
4. `ProjectCard`(도면 표제란)와 `ProjectView`, prose를 바꾼다.
5. `CardStage`에 pose/frame 훅과 상자 intro, 부드러운 그림자를 넣고,
   `will-change`를 정리한다.
6. `defaults.ts`(`defaultCard`, `PALETTE`)를 바꾸고, 관리자 명함 편집기에서
   새 명함이 제대로 보이는지 확인한다.
7. 빌드한다: `frontend/`에서 `node node_modules/next/dist/bin/next build`.
8. 배포 방법은 저장소 루트의 `CLAUDE.md`를 따른다. main에 push해도 배포되지
   않고, Pi에서 `git pull && docker compose up -d --build`를 해야 한다.
