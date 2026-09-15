# Task #1 구현계획서 — Slack 내부 rhwp 뷰어와 `/rhwp` 명령어의 MVP 개발 기반

수행계획서: [task_m010_1.md](task_m010_1.md)

GitHub Issue: [#1](https://github.com/postmelee/rhwp-slack/issues/1)

마일스톤: M010 — v0.1.0

작성일: 2026-09-15 (Asia/Seoul)

상태: 구현계획서 검토 대기. 사용자가 수행계획서와 구현계획서 작성 진입을 승인했다. 제품 소스 구현과 Stage 1은 아직 시작하지 않았다.

## 단계 개요

| Stage | 제목 | 주요 산출 | 검증 |
| --- | --- | --- | --- |
| 1 | 개발 기반과 실제 rhwp 뷰어 | 프로젝트 설정, 고정 엔진·폰트, 읽기 UI, 로컬/iframe 테스트, CI | 실제 HWP/HWPX와 opaque-origin iframe에서 렌더링·페이지·확대 |
| 2 | Slack 명령과 문서 접근 | manifest, `/rhwp open`·`help`, 바로가기, 권한·파일 서비스 | 서명·파일 선택·멤버십·다운로드 제한·재시도 |
| 3 | Work Objects와 뷰어 세션 | 카드·상세 이벤트·일회성 교환·문서 API | Slack 실제 클릭 경로, 만료·다른 사용자·세션 재사용 |
| 4 | 통합 검증과 인계 | Linux 컨테이너, 제품 문서, 통합 시나리오, 최종 보고 | 로컬 자동 검사와 실제 Slack 검증을 각각 판정 |

## 문서 위치 확인

| 파일 | 수행계획서상 선택 위치 | Stage 산출물 경로 | 일치 여부 | 비고 |
| --- | --- | --- | --- | --- |
| 제품 진입점 | `README.md` | Stage 1·4 `README.md` | OK | 지원 상태·설치·명령 |
| 개발·Slack 설정 | `docs/development.md` | Stage 2·4 동일 | OK | 개발자용 설정 안내 |
| 아키텍처·접근 계약 | `docs/architecture.md` | Stage 3·4 동일 | OK | 확인 가능한 권한 경계 명시 |
| 엔진·폰트 출처 | `docs/dependencies.md` | Stage 1·4 동일 | OK | 버전·라이선스·해시 |
| 단계 보고 | `mydocs/working/` | `task_m010_1_stage1.md` ~ `task_m010_1_stage4.md` | OK | 단계 소스와 같은 커밋 |
| 최종 보고 | `mydocs/report/` | `task_m010_1_report.md` | OK | 실제 실행·한계·인계 |

## 공통 구현 계약

### 의존성과 빌드

2026-09-15 공식 npm registry/Node 배포 목록에서 아래 버전의 존재와 Node engine 조건을 조회했다. 조합의 실제 설치·타입 검사·런타임 검증은 Stage 1에서 한다.

| 구분 | 고정 버전 | 용도 |
| --- | --- | --- |
| Node.js / npm | 24.21.0 / 11.19.0 | 개발·CI·컨테이너 공통 runtime |
| `@rhwp/core` | 0.8.6 | HWP/HWPX 파싱·SVG 렌더 |
| `@slack/bolt` / `@slack/web-api` | 5.1.0 / 8.1.1 | HTTP 요청·Slack API |
| `express` / `@types/express` | 5.2.1 / 5.0.6 | Bolt receiver와 정적·문서 API |
| `vite` | 8.3.0 | 뷰어·worker 빌드 |
| `typescript` / `@types/node` | 5.9.3 / 24.13.4 | 타입 검사·서버 빌드 |
| `tsx` | 4.23.13 | 개발 실행·Node 테스트 |
| `@playwright/test` | 1.63.0 | 실제 브라우저·iframe 검증 |
| `dompurify` | 3.4.15 | 문서 SVG 삽입 전 정리 |
| `@fontsource/noto-sans-kr` / `@fontsource/noto-serif-kr` | 각각 5.3.0 | OFL 글꼴을 앱 소유 URL로 배포 |

- 버전 범위 기호 없이 저장하고 `package-lock.json`을 커밋한다. Slack 서버 의존성은 Stage 2에서 추가한다. 사용하지 않는 의존성을 Stage 1부터 설치하지 않는다.
- `@rhwp/core@0.8.6` tarball을 `--ignore-scripts`로 임시 폴더에 받아 `.d.ts`의 `HwpDocument(data)`, `pageCount()`, `renderPageSvg(page_num)`, `free()`와 WASM 존재를 확인했다. 아직 실제 렌더링을 실행한 것은 아니다.
- rhwp tarball integrity는 수행계획서의 SHA-512와 일치한다. WASM·폰트·라이선스를 lockfile 기반으로 복사하고 출력별 SHA-256 manifest를 빌드 산출물에 만든다. 생성 자산은 Git에 넣지 않는다.
- main viewer와 worker에 같은 폰트를 사용한다. 웹 폰트는 필요한 문자 subset을 누락시키지 않도록 원본 CSS의 unicode-range/weight와 파일 목록을 함께 가져온다. 첫 버전은 regular·bold 2개 weight를 지원한다.
- 모든 라이선스 고지를 빌드/컨테이너 산출물에도 포함한다. `dompurify`는 Apache-2.0 옵션을 따른다.
- `src/server/`는 Node에서, `src/viewer/`는 브라우저에서 실행한다. TypeScript server/viewer 설정을 분리하고 `src/shared/`에는 환경에 의존하지 않는 계약만 둔다.
- CI는 Linux에서 `npm ci`·자동 검증을 수행한다. Actions는 Stage 1 작성 시 공식 release SHA로 고정한다. 사용자 문서·실제 Slack 토큰 없이 실행되는 테스트만 기본 CI에 둔다.

### Slack 지원 범위와 scope

- 단일 `SLACK_TEAM_ID`와 지정된 `SLACK_CHANNEL_IDS`의 일반 공개/비공개 채널을 대상으로 한다. bot을 사람이 채널에 초대한 뒤 사용한다. 서버 시작 시 `auth.test` 결과와 team 설정을 대조한다.
- Bot OAuth scope는 `commands`, `chat:write`, `files:read`, `channels:read`, `groups:read`다. 파일 업로드는 후속 task이므로 `files:write`는 아직 요청하지 않는다.
- 사용자 토큰, 전체 메시지 이력 scope, `chat:write.public`은 사용하지 않는다. 명령은 현재 채널에 공유된 파일 permalink만 받으며 Slack 메시지 링크와 외부 문서 URL은 이번 버전에서 받지 않는다.
- `/rhwp` 입력은 Slack의 `<url|label>` 표기를 정규화하되, hostname은 설정된 workspace hostname과 정확히 대조한다. URL의 사용자 정보·비정상 port·모호한 인코딩·파일 ID 없는 URL은 거절한다. URL에서 얻은 file ID는 반드시 `files.info`로 다시 확인한다.
- 메시지 바로가기 callback은 `rhwp_open_document`다. 서명된 payload의 파일 목록에서 HWP/HWPX 후보를 고른다. 여러 파일이면 선택 modal을 열고 사용자·채널에 묶인 서버 측 선택 상태를 사용한다. 제출한 ID를 임의의 다른 파일로 바꾸면 거절한다.
- `entity_details_requested`와 파일 삭제/공유 해제 이벤트를 구독한다. 링크 자동 unfurl·모든 파일 자동 감시는 후속 범위로 둔다. Work Objects file entity와 embeds domain allowlist는 Slack 앱 설정에서 활성화한다.
- HTTP 이벤트·명령·interactivity는 `/slack/events`에서 Bolt ExpressReceiver로 받고 Slack 서명 확인을 우회하지 않는다. 보안 테스트에서는 실제 receiver에 변조 raw body·오래된 timestamp를 전송한다.

### 문서 접근 판정

1. 서명 검증된 Slack 요청에서 team/user/channel을 얻고 허용 workspace/channel과 대조한다. 모호한 필드는 실패로 처리한다.
2. `conversations.info`로 일반 채널 여부, bot 참여, 외부 공유 여부를 확인한다. DM/MPDM·Slack Connect·외부 공유 전환 중인 채널은 거절한다.
3. `conversations.members`의 cursor를 따라 요청자의 실제 참여를 확인한다. 첫 페이지에 없다는 이유로 없다고 판정하지 않는다. 페이지 수 상한에 도달하거나 응답이 불완전하면 접근을 허용하지 않는다.
4. `files.info`에서 실제 파일 ID·파일명·크기·유형과 해당 채널의 현재 공유 정보를 확인한다. 특정 사용자에게만 제한된 공유, 외부 파일 참조, 확인이 필요한 접근 상태는 거절한다. 필드 누락과 제한 없음은 동일하게 취급하지 않는다. 일반 파일의 허용 가능한 필드 조합은 공식 payload와 테스트 앱 응답을 대조해 명시한다.
5. 사용자 요청 채널과 파일의 공유 채널이 같을 때만 카드/세션/다운로드를 허용한다. 다른 채널에 카드만 재공유해도 원본 권한이 확대되지 않는다.
6. 다운로드 전, 카드 클릭 시, 문서 bytes 전달 시 위 권한을 다시 확인한다. 권한 조회 오류·429·부분 응답을 과거 성공 값으로 우회하지 않는다. 문서를 이미 내려받은 브라우저의 bytes까지 회수할 수 있다고 주장하지 않는다.

위 판정은 일반 채널의 공유 증거를 조합한 앱 정책이다. Slack 서버가 사용자별 파일 접근 여부를 직접 판정한 결과와 동등하다고 가정하지 않는다. 실제 응답으로 충분한 증거를 얻지 못하면 해당 문서 경로는 미지원으로 남긴다.

### 초기 운영 한도

아래는 제품의 초기 기본값이다. 엔진 자체의 하드 한계나 실측 SLA가 아니다. 변경할 때는 경계 테스트와 문서도 함께 갱신한다.

| 항목 | 기본값 | 초과/실패 처리 |
| --- | --- | --- |
| 원본 파일 | 20 MiB | 메타데이터와 실제 streaming bytes 모두 검사, 초과 시 중단 |
| 페이지 수 | 200 | 파싱 후 검사하고 전체 렌더 전 거절; 파싱 비용 제한과 구분 |
| 다운로드 | 30초 | AbortController로 전체 deadline 제어·부분 파일 삭제 |
| WASM 초기화·문서 parse·페이지 render | 작업별 30초 | worker 종료와 오류 UI; main thread의 timer만으로 동기 WASM을 중단했다고 주장하지 않음 |
| 준비 작업 동시성/대기열 | 2개 / 20개 | 큐 포화 시 즉시 혼잡 안내 |
| 요청 접수 | 3초 이내 | 파일 다운로드를 접수 경로에서 하지 않음 |
| Slack 읽기 API 재시도 | 최대 2회, 전체 준비 작업 120초 | Retry-After 준수; 시간 초과 시 재시도 안내 |
| 멤버 목록 | 페이지당 200명, 최대 100페이지 | 반복 cursor·미완료 조회는 권한 확인 실패 |
| 원본 임시 보관 | 15분, 전체 200 MiB | 초과 시 새 작업 거절, sweep와 종료 시 정리 |
| 문서 카드 식별 메타데이터 | 24시간, 최대 1,000개 | 만료 후 명령/바로가기로 다시 열기 안내 |
| 일회성 viewer ticket | 60초 | 원자적 1회 교환, 이후 재사용 거절 |
| viewer session | 5분 | 연장 없이 재클릭으로 재인증 |
| 재전송 식별 기록 | 24시간, 최대 10,000개 | 명시적 크기 제한, 재시작 한계 기록 |
| 확대 배율 | 50~200% | 잘못된 값 거절, 페이지 입력은 1~pageCount 정수 |

- 단일 프로세스의 메모리 상태와 프로세스 전용 임시 디렉터리를 사용한다. 디렉터리는 0700, 파일은 0600으로 만들고 문서명 대신 랜덤 내부 ID로 저장한다. 파일·디렉터리 경로를 입력 문자열로 구성하지 않는다.
- 앱 재시작 시 진행 중 작업·세션·메타데이터는 복구하지 않는다. 재시작을 넘는 exactly-once 보장은 없다. 이전 임시 디렉터리의 식별 가능한 자기 소유 파일만 TTL 기준 정리한다.
- Slack URL은 `files.info`가 제공한 인증 다운로드 URL을 사용하며 HTTPS·허용 host를 검사한다. 리다이렉트는 자동으로 따라가지 않고 승인된 Slack host에 대해서만 최대 2회 처리한다. 토큰을 다른 host에 전달하지 않는다. 알려지지 않은 CDN 경로는 기록 후 실패로 두고 무제한 허용하지 않는다.
- 파일 확장자만 믿지 않고 CFB(HWP) 또는 ZIP(HWPX) signature와 실제 parser 결과를 확인한다. 이 task의 HWP 범위는 평문 HWP5이며 HWP3은 후속 호환성 검토 대상으로 안내한다.

### 상태와 세션

- 문서 준비 상태는 `queued → downloading → ready` 또는 `failed`, 이후 `expired`다. `ready`는 원본 전송 준비 완료이며 클라이언트 렌더 성공을 뜻하지 않는다. 브라우저는 별도로 `loading → viewing/error`를 표시한다.
- 이벤트 중복 키는 Slack event_id, 명령/바로가기는 검증된 team·trigger·callback 식별자를 사용한다. 단순히 같은 파일명이라는 이유로 서로 다른 요청을 하나로 합치지 않는다.
- 최초 카드에는 민감하지 않은 문서 식별 URL과 embed 지원 선언만 둔다. 접근 ticket은 카드에 넣지 않고 사용자 클릭 이벤트를 받은 뒤 발급한다.
- `entity_details_requested` reference의 사용자 필드는 `event.user`, trigger는 `event.trigger_id`다. 일부 가이드 샘플과 위치가 다르므로 실제 reference payload를 계약 fixture로 사용한다. 검증되지 않은 wrapper 필드로 조용히 대체하지 않는다.
- `entity.presentDetails`에 권한을 검증한 뒤 `application/vnd.slack-embed`와 `/viewer/#ticket=...` 형태의 짧은 ticket URL을 전달한다. API 성공을 iframe 로딩 성공으로 취급하지 않는다.
- viewer는 fragment를 메모리로 읽고 즉시 주소에서 제거한 뒤 `/api/viewer/exchange`에 POST한다. 서버는 ticket을 원자적으로 소비하고 짧은 bearer session을 반환한다. 문서 bytes는 session Authorization header로 요청하며 token을 localStorage에 저장하지 않는다.
- HTML·JS·WASM·폰트는 사용자 문서를 포함하지 않는 정적 자산이다. 문서/교환 API는 `Cache-Control: no-store`, `Referrer-Policy: no-referrer`를 적용하고 body·token·원본 URL은 로그에서 제외한다.
- opaque origin을 지원하기 위해 허용한 `Origin: null` 응답에도 세션 인증을 요구한다. 정적 자산 CORS와 문서 API CORS를 분리하고 wildcard+credentials를 사용하지 않는다. 쿠키에 의존하지 않는다.
- signed ticket 또는 bearer session은 탈취되면 만료 전 소지자가 사용할 수 있다. 1회 교환·짧은 만료가 이 위험을 줄일 뿐 사용자 신원을 암호학적으로 증명하는 수단은 아니다.

## Stage 1 — 개발 기반과 실제 rhwp 뷰어

### 산출물

신규:

- `package.json`, `package-lock.json`, `.nvmrc`, `.gitignore`, `.env.example`, `tsconfig.json`, `tsconfig.server.json`, `vite.config.ts`.
- `src/viewer/index.html`, `main.ts`, `viewer.css`, `engine.ts`, `engine.worker.ts`, `fonts.ts`, `sanitize-svg.ts`.
- `src/shared/page-number.ts`, `errors.ts`; `scripts/prepare-assets.mjs`, `run-tests.mjs`.
- `tests/unit/`, `tests/viewer/`, `tests/fixtures/manifest.json`, `playwright.config.ts`.
- `.github/workflows/ci.yml`, `README.md`, `docs/dependencies.md`.
- `mydocs/working/task_m010_1_stage1.md`.

### 변경 내용

- 고정 의존성으로 실제 core를 초기화하고 `HwpDocument`·`pageCount()`·`renderPageSvg(index)`·`free()`를 호출한다.
- blocking WASM은 dedicated worker에 두고 `OffscreenCanvas`와 worker의 FontFaceSet으로 텍스트 폭 측정을 제공한다. worker의 폰트와 UI의 폰트를 모두 로드한 뒤 조판한다.
- opaque-origin iframe에서 worker 파일을 cross-origin 생성하는 제약을 피하도록 앱의 고정 worker 번들을 fetch 후 Blob worker로 생성한다. 실행 script는 빌드된 앱 코드만 사용하며 문서 문자열을 실행 코드로 연결하지 않는다.
- Blob worker에서 엔진·폰트의 실제 동작은 미검증 상태다. Stage 1에서 반드시 확인하고, 지원되지 않으면 main-thread 강제 fallback으로 timeout 보장을 숨기지 않는다. 실패 원인과 대안을 보고하고 계획을 수정한다.
- 페이지별 SVG는 DOMPurify SVG profile과 추가 URL 정책으로 정리한다. script·foreignObject·event handler·외부 href/url·외부 CSS 리소스를 차단하되 내부 fragment와 허용한 내장 raster image는 보존한다. CSS 선언의 url/import도 검사한다.
- 현재 페이지 중심으로 렌더하고 최대 3페이지·16 MiB의 SVG 캐시를 둔다. 페이지 이동/문서 교체 시 늦게 도착한 이전 응답을 generation ID로 무시한다.
- 로컬 파일 입력은 개발 모드에서만 활성화한다. production viewer는 session을 통한 bytes만 사용하며 임의 URL 입력 UI를 제공하지 않는다.
- fixture는 배포 허가를 확인할 수 있는 테스트 문서 또는 직접 만든 테스트용 서식을 사용한다. 문서별 SHA-256, 출처/사용 근거, 기대 텍스트·표·페이지와 비교 기준을 manifest에 남긴다. fixture 누락이면 테스트가 실패한다.
- 2페이지 이상 HWP5/HWPX 각 1개, 한글·표·이미지, 손상 입력을 검증한다. 렌더 결과의 페이지 내용 기대값을 같은 렌더 호출로 생성하지 않는다.

### 검증

```bash
npm ci
npm run typecheck
npm test
npm run build
npm exec playwright install chromium
npm run test:viewer
git diff --check
```

- `sandbox="allow-scripts"`와 실제 CORS/CSP 헤더를 적용한 로컬 parent/child iframe으로 초기화·worker·폰트·이미지·페이지 이동을 검증한다. 이것을 실제 Slack 검증으로 승격하지 않는다.
- 페이지 0/음수/소수/범위 초과 입력과 정상 첫·마지막 페이지, 빠른 문서 교체·취소·timeout을 검증한다.
- 악성 SVG의 외부 fetch/script 부재와 정상 내장 이미지·표·글자의 표시를 함께 검증한다. 정리 과정이 정상 출력을 숨겨 테스트를 통과시키지 않게 한다.
- screenshot 증거와 독립적인 기대 내용으로 실제 문서 영역을 확인한다. 의도하지 않은 외부 네트워크 요청은 실패로 처리한다.

### 커밋

```text
Task #1 Stage 1: 실제 rhwp 뷰어와 개발 검증 기반 구성
```

## Stage 2 — Slack 명령과 문서 접근

### 산출물

- `src/server/app.ts`, `config.ts`, `slack-client.ts`, `commands.ts`, `shortcuts.ts`, `access.ts`, `documents.ts`, `download.ts`, `jobs.ts`.
- `src/shared/command.ts`, `contracts.ts`; `slack/manifest.json`; `tests/slack/`, `tests/security/`, `docs/development.md`.
- Stage 1의 package/lockfile, `.env.example`, CI에 서버 검사 추가.
- `mydocs/working/task_m010_1_stage2.md`.

### 변경 내용

- `SLACK_BOT_TOKEN`, `SLACK_SIGNING_SECRET`, `SLACK_TEAM_ID`, `SLACK_WORKSPACE_HOST`, `SLACK_CHANNEL_IDS`, `PUBLIC_BASE_URL` 설정을 검증한다. 예제에는 실제 값 대신 명확한 자리표시자만 둔다.
- 앞의 scope·접근 판정·download 한도와 실패 처리를 구현한다. 로그인 사용자 대신 임의의 user ID를 넘겨 권한을 얻는 API를 제공하지 않는다.
- 바로가기 multi-file modal은 먼저 3초 이내 열고 선택 후 외부 API 조회를 수행한다. 선택 상태는 5분 후 만료하고 동일 사용자/채널과 대조한다.
- 준비 상태는 사용자에게 먼저 알리고 작업이 완료되면 카드 생성으로 연결한다. Stage 2 독립 검증에서는 fake publisher를 주입하되 production에서 카드가 구현된 것처럼 안내하지 않는다.
- 카드 게시의 불명확한 network timeout을 무조건 재시도하지 않는다. bot 메시지 중복 가능성을 상태로 남기고 사용자가 재요청할 수 있게 한다.
- `help`에는 현재 기능과 후속 기능을 구분한다. PDF/PNG 인자를 받아 실제 변환 결과인 것처럼 mock 파일을 보내지 않는다.

### 검증

```bash
npm ci
npm run typecheck
npm test
npm run test:slack
npm run test:security
npm run build
git diff --check
```

- 실 receiver에 보낸 유효/잘못된 서명·재전송·오래된 timestamp, 잘못된 team/channel을 검증한다.
- 2번째 멤버 페이지에서 허용되는 사용자, 반복 cursor, 제한 공유, file info 누락, DM/외부 공유, bot만 접근 가능한 파일을 검증한다.
- redirect로 token이 다른 host에 전송되지 않는지, chunked 전송이 Content-Length를 속여도 20 MiB에서 멈추는지 검증한다.
- 파일 다중 선택과 조작된 modal 제출, queue 포화와 부분 다운로드 정리, 실패 후 재시도 동작을 검증한다.
- 실제 API 확인이 없는 항목은 mocked contract 검증으로 표시한다.

### 커밋

```text
Task #1 Stage 2: Slack 명령과 문서 접근 권한 연결
```

## Stage 3 — Work Objects와 뷰어 세션 연결

### 산출물

- `src/server/work-objects.ts`, `sessions.ts`, `viewer-routes.ts`, `cleanup.ts`, `headers.ts`.
- `src/viewer/session.ts`; `tests/security/sessions.test.ts`, `tests/slack/work-objects.test.ts`, `tests/viewer/session.spec.ts`.
- `docs/architecture.md`, Slack manifest·서버·뷰어 연결 갱신.
- `mydocs/working/task_m010_1_stage3.md`.

### 변경 내용

- `chat.postMessage`의 file entity metadata로 카드 생성, 등록한 entity ID를 클릭하면 사용자별 접근 확인 후 `entity.presentDetails` 호출.
- `/viewer/`, `/api/viewer/exchange`, `/api/viewer/document`를 연결한다. 경로에서 파일 시스템 위치가 노출되거나 임의 document ID로 다른 세션의 파일을 받을 수 없게 한다.
- `GET /healthz`는 비밀값·문서 정보를 반환하지 않는다. health 성공은 Slack 통합 성공과 구분한다.
- CSP frame-ancestors는 공식 Slack origin 목록을 사용하고, 앱의 명시적 public origin만 script/connect/font 자산에 허용한다. 개발 iframe parent 허용은 production에서 비활성화한다.
- 파일 삭제/공유 해제 이벤트로 관련 세션을 폐기하고, 이벤트를 놓치더라도 bytes 제공 전 권한 재확인으로 허용하지 않도록 한다.
- token TTL과 임시 파일 cap을 fake clock 테스트와 실제 서버 테스트 양쪽에서 확인한다.

### 검증

```bash
npm run typecheck
npm test
npm run test:slack
npm run test:security
npm run build
npm run test:viewer
git diff --check
```

- 동일 ticket의 동시 교환 2회 중 1회만 성공, 잘못된 doc/team/session 조합, token 조작, 만료, 멤버십 취소·file unshare 후 bytes 요청 실패를 검증한다.
- 문서 API의 CORS preflight·Origin null·session header를 검증한다. 접근 권한 없이 Origin을 흉내 내도 다운로드되지 않아야 한다.
- 실제 테스트 Slack에서 `/rhwp open`과 메시지 바로가기 → 카드 클릭 → 내부 iframe → 다중 페이지 렌더와 확대까지 확인한다. 확인할 workspace/app/HTTPS 주소는 설정 안내 후 별도로 제공받는다.
- 실제 Slack 실행 환경이 없으면 Stage 3을 로컬 구현 완료·Slack 수용 미검증으로 기록하고 정식 Stage 완료/전체 완료로 보고하지 않는다. 독립 문서 준비는 가능하지만 다음 Stage 승인 여부를 대신하지 않는다.

### 커밋

```text
Task #1 Stage 3: Work Objects 내부 뷰어와 만료 세션 구현
```

## Stage 4 — 통합 검증과 인계

### 산출물

- `Dockerfile`, `.dockerignore`, `scripts/check.mjs`; fixture별 검증 증거 manifest.
- `README.md`, `docs/development.md`, `docs/architecture.md`, `docs/dependencies.md` 최종 갱신.
- `AGENTS.md` 프로젝트 섹션에 실제 실행/검증 명령과 공식 문서 참조 추가.
- `mydocs/working/task_m010_1_stage4.md`; 최종 보고 단계에서 `mydocs/report/task_m010_1_report.md`, 오늘할일 갱신.

### 변경 내용

- Node 24.21.0 기반 Linux 컨테이너에 서버·뷰어·고정 자산·라이선스를 묶고 비root 사용자로 실행한다. 이미지 tag와 실제 digest를 검증 증거에 기록한다.
- 실제 토큰과 사용자 문서는 이미지/CI artifact에 넣지 않는다. runtime 임시 파일 위치만 쓰기 가능하게 한다.
- docs에는 사용 가능한 `open/help`, 채널 지원 범위, 로컬 개발과 실제 Slack 설정, token 주입 위치, 문서/세션 만료·재시작 제한을 적는다.
- B와 PDF/PNG 후속 task에 재사용할 service 계약과 아직 구현하지 않은 기능을 정리한다. 파일 업로드 scope와 native-skia 패키징은 해당 후속 task에서 다룬다.

### 검증

```bash
npm ci
npm run check
docker build -t rhwp-slack:task1 .
git diff --check
```

- `npm run check`는 typecheck → Node 테스트 → build → browser 테스트를 순차 실행한다. 테스트 0개·fixture 없음·skip만 발생한 결과를 성공으로 취급하지 않는다.
- 컨테이너를 테스트 환경변수로 실행해 실제 정적 자산과 health endpoint, nonroot 파일 쓰기·TTL 정리를 확인한다. 토큰 없는 설정 오류와 프로세스 오류를 구분한다.
- Slack 웹·데스크톱에서 같은 HWP/HWPX를 열어 원본 문서 영역을 확인한다. 모바일·Slack Connect·배포형 앱은 실행하지 않았다면 명시한다.
- 최종 보고는 자동 검증, 수동 시나리오, CI/원격, 검증 한계로 나누고 앱 SHA·엔진 SHA/패키지 integrity·폰트·fixture SHA·출력 증거를 포함한다.

### 커밋

```text
Task #1 Stage 4: Linux 실행과 Slack 뷰어 통합 검증 정리
```

## 검증

- 각 Stage의 명령은 그 단계가 구현된 후 실행한다. 현재 문서의 명령은 검증 계획이며 통과 실적이 아니다.
- `npm test`는 전체 Node 계약 테스트, `test:slack`과 `test:security`는 해당 범위 진단, `test:viewer`는 Chromium 실제 브라우저 검증이다. 전체 테스트가 이미 통과한 이후 같은 테스트를 의미 없이 반복하지 않는다.
- 단계 종료는 실제 테스트 결과·실패·미검증 범위를 분리한다. 독립적인 기대값 없이 fixture를 생성된 출력에 맞춰 갱신하지 않는다.
- Source 코드 변경 후 이전 test 결과를 그대로 재사용하지 않는다. 관련 자동 gate를 다시 실행하고 검증 SHA를 기록한다.
- 문서 위치와 범위를 바꿔야 하면 승인된 수행계획서를 먼저 수정하고 변경 근거를 설명한다.

## 커밋

- 구현계획서 작성 단계는 수행계획서 승인 상태·오늘할일·이 문서만 `Task #1: 구현 계획서 작성과 승인 상태 갱신`으로 커밋한다.
- Stage별 소스와 `mydocs/working/task_m010_1_stageN.md`는 같은 커밋으로 남긴다.
- 최종 보고/오늘할일도 커밋한 뒤 `publish/task1`에 게시하고 `devel` 대상 PR을 연다. 현재 단계에서 push/PR을 하지 않는다. merge와 이슈 close는 승인 또는 실제 merge 확인 절차를 따른다.

## 단계 의존성

- Stage 1은 이 구현계획서 승인 후 시작한다. Slack 자격 증명 없이 실제 엔진과 opaque-origin 테스트를 진행할 수 있다.
- Stage 2는 Stage 1 검증·보고 승인 후 진행한다.
- Stage 3은 Stage 2 검증·보고 승인 후 진행한다. 실제 Slack 앱/HTTPS 설정이 준비되어야 C 방식 수용을 완료할 수 있다.
- Stage 4는 Stage 3 검증·보고 승인 후 진행한다. 최종 보고와 PR은 모든 필수 수용 기준을 확인한 뒤 별도 절차를 따른다.

## 위험과 대응

- **worker/폰트 호환성**: API 존재 확인은 실제 worker 렌더 성공 증거가 아니다. Stage 1에서 우선 검증하며 main-thread timer를 하드 timeout처럼 대체하지 않는다.
- **권한 필드·이벤트 차이**: reference와 SDK 타입·일부 샘플이 다를 수 있다. schema 검증과 실제 Slack payload 확인을 함께 수행하고 모호한 데이터로 권한을 허용하지 않는다.
- **대용량 parse 비용**: 페이지 상한은 파싱 후에만 알 수 있다. worker 종료·원본 byte 상한으로 별도 제한하고 memory hard cap을 보장한다고 주장하지 않는다.
- **signed URL 소지자 위험**: 짧은 만료와 1회 교환, 토큰 노출 최소화. Slack 사용자 본인 확인과 bearer possession의 차이를 문서화한다.
- **외부 실행 전제**: 테스트 workspace·bot/signing 값·HTTPS 주소가 아직 없다. 로컬 Stage 1과 계약 테스트를 진행하고 설정이 필요한 시점에 사용자에게 비밀값을 채팅에 올리지 않는 절차를 안내한다.
- **시각 충실도**: 고정 Noto와 한컴 원본 폰트는 다르다. 정상 표/이미지/텍스트 및 sanitizer 영향을 직접 확인하고 문서 전체 정합성을 일반화하지 않는다.

## 근거

- [Slack embeds](https://docs.slack.dev/messaging/work-objects-embeds/): iframe·인증·CSP·도메인 설정과 배포 조건.
- [entity_details_requested](https://docs.slack.dev/reference/events/entity_details_requested/): 사용자·trigger·entity 필드.
- [entity.presentDetails](https://docs.slack.dev/reference/methods/entity.presentDetails/): 사용자별 상세 응답.
- [files.info](https://docs.slack.dev/reference/methods/files.info/) 및 [file object](https://docs.slack.dev/reference/objects/file-object/): 파일 정보·공유·인증 URL.
- [conversations.info](https://docs.slack.dev/reference/methods/conversations.info/) 및 [conversations.members](https://docs.slack.dev/reference/methods/conversations.members/): 채널 상태·멤버십·scope·cursor.
- [rhwp v0.8.6](https://github.com/edwardkim/rhwp/tree/v0.8.6)와 npm `@rhwp/core@0.8.6` 배포물: 실제 API/type/WASM 목록 확인. 구현·렌더 실행 검증은 미실행.
- npm registry 패키지 metadata와 [Node 배포 목록](https://nodejs.org/dist/index.json): 2026-09-15 버전 조회.

## 승인 요청 사항

- 위 고정 버전, 4개 Stage, 파일별 책임, 초기 운영 한도, 최소 Slack scope와 권한 판정.
- 단일 workspace/인스턴스 및 재시작 시 복구되지 않는 상태 범위, worker의 실제 호환 검증 gate.
- 제품 문서 경로와 단계별 자동/실제 Slack 검증·보고·커밋 계획.

승인되면 Stage 1의 제품 소스 구현과 실제 rhwp 뷰어 검증을 시작한다.
