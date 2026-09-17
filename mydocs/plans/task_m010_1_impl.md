# Task #1 구현계획서 — 자체 호스팅 rhwp-studio 편집기

수행계획서: [task_m010_1.md](task_m010_1.md)

GitHub Issue: [#1](https://github.com/postmelee/rhwp-slack/issues/1) / 마일스톤 M010 / 변경일 2026-09-15

상태: Stage 1~5 완료, Stage 6 Linux·실제 Slack 연결 구현과 자동 검증 완료. 실제 웹 편집/저장·데스크톱 Studio 열기/PDF 첨부를 확인했으며 남은 수용 시나리오는 Stage 6 보고서에 기록한다. 원격 게시·이슈 종료 전이다.

## 단계 개요

| Stage | 제목 | 주요 산출 | 검증 |
| --- | --- | --- | --- |
| 1 | 기존 core 뷰어 | 62ab907, 완료 기록 | Studio에 결과 승계하지 않음 |
| 2 | Studio 전체 UI로 전환 | 고정 upstream·SDK·host·ephemeral overlay | 실제 편집·undo/redo·export·기록 없음 |
| 3 | PDF 기본 열람·편집 분리 | PDF 변환·별도 viewer/editor·작은 상태 영역 | 실제 PDF·수명·화면·오류 |
| 4 | Slack 명령과 문서 접근 | open/help/shortcut·권한·다운로드 | 서명·멤버십·공유·한도 |
| 5 | Work Objects와 편집본 저장 | 실제 embed·세션·파일 업로드 | 실제 Slack 열기·편집·저장·실패 |
| 6 | Linux와 통합 인계 | Docker·문서·최종 보고 | 로컬/실제 Slack/Linux 각각 판정 |

## 문서 위치 확인

| 문서 | 승인된 위치 | Stage 경로 | 일치 |
| --- | --- | --- | --- |
| 제품 진입점 | README.md | 동일 | OK |
| 의존성과 overlay | docs/dependencies.md | 동일 | OK |
| 설정·아키텍처 | docs/development.md, docs/architecture.md | 동일 | OK |
| 단계 보고 | mydocs/working/ | task_m010_1_stage2.md ~ stage6.md | OK |
| 최종 보고 | mydocs/report/ | task_m010_1_report.md | OK |

## 공통 구현 계약

### 고정 의존성과 Studio 배포

- 호스트 Node 24.21.0 / npm 11.19.0 / Vite 8.3.0 / TypeScript 5.9.3 / Playwright 1.63.0 유지.
- @rhwp/editor와 @rhwp/core는 0.8.6 고정. SDK integrity `sha512-Hc/rHrQrgZqJ2OSWNsPd/8tKyfnLer8M9r+U81yphJ7O8LaXLuv5A2yUub2fhFnfaYyfl76LfOIMsfcD0/dXgA==`.
- Studio 소스는 upstream v0.8.6 commit `f1f9c6ae58344ee9368996d3543f76b9345cf227`. 빌드 준비가 git commit과 필요한 원본 파일 해시를 확인한다. 로컬의 사용자 변경 소스는 배포하지 않는다.
- Studio의 원본 package-lock과 자체 소스·폰트·hwpctrl 플러그인을 사용한다. 앱 전용 빌드 설정과 작은 overlay만 이 저장소에서 관리한다. 캐시·생성 번들은 Git 제외.
- `chrome=embed` 강제, URL/로컬 파일로 문서를 바꾸는 진입을 차단한다. autosave schedule과 store, recent store, document history store를 영속화하지 않는 정책으로 고정한다. 설정 UI를 통해 재활성화되지 않아야 한다.
- Undo/redo는 현재 WASM 문서의 메모리 상태로 유지한다. 테마·폰트 설정과 원본·편집본 데이터의 영속 저장을 구별한다.
- SDK의 iframe은 자체 호스팅 /studio/를 사용한다. PWA·service worker, 외부 웹 폰트와 원본 URL 자동 로드를 비활성화한다.
- “문서 열기”는 Studio 자체 메뉴·툴바·편집 영역으로 직접 진입하고 “PDF로 보기”는 Slack PDF 첨부 미리보기로 연결한다. 호스트는 파일 식별·연결·저장·오류만 담당한다. Studio의 전체 브라우저 기능 지원을 선언하지 않는다.
- 기존 custom worker·SVG sanitizer·독자 페이지 UI는 제품 경로에서 제거한다. 필요한 fixture/입력 계약을 재사용하고 테스트는 Studio를 대상으로 다시 작성한다.

### Slack 지원 범위와 scope

- 단일 `SLACK_TEAM_ID`와 지정된 `SLACK_CHANNEL_IDS`의 일반 공개/비공개 채널을 대상으로 한다. bot을 사람이 채널에 초대한 뒤 사용한다. 서버 시작 시 `auth.test` 결과와 team 설정을 대조한다.
- Bot OAuth scope는 `commands`, `chat:write`, `files:read`, `channels:read`, `groups:read`다. Stage 5 편집본 저장에서는 `files:write`를 추가한다.
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
| Studio SDK 요청 | 초기 준비·load/export 기본 60초 | 응답 timeout·오류 UI. 동기 WASM의 강제 종료 또는 메모리 상한으로 주장하지 않음 |
| 준비 작업 동시성/대기열 | 2개 / 20개 | 큐 포화 시 즉시 혼잡 안내 |
| 요청 접수 | 3초 이내 | 파일 다운로드를 접수 경로에서 하지 않음 |
| Slack 읽기 API 재시도 | 최대 2회, 전체 준비 작업 120초 | Retry-After 준수; 시간 초과 시 재시도 안내 |
| 멤버 목록 | 페이지당 200명, 최대 100페이지 | 반복 cursor·미완료 조회는 권한 확인 실패 |
| 원본 임시 보관 | 15분, 전체 200 MiB | 초과 시 새 작업 거절, sweep와 종료 시 정리 |
| 문서 카드 식별 메타데이터 | 24시간, 최대 1,000개 | 만료 후 명령/바로가기로 다시 열기 안내 |
| 일회성 viewer ticket | 60초 | 원자적 1회 교환, 이후 재사용 거절 |
| 편집 session | 15분 idle / 최대 60분 | 유효한 활동·저장마다 권한 재확인, 만료 시 추가 읽기·저장 거절. 브라우저에 이미 받은 bytes 회수는 불가 |
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
- `entity.presentDetails`에 권한을 검증한 뒤 `application/vnd.slack-embed`와 `/editor/#ticket=...` 형태의 짧은 ticket URL을 전달한다. API 성공을 iframe 로딩 성공으로 취급하지 않는다.
- viewer는 fragment를 메모리로 읽고 즉시 주소에서 제거한 뒤 `/api/viewer/exchange`에 POST한다. 서버는 ticket을 원자적으로 소비하고 짧은 bearer session을 반환한다. 문서 bytes는 session Authorization header로 요청하며 token을 localStorage에 저장하지 않는다.
- HTML·JS·WASM·폰트는 사용자 문서를 포함하지 않는 정적 자산이다. 문서/교환 API는 `Cache-Control: no-store`, `Referrer-Policy: no-referrer`를 적용하고 body·token·원본 URL은 로그에서 제외한다.
- Slack allow-same-origin을 사용하며 호스트 origin 응답에도 세션 인증을 요구한다. 정적 자산 CORS와 문서 API CORS를 분리하고 wildcard+credentials를 사용하지 않는다. 쿠키에 의존하지 않는다.
- signed ticket 또는 bearer session은 탈취되면 만료 전 소지자가 사용할 수 있다. 1회 교환·짧은 만료가 이 위험을 줄일 뿐 사용자 신원을 암호학적으로 증명하는 수단은 아니다.

## Stage 2 — Studio 전환 (이번 사용자 지시로 승인)

### 산출물

- `studio/upstream.json`, `studio/vite.config.ts`, `studio/adapters/`, `scripts/prepare-studio.mjs`, `scripts/build-studio.mjs`.
- `src/viewer/`의 얇은 host·Studio adapter, package/lock, 개발 서버·CSP, production/dev build.
- `tests/viewer/` Studio 브라우저 테스트와 `tests/unit/` policy 계약. README·dependencies·Stage 2 보고서.

### 변경 내용

- 고정 Studio를 자체 호스팅하고 SDK로 실제 HWP/HWPX를 연다. 초기 제품 화면에 전체 편집 UI가 표시된다.
- 브라우저별 복구본·최근 문서가 이미 있어도 읽거나 복구하지 않는다. 새 기록과 서비스 worker도 만들지 않는다. 테스트는 페이지 재열기와 설정 재활성화 시도를 포함한다.
- 실제 글자·표·서식 편집, undo/redo, HWP/HWPX export 후 재열기로 변경 보존을 확인한다.
- 로컬 문서 선택·검증용 export는 개발 빌드에만 제공한다. production은 인증 연결 전 문서 기능을 열지 않는다. SDK RPC는 opaque origin에서 성공했다고 가정하지 않는다.
- 현재 단계에서 Slack 저장 성공을 가장하는 버튼은 제공하지 않는다. 저장은 Stage 5의 host adapter에 연결한다.

### 검증

```sh
npm ci
npm run prepare:studio
npm run typecheck
npm test
npm run build
npm exec playwright install chromium
npm run test:viewer
git diff --check
```

- 실제 SDK+Studio, allow-scripts allow-same-origin 중첩 iframe, 편집·undo/redo·export round trip.
- IndexedDB의 기존 draft 격리·새 autosave/recent/history 미생성, 설정 변경·시간 경과·재열기.
- worker hard timeout에 대한 이전 테스트를 Studio 검증으로 재사용하지 않는다. 응답 실패·손상/크기 제한·문서 전환은 새 경로로 검증한다.

### 커밋

`Task #1 Stage 2: Studio 전체 편집기 임베드와 문서 기록 비활성화`

## Stage 3 — PDF 기본 열람과 편집 진입 분리 (이번 사용자 지시로 승인)

### 산출물과 계약

- PDF.js 6.3.289를 고정하고 자체 호스팅 worker·CMap·폰트·WASM으로 페이지를 렌더한다. 브라우저 내장 PDF 플러그인의 유무에 의존하지 않는다.
- `/viewer/`는 PDF 전용 열람, `/editor/`는 Studio 편집 전용이다. 모드 전환 토글을 만들지 않는다. PDF의 “문서 편집” 동작이 같은 원본의 별도 편집 화면을 연다.
- 편집 상단은 파일명·미저장 상태만 표시한다. 파일명은 한 줄 말줄임, 전체 이름은 title로 확인한다. 개발 파일 입력은 접힌 테스트 도구 영역에 두며 production에 노출하지 않는다.
- 호스트가 실제 업로드를 제공할 때만 “편집본을 Slack에 저장”을 활성화한다. 이 단계에서는 Slack 저장을 성공으로 가장하지 않는다. 기존 전역 개발 테스트 SDK는 유지한다.
- `src/conversion/`은 고정 core 0.8.6 print SVG와 headless Chromium PDF 출력을 사용한다. Studio의 페이지 크기·SVG ID 분리 print 유틸리티를 재사용한다. 별도 native hwp2pdf 바이너리 도입은 이번 범위가 아니다.
- 입력 20 MiB·200페이지, PDF 출력 50 MiB, 단일 변환·60초 deadline. 변환 작업은 별도 프로세스에서 실행하고 부모 deadline에 프로세스 그룹을 종료한다. 메모리의 OS 하드 상한은 Linux 배포 단계에서 별도 설정한다.
- 변환 브라우저는 외부 네트워크를 허용하지 않는다. script/object/frame 실행을 CSP로 막고 로컬 폰트만 제공한다. 사용자 문서 내용은 HTML 문서 문자열에 이어 붙이지 않고 SVG DOM으로 삽입한다.
- 개발용 localhost API는 명시적 dev 플래그에서만 열리며 Origin 검사·크기·동시성·15분 TTL·총 200 MiB를 적용한다. 원본/PDF는 메모리에 두고 문서 ticket은 fragment로 전달한다. 이는 Slack 인증을 대체하지 않는다.
- Slack 연동에서는 생성 PDF 파일의 Slack 자체 미리보기를 기본 열람 진입으로 사용하고 별도 편집 진입을 제공한다. 현재 PDF.js 화면은 로컬 검증 및 웹 열람 경로다.
- 현재 PDF는 원본의 스냅샷이다. Stage 5에서 편집본을 새 Slack 파일로 저장한 후 그 revision의 PDF를 재생성한다. PDF 실패가 성공한 HWP 업로드를 취소하거나 중복 재업로드하게 만들지 않는다.
- 제품 문서 위치는 기존 승인된 README, docs/dependencies.md를 사용한다. 계획과 Stage 3 보고서는 기존 mydocs 경로를 사용한다.

### 검증

`npm run typecheck`, `npm test`, `npm run test:viewer`, `git diff --check`.
실제 2페이지 HWP/HWPX PDF의 페이지 수·한글·표·그림을 Poppler 렌더로 확인한다. dev/production 분리, PDF→편집 동일 원본, 긴 파일명·작은 viewport, dirty 표시, 손상 입력·변환 실패·중복·만료를 검사한다. 기존 Stage 2 known-failure를 보존한다.

### 커밋

`Task #1 Stage 3: PDF 기본 열람과 Studio 편집 진입 분리`

## Stage 4 — Slack 명령과 문서 접근

### 산출물

`src/server/` config·receiver·commands·shortcuts·access·download·jobs, Slack manifest, tests/slack·security, docs/development.md, Stage 4 보고서.

### 변경 내용

앞의 서명·scope·접근·download 계약을 구현한다. `/rhwp open`, `pdf`, `edit`, `help`, 다중 파일 선택을 연결한다. 권한 조회 실패는 접근 거절이며 3초 ack와 실제 작업을 분리한다.

### 검증

`npm run typecheck`, `npm test`, `npm run test:slack`, `npm run test:security`, `npm run build`, `git diff --check`.

### 커밋

`Task #1 Stage 4: Slack 명령과 문서 접근 권한 연결`

## Stage 5 — Work Objects·세션·편집본 저장

### 산출물

work-objects·sessions·viewer-routes·save service, host session/save adapter, files:write scope, 저장·권한 테스트, docs/architecture.md, Stage 5 보고서.

### 변경 내용

- Slack allow-same-origin과 도메인 목록, CSP의 모든 조상(Slack+host)을 설정한다. 실제 SDK handshake를 확인한다.
- 원본 bytes는 호스트가 인증된 API로 받아 Studio에 전달한다. Slack token은 Studio에 넘기지 않는다.
- 편집본은 export revision과 사용자·채널·원본에 결속한다. 업로드 전 접근·session·20 MiB 상한과 파일 signature를 검증한다.
- files.getUploadURLExternal/upload/completeUploadExternal로 원래 대화에 새 파일을 만든다. 실패 시 dirty를 유지한다. 저장 중 추가 편집이 없을 때만 notifySaved; 있으면 방금 보낸 revision만 저장 기록으로 남기고 현재 dirty를 보존한다.
- 파일명·변환 형식·원본과의 관계를 명시한다. 원본 자동 덮어쓰기·실시간 공동편집은 포함하지 않는다.

### 검증

자동 tests/slack·security·viewer와 실제 Slack 웹/데스크톱의 open→편집→새 파일 저장→재열기. 만료·접근 취소·업로드 실패·중복 클릭·저장 중 추가 편집을 검증한다. 자격 증명이 없으면 실제 수용 미검증으로 남긴다.

### 커밋

`Task #1 Stage 5: Work Objects 내부 편집과 Slack 편집본 저장`

## Stage 6 — Linux 실행과 통합 인계

### 산출물

Dockerfile/.dockerignore/check script, 문서 갱신, Stage 6·최종 보고서.

### 변경 내용

고정 의존성·Studio source·font/license로 Linux build를 재현하고 비root 실행을 검증한다. 실제 Slack과 자동 검사·미검증을 구별하며 thumbnail/png/ZIP 후속 요구는 보존한다.

### 검증

`npm run check`, `docker build`, 컨테이너 smoke, 실제 Slack 웹·데스크톱 시나리오, `git diff --check`.

### 커밋

`Task #1 Stage 6: Linux 실행과 Studio 통합 검증 정리`

## 검증 전략과 위험

계획의 명령은 실행 실적이 아니다. 각 단계 보고서에서 실제 실행·알려진 실패·미검증을 구별한다. Studio의 동기 parse hard timeout, 원본 출력 완전 일치, 모든 브라우저 기능·모바일·Marketplace 지원은 보장하지 않는다. 이전 core 이미지 결함은 Studio 경로에서 재확인한다.

## 단계 의존성과 승인 기록

사용자의 “변경해줘”는 제안한 Studio 전환의 계획 변경과 Stage 2 구현 승인으로 적용한다. 이번 변경을 계획 커밋 `Task #1: Studio 임베드 전환 계획 반영`으로 고정한 뒤 Stage 2를 구현한다. Stage 2는 adf6898로 완료했고 이후 PDF 우선 변경으로 Stage 3을 삽입했다. 아직 원격 push·PR 단계는 아니다.

## PDF 기본 열람 변경 승인

사용자의 “그렇게 진행하고 싶어”를 PDF 기본 열람·Studio 편집 전용 진입 및 상단 축소의 계획 변경과 Stage 3 구현 승인으로 적용한다. 완료된 Stage 1·2는 보존한다. 이전 Stage 3에서는 `/rhwp open`/`pdf`를 PDF에 연결하도록 계획했다. 아래 Stage 3.1 승인으로 `/rhwp open`과 `/rhwp edit`는 Studio, `/rhwp pdf`는 Slack PDF 미리보기로 변경한다. 원본 자동 덮어쓰기는 하지 않고 새 편집본 저장 후 해당 revision PDF를 생성한다. Stage 4는 Slack 명령·권한, Stage 5는 Work Objects·저장·PDF 재생성, Stage 6은 Linux·실제 Slack 통합 검증으로 이어진다.

## Stage 3.1 — Studio 직접 열기와 Slack PDF 열람 계약 (승인됨)

사용자의 “그렇게 수정해줘”를 이번 화면 정리·버튼 계약·관련 계획 및 제품 문서 갱신의 승인으로 적용한다. 기존 Stage 3 결과는 역사적 기록으로 보존한다.

- “문서 열기” 및 `/rhwp open`은 Studio 편집으로 직접 진입한다. `/rhwp edit`도 같은 편집 진입이다.
- “PDF로 변환” 버튼 이름은 “PDF로 보기”로 확정한다. `/rhwp pdf`도 생성·공유가 끝난 Slack PDF 파일을 연다. 별도 PDF.js 화면과 모드 전환 UI는 제거한다.
- PDF 생성은 서버에 유지한다. 향후 썸네일 준비 시 PDF도 함께 준비하고, 업로드·공유 완료 후 PDF 버튼을 제공한다. 준비/실패 상태는 편집 진입을 막지 않는다. 파일 링크의 실제 기본 미리보기 동작은 Slack 웹·데스크톱에서 별도 검증한다.
- Studio 상단의 별도 호스트 메뉴·테스트 상자를 제거한다. 파일명·미저장 표시는 브라우저 제목과 접근성 상태로 유지하고 로딩·오류 안내만 필요할 때 표시한다. 실제 Slack 저장 연결 전 가짜 저장 UI는 제공하지 않는다.
- 개발 파일 입력은 개발 빌드의 명시적인 `?devtools=1` 주소에서만 표시하고 문서를 열면 닫는다. 기본 화면·production에는 테스트 도구를 표시하지 않는다.
- 기존 `/viewer/` 진입은 `/editor/`로 이동하며 기존 문서 fragment를 보존한다. PDF.js 코드·직접 의존성·배포 자산을 제거한다. PDF 변환 테스트는 실제 API→PDF 출력 검증으로 유지한다.
- 현재 저장소에 Slack 카드/receiver는 없다. 이번 변경은 로컬 편집 UI와 후속 연동 계약에 해당한다. 실제 카드 “문서 열기”·“PDF로 보기”·“첫 페이지 이미지”와 업로드는 Stage 4·5 및 PNG 후속 task에서 연결한다.
- 제품 문서는 기존 승인 위치인 README.md, docs/dependencies.md를 갱신한다. 계획·orders·Stage 3 보고서의 후속 절을 기존 mydocs 경로에서 갱신한다.

검증: `npm run typecheck`, `npm test`, `npm run test:viewer`, `git diff --check`. 실제 HWP/HWPX 편집·undo/export·기록 금지, PDF 변환 API·원본 스냅샷 유지, 기본/production 테스트 도구 부재, 이전 주소 이동, 400px/669px 전체 높이 편집 화면과 오류 안내를 확인한다. 엔진 소스와 PDF 변환 구현은 변경하지 않는다.

커밋: `Task #1 [Stage 3.1]: Studio 직접 열기와 Slack PDF 열람 경로 정리`.


## Stage 4 진입 승인 및 구현 상세

사용자가 “확인했어. 이제 다음을 진행해줘.”로 Stage 3.1 결과와 Stage 4 진입을 승인했다. 기준 소스는 `3bb493f`다. 공식 Bolt 5.1.0을 고정하고 서명이 검증된 HTTP receiver, 명령·메시지 파일 선택, 접근 검사·다운로드·작업 상태를 구현한다.

- scope·채널·멤버십·파일 공유 판정은 위 공통 계약을 따른다. 제한 공유 여부의 명시적 false와 요청 채널의 같은 team 공유 증거를 요구한다. 실제 API가 필수 증거를 주지 않으면 미지원으로 거절한다.
- Slack API 읽기는 제한된 재시도·전체 deadline, 메시지/뷰 쓰기는 자동 재시도 없음. response_url은 사용하지 않고 고정 Slack API endpoint로만 응답한다. 서명·토큰·본문을 로그에 기록하지 않는다.
- 다중 파일 선택 상태는 서버의 무작위 ID에 team/user/channel/후보를 결속하고 만료·1회 사용을 적용한다. 메시지 원문은 보관하지 않는다.
- 이번 Stage의 ready는 원본 bytes 확인 완료다. 실제 Studio 세션·Work Object·PDF 업로드는 Stage 5다. 현재 실행 시 최종 연결 미제공을 명확히 안내하고 동작하지 않는 편집/PDF 링크를 만들지 않는다.
- 현 저장소에는 자격 증명이 없다. 실제 Slack에 메시지를 보내거나 앱 설정을 변경하지 않고, 실제 Bolt receiver와 합성 Slack API를 사용해 서명 및 흐름을 검증한다. 비밀값은 채팅으로 요청하지 않는다.
- 승인된 제품 문서 위치 `docs/development.md`에 앱 manifest 설정·실행·제약·검증을 작성한다. 기존 README·dependencies·계획·orders를 갱신한다.


## Stage 5 진입 승인

사용자의 “진행해줘”를 Stage 4 결과 확인과 Stage 5 구현 승인으로 적용한다. 기준 `6c028e0`에서 Work Object 카드·편집 세션·실제 업로드 adapter·PDF 공유·편집본 저장을 구현한다. 실제 Slack 자격 증명·HTTPS 주소가 없는 동안 네트워크 쓰기는 합성 API로 검증하며 Slack 실제 수용은 구분한다.

- 카드에는 원본 식별 ID와 편집 지원 metadata만 넣는다. 요청 사용자와 채널을 확인한 클릭에서만 60초 일회성 ticket을 발급하고, 교환 후 10분 idle·최대 60분의 메모리 bearer 세션을 사용한다. 이전 15분 idle 계획은 Slack 권고를 반영해 10분으로 줄인다.
- 원본·저장·저장 결과 조회에서 매번 권한을 확인한다. 문서 복구 및 브라우저 영속 token 저장은 금지한다.
- Slack 파일 업로드는 파일 ID별 완료 시도를 한 번만 수행한다. 완료 응답이 불확실하면 같은 파일의 공유 상태를 조회하며 새 HWP를 자동 중복 업로드하지 않는다. 클라이언트는 동일 저장 요청 ID와 bytes로 확인을 재시도한다.
- 저장할 export 전후 문서 epoch/changeSeq/hash를 검사한다. 서버 저장 성공 후 Studio 내부의 동기 비교와 clean 처리를 같은 실행 단계에 묶어 추가 편집이 clean으로 지워지지 않게 한다.
- 상단 메뉴는 재도입하지 않는다. 실제 세션에만 작은 저장 동작·결과 영역을 제공한다. PDF 생성은 원본 편집 진입 및 HWP 저장 성공과 분리한다.
- 기존 공식 문서 위치 docs/architecture.md, docs/development.md, README, dependencies를 사용한다. 계획·orders·Stage 5 보고서는 기존 mydocs 경로를 사용한다.

Stage 5 구현·검증 결과는 [Stage 5 보고서](../working/task_m010_1_stage5.md)에 기록했다. Node 41개·브라우저 16개 정상 통과, 기존 B-004 expected-failure 1개를 재현했다. 실제 Slack 수용은 Stage 6에서 별도 확인한다.


## Stage 6 진입 승인

사용자의 “다음을 진행해줘”를 Stage 6 구현·검증 승인으로 적용한다. 기준 소스는 `8d935f3`이다. Dockerfile·빌드 입력 제외 목록·통합 check·컨테이너 smoke·운영 문서를 구현한다. 기존 `docs/development.md`, `docs/architecture.md`, `docs/dependencies.md`, README를 사용하며 별도 제품 문서 루트를 만들지 않는다.

- 고정 Node 이미지와 lockfile로 Linux 빌드한다. runtime에 실제 필요한 Playwright·tsx를 일반 의존성으로 분류하고 Studio source/폰트의 필요한 변환 자산만 포함한다.
- 기본 로컬 수신은 127.0.0.1을 유지하고 컨테이너만 명시적으로 0.0.0.0에 바인딩한다. 외부 노출은 localhost 포트와 운영자가 마련한 HTTPS reverse proxy로 제한한다.
- non-root·read-only·tmpfs·메모리/CPU/pids 제한 아래 실제 파싱·PDF·HTTP·Studio를 검증한다. worker와 Chromium에 Slack 비밀 환경변수를 상속하지 않는다. Chromium 내부 sandbox와 컨테이너 격리를 같은 것으로 주장하지 않는다.
- 실제 Slack .env/HTTPS가 없으면 credentials나 외부 게시를 합성하지 않고 미검증으로 기록한다. 사용자에게 준비 여부를 요청하면서 독립적인 Linux 작업을 계속한다.
- 완료 보고는 구현 완료와 실제 Slack 수용 대기를 구별한다. 실제 수용 기준이 남아 있으면 전체 C 방식 출시 완료나 이슈 close를 선언하지 않는다.

### Stage 6 실제 API 대조 보정

실제 비공개 테스트 채널 연결에서 JSON POST 조회 인수가 무시되고 업로드 발급이 invalid_arguments로 거절됨을 재현했다. 조회는 공식 GET query, 쓰기는 Slack SDK와 같은 form 인코딩(중첩 값 JSON 문자열)으로 변경한다. 공식 업로드 예제와 실제 일반 파일 응답은 제한 공유 플래그를 생략하므로 Stage 4의 무조건 false 요구를 보정한다. 플래그가 없는 경우 visible·동일 user_team·전체 공유·채널 종류별 목록·빈 DM 목록과 기존 현재 채널 공유/멤버십 증거를 함께 요구한다. 명시적 제한과 불완전 응답은 계속 거절한다. 이는 일반 hosted 파일의 채널 공유 정책이며 사용자별 권한 API 검증으로 승격하지 않는다.

Linux 2 GiB 검사는 서버만 실행해도 실제 PDF 중 OOM으로 실패했다. 4 GiB 서버 단독 및 Studio 브라우저 포함 검사에서 통과했으므로 Compose와 CI 상한을 4 GiB로 보정한다. 합성 입력 실측을 최대 입력의 메모리 보장으로 해석하지 않는다.

실제 Slack 웹에서 일반 rhwp_open action trigger는 entity.presentDetails의 invalid_trigger_id로 거절됐고, 기본 카드 열기의 entity_details_requested는 같은 metadata로 Studio를 성공적으로 열었다. 새 카드에서 별도 열기 action을 제거하고 문서 제목·기본 사이드 패널 열기를 편집 진입으로 사용한다. PDF로 보기 action은 유지하며 과거 열기 버튼은 기본 제목 클릭 안내만 반환한다. 파일 링크 자동 제목 치환으로 명령에 URL이 전달되지 않는 경우를 확인해 사용법과 오류 안내에 복원/메시지 메뉴 경로를 추가한다.

### Stage 6 저장 스레드 연결 보정 (사용자 승인)

사용자가 실제 저장본이 새 채팅으로 게시되어 추적하기 어렵다고 보고하고 첨부 화면의 오른쪽 카드 스레드에 수정본이 누적되기를 요청했다. 새 최상위 카드의 게시 응답 ts를 답글의 부모로 저장하고, 기존 스레드에 게시한 카드는 기존 부모 thread_ts를 유지한다. 최초 PDF·편집 세션·수정본 HWP/HWPX·수정본 PDF 모두 이 서버 측 부모를 사용한다. 게시 응답의 유효한 ts가 없으면 채널 최상위로 업로드하지 않고 실패로 처리한다. 최상위 카드와 기존 스레드의 다른 ts를 각각 검사하고 production Studio 저장 통합 검사를 명령어 진입(스레드 없음)으로 보정한다. 기존 README/docs/보고서 위치를 사용한다.

## Stage 6.1 — 수정본 카드·썸네일·Slack 파일 열람 통합 (승인됨)

사용자의 “그렇게 구현해봐줘”를 앞서 분석한 카드 통합안의 구현/검증 승인으로 적용한다. 기준 1d1df32에서 같은 이슈와 local/task1을 이어간다. 저장마다 수정본 자체로 다시 편집할 수 있는 카드를 부모 스레드에 추가하고, PDF/첫 페이지 PNG는 별도 댓글 없이 같은 카드에 Slack 파일 참조로 갱신한다. 중복 본문 문구·일반 PDF URL 버튼을 제거한다. 썸네일은 기존 print 결과에서 만들고 페이지 PNG 명령/ZIP 전체 구현은 후속 범위로 유지한다.

- Slack의 비공개 업로드→카드 파일 참조 자동 공유를 실제 앱에서 먼저 검증한다. 공유 확인 이전의 파일을 저장 성공이나 사용자에게 열린 파일로 간주하지 않는다. 사용자 원본은 변경하지 않는다.
- 수정본의 file ID·bytes·이름·revision과 부모 관계를 결속한다. 재열기/재저장에서도 실제 수정본 권한을 확인하며 원본 삭제나 채널 이동으로 권한을 우회하지 않는다. 중복 요청은 같은 업로드/카드를 재사용하고 불확실한 게시 응답에서 새 댓글을 자동 중복 생성하지 않는다.
- PDF·썸네일은 동일 revision으로 생성한다. 실패가 HWP 저장 성공을 취소하지 않으며 카드에서 준비·실패를 구분한다. 기존 시간/파일 크기/큐/격리 한도를 유지한다.
- 제품 문서는 기존 README와 docs/development.md, architecture.md, dependencies.md를 갱신한다. 계획·orders·Stage 6.1 보고서·통합 보고서는 기존 mydocs 위치를 사용한다.
- 검증: 실제 Slack 파일 요소 클릭과 내부 PDF 표시, 댓글 수, 썸네일 표시, 수정본 재열기·다시 저장; 보안/재시도 회귀; npm run check; Linux smoke. 실제 클라이언트의 렌더링 제약은 결과와 구분해 보고한다.

Stage 6.1 결과: [수정본 카드·미리보기 통합 보고서](../working/task_m010_1_stage6.1.md). 실제 Slack 썸네일 카드가 내부 필드를 가리는 제약을 확인해 PDF 링크를 같은 메시지 상단의 mrkdwn 파일 링크로 보정했다. 웹·macOS 데스크톱 내부 열람과 두 번 저장/두 댓글을 확인했다.

## Stage 6.2 — 썸네일 카드 동작 검증 (설계 확인 중)

사용자가 큰 썸네일 카드를 유지하면서 하단 버튼을 요청했고, 후속으로 제목·이미지는 Slack PDF, 하단 “문서 편집”은 Slack 내부 Studio를 여는 구성을 문의했다. 기준 `9a9b36e`에서 합성 카드로 검증했다. 제품 구현은 Stage 6.1을 유지하며, 준비했던 하단 PDF 버튼 변경은 보류했다.

- 공식 파일 deep link를 footer URL로 사용하면 macOS Slack에서 PDF 파일 상세 패널이 열린다. PDF 뷰어까지는 추가 클릭이 필요하다. 웹에서는 새 빈 탭과 데스크톱 앱 호출이 발생하여 웹 내부 한 번 열기를 충족하지 못했다.
- 일반 버튼에서 `entity.presentDetails`를 즉시 호출한 실제 웹 검증: `invalid_trigger_id`, API 왕복 407ms. 같은 합성 카드의 제목 클릭 이벤트로 같은 metadata를 전달하면 성공(532/533ms)했고 Slack 내부 iframe에 합성 화면이 표시되었다. 문서 다운로드·권한 조회 지연 없이도 버튼 경로가 거절되므로 현재 경로로 역할을 뒤집는 구성을 제공할 수 있다고 주장하지 않는다.
- `full_size_preview`의 application/pdf는 공식 지원되지만 실제 비공개 PDF 전달·만료 URL·CORS 구현은 이번 검증에서 수행하지 않았다. 기존 Slack PDF 링크 열람과 이 방식을 구분한다.
- 합성 검증 메시지: https://rhwphq.slack.com/archives/C0C1X3ENGD8/p1789466826096809 . 임시 harness는 `.cache/slack/probe-edit-action.mts`, 보류 patch는 `.cache/slack/stage62-pdf-footer-deferred.patch` (모두 git ignored). 사용자 실문서는 사용하지 않았다.
- 공식 근거: https://docs.slack.dev/messaging/work-objects-implementation/ 및 https://docs.slack.dev/reference/methods/entity.presentDetails/ . 이 결과는 시험한 Work Object footer 경로의 제약이며 모든 Slack 통합 방식의 불가능성을 뜻하지 않는다.


### Stage 6.2 하단 편집 진입 재검증 — 2026-09-15

사용자가 채팅 카드의 제목·미리보기는 Slack PDF, 하단 “문서 편집”은 내부 Studio를 여는 구성을 다시 검증해 달라고 요청했다. 같은 합성 HWP와 비공개 테스트 채널에서 일반 버튼·처리 표시 옵션·이미 열린 상세 패널을 비교했다. 제품 소스 기준은 `9a9b36e`이며 이번에는 제품 소스를 바꾸지 않았다.

| 실행 경로 | 실제 결과 | 대조 근거 |
| --- | --- | --- |
| 채팅 카드 하단 일반 버튼 (`message_attachment`) | `entity.presentDetails`: `invalid_trigger_id`, API 354 ms | 같은 trigger의 `views.open`은 264 ms에 성공, Slack 대화상자 직접 확인. API 완료까지 클릭 후 1,075 ms |
| 채팅 카드 하단 `processing_state` 버튼 | `invalid_trigger_id`, API 316 ms | 같은 trigger의 `views.open`은 262 ms에 성공. API 완료까지 클릭 후 490 ms |
| 제목으로 상세 패널 열기 | `entity.presentDetails` 성공, 397 ms | 실제 Slack 상세 패널에 두 버튼 표시 |
| 이미 열린 상세 패널의 일반 버튼 (`entity_detail`) | `entity.presentDetails` 성공, 381 ms | 최초 시도는 뒤이어 발생한 `entity_details_requested`에 기본 metadata를 반환하여 iframe 진입 판정에서 제외 |
| 상세 패널 버튼 → 실제 Studio | 버튼 API 326 ms, 후속 상세 이벤트 API 302 ms에 성공 | 다음 상세 이벤트에도 편집 metadata를 반환하니 Slack 내부 iframe에 Studio·합성 HWP 두 페이지·저장 버튼 표시 |

- 일반 버튼의 클릭 식별자가 통째로 잘못되었거나 만료된 상황과, Work Object 상세 열기 API가 버튼 경로를 거절하는 상황을 구분했다. `views.open` 대조는 같은 클릭 trigger로 수행했다.
- 내부 Studio 수용은 macOS Slack에서 확인했다. 기존 production `authorizeFile`·다운로드·세션 발급·ticket 교환·원본 조회 경로를 사용했다. 시험용 카드 상태만 ignored harness에서 주입했고, 원본 SHA-256 `176179dea7ddccc397b0497a980e8a2ea1dd2dfe576f5fbee8b8cdf3f995325c`를 고정 대조했다. 실제 저장은 이번 재검증 범위가 아니며 Stage 6.1의 저장 검증과 구별한다.
- 판정: **이미 열린 상세 패널의 하단 버튼은 실제 Studio 진입이 가능하다. 채팅 카드 하단에서 한 번 클릭해 곧바로 내부 Studio를 여는 요청 조합은 이번 실측에서 성립하지 않았다.** 상세 패널 경로의 성공을 채팅 카드 경로의 성공으로 확대하지 않는다. 웹·모바일 및 별도 remote-file 연계는 이번 추가 검증 범위가 아니다.
- 공식 [action 처리 문서](https://docs.slack.dev/messaging/work-objects-implementation/#handling-block_actions-events)는 `message_attachment`와 `entity_detail`을 구분하고, 상세 패널 action 이후 `entity.presentDetails`로 갱신하는 흐름을 설명한다. [API 문서](https://docs.slack.dev/reference/methods/entity.presentDetails/)와 실제 응답을 함께 근거로 사용했다.
- 증적은 git ignored `.cache/slack/recheck-edit-button-results.ndjson`, `.cache/slack/recheck-edit-button.mts`, `.cache/slack/recheck-studio-desktop.png`다. 결과 로그에는 trigger·ticket·token·원문 payload를 기록하지 않았다. 임시 댓글과 검증 receiver는 정리하고 기존 서버로 복구한다.


## Stage 6.3 — 스레드 자동 미리보기·3→10페이지 PNG (승인됨)

사용자의 “그렇게 해서 우선 구현해봐줘. 내가 테스트할 수 있게도 해줘.”를 기본 3페이지 미리보기, 추가 페이지 요청 시 최대 10페이지, 작은 편집용 Work Object 및 실제 테스트 연결의 구현·검증 승인으로 적용한다. 기존 이슈 #1/M010과 local/task1에서 이어간다.

- 원본 HWP/HWPX를 포함해 전송한 메시지를 감지하고 메시지 ts 또는 기존 thread_ts에 한 댓글을 게시한다. 자동 답글은 채널로 동시 게시하지 않는다. bot 메시지·메시지 수정·다른 workspace/허용 밖 채널은 자동 변환하지 않는다. 이벤트 ID와 메시지/파일 ID로 재전송을 중복 제거한다. 기존 files:read 권한의 file_shared 이벤트와 files.info의 해당 채널 공유 기록으로 원본 메시지를 식별한다. bot의 재공유를 제외한 사람의 공유 기록이 하나일 때만 자동 답글을 만들고 여러 개면 메시지 메뉴로 위치를 지정하도록 안내한다. 자동 감지는 기존 files:read 권한에 file_shared 구독을 추가하며, 사용자 선택으로 멘션 전용 scope도 아래 절에 추가했다. 채널 history scope 추가는 자동 승인 검토에서 거절되어 적용하지 않았다.
- 댓글 본문은 파일명·전체 페이지 수·Slack PDF permalink, 1-based 페이지 PNG, 최대 10페이지까지 추가하는 동작으로 구성한다. 편집용 Work Object는 썸네일을 제거해 작게 유지하며 제목 클릭으로 내부 Studio를 연다. 공개 PDF URL이나 일반 버튼으로 Studio를 강제 여는 경로는 사용하지 않는다. PNG 이미지 클릭은 이미지 열람이며 PDF는 본문 링크로 연다.
- 초기 변환은 파싱/print DOM을 한 번 준비해 PDF와 첫 3페이지 PNG를 만든다. PDF와 첫 PNG를 우선 업로드·표시하고 남은 기본 PNG를 같은 댓글에 갱신한다. 추가 요청은 같은 원본/revision에서 아직 없는 페이지를 최대 10까지 생성하고 같은 메시지만 갱신한다. 동시 클릭·업로드 재확인의 상태를 결속하고 이미 업로드한 페이지를 중복 생성/게시하지 않는다.
- 원본/수정본의 권한·root revocation·메모리 보관 수명·서명/인증 경계는 유지한다. 변환은 기존 격리된 worker와 공유 큐, PNG별 5 MiB·합계 25 MiB·최대 10페이지·800×1200, PDF 50 MiB 한도 안에서 실행한다. 이미지 실패가 이미 공유한 PDF나 HWP 저장 성공을 취소하지 않는다.
- 문서 위치는 기존 README.md, docs/development.md, docs/architecture.md, mydocs/orders/20260915.md, 본 계획서 및 mydocs/working/task_m010_1_stage6.3.md를 사용한다. 최종 보고서는 기존 mydocs/report/task_m010_1_report.md에 후속 결과만 갱신한다. 기존 제품 문서 루트 선택을 유지한다.
- 검증은 변환 페이지 범위·상한·출력 연결, 최초 3/확장 10/짧은 문서, 동시 클릭·실패 후 같은 업로드 재확인, 잘못된 채널·메시지·root 접근 거절, 이벤트 중복/스레드와 bot 재귀 방지를 포함한다. npm run check, Linux smoke, 실제 Slack 합성 12페이지 문서에서 원본→자동 댓글→추가 페이지→PDF→Studio를 확인하고 사용자용 테스트 입력/메시지를 준비한다. 불확실한 혼합 메시지 레이아웃은 실제 앱에서 확인해 보정한다.

계획 커밋: `Task #1 [Stage 6.3]: 스레드 자동 미리보기와 페이지 확장 계획`. 구현/보고 커밋: `Task #1 [Stage 6.3]: 자동 스레드 미리보기와 3→10페이지 PNG`. 원격 push·PR·이슈 close는 이번 범위에 포함하지 않는다.

### Stage 6.3 멘션 입력 추가 — 사용자 선택

사용자가 파일 업로드 자동 감지와 `@rhwp` 멘션을 모두 지원하도록 선택했다. `app_mention`과 해당 이벤트 전용 `app_mentions:read`만 추가한다. 첨부 메시지의 파일 또는 최근 감지한 같은 스레드의 파일 ID를 사용하고, 사용자와 파일 권한을 재검사한다. 일반 채널 history 권한은 추가하지 않는다. 자동 감지와 멘션은 team/channel/thread/file 기준으로 준비 작업을 공유한다. 앱 재시작 전의 미감지 스레드는 원본 메시지 메뉴로 안내한다.

### Stage 6.3 이미지 갤러리 표시 보정

사용자가 여러 페이지 이미지를 한 행에서 가로로 넘기고 싶다고 요청했다. Slack July 2026 변경 내역의 단일 행 첨부와 공식 `chat.update.file_ids`를 대조하고 합성 PNG 묶음의 기존 댓글 추가·동일 ID 재전송을 실제 API에서 확인했다. 세로 Block Kit 이미지 블록 대신 같은 댓글의 native 이미지 첨부를 사용한다. Slack macOS 실측은 일부 썸네일과 `+N`, 클릭 후 내부 미디어 뷰어의 좌우 화살표이며 메시지 내부 가로 스크롤을 제공한다고 주장하지 않는다. 추가 이미지의 페이지 순서를 유지하기 위해 중간 업로드가 실패하면 뒤 페이지의 공유를 보류하고 재시도 때 순서대로 추가한다. 일반 채널 history 권한은 사용하지 않는다. 공식 근거: https://docs.slack.dev/reference/methods/chat.update/ 및 https://slack.com/help/articles/115004846068-Slack-updates-and-changes .

사용자가 후속 선택에서 “Slack 기본 이미지 갤러리로 적용”을 명시적으로 승인했다. 메시지 내부의 가로 스크롤과 Slack 기본 갤러리를 구별한 안내 후 현재 구현을 확정했다.


## Stage 6.4 — rhwp 로고와 편집 카드 안내 (2026-09-16, 승인됨)

사용자의 로고 지정·추천 카드 구성 적용·별도 안내 제거·추가 페이지 버튼 문구 변경 지시를 구현과 실제 Slack 확인 승인으로 적용한다. 기존 issue #1/M010, local/task1을 유지한다.

- 사용자가 승인한 투명 여백 추가만 적용해 원본 픽셀을 보존한 정사각형 slack/rhwp-logo.png를 보관한다. Slack 앱 아이콘에 등록하고 카드도 기본 앱 아이콘을 상속한다. 별도 product_icon의 중복 배지는 사용하지 않는다.
- 카드의 display_type에 rhwp에서 편집 · 이 카드를 클릭하세요를 표시하고 별도 문서 편집 context는 제거한다. 실제 파일 카드에서 custom_fields 설명 줄은 표시되지 않아 보조 문구로 합친다. Slack 파일명이 제목보다 우선하는 제약을 유지하며 실제 카드 렌더를 검증한다.
- 버튼은 추가 페이지 이미지 보기 (최대 10페이지)로 변경한다. PDF 내부 열람 링크·파일 공유·접근 권한·편집/저장 로직은 그대로 유지한다.
- 문서 위치: 본 계획서, mydocs/orders/20260916.md, mydocs/working/task_m010_1_stage6.4.md 및 기존 README.md. 새 제품 문서 루트는 만들지 않는다.
- 검증: typecheck, 기존 Slack/security 검사, production host build와 원본 픽셀 보존, 실제 Slack 아이콘·카드 설명·PDF/Studio 진입 확인. 표시 변경이므로 엔진/변환 전체 및 Linux 전체 smoke는 반복하지 않는다.
- 원격 push·PR·이슈 종료는 포함하지 않는다.

## Stage 7~9 — 워크스페이스 내 다중 채널 운영 (2026-09-17 승인)

사용자 지시: 현재 UX를 유지하며 같은 워크스페이스의 다른 채널·다른 사용자도 사용할 수 있을 때까지 진행. 열린 #1 / M010의 내부 워크스페이스 MVP 범위이므로 기존 local/task1에서 이어간다. 기존 소스·편집기·실행 중 서버는 검증 완료 전 교체하지 않는다. 추가 비용·외부 계정 생성은 별도 결정이며 Marketplace/OAuth 외부 배포는 이번 범위가 아니다.

### Stage 7 — 문서 연결 영속화

- Node 24 내장 SQLite로 team 별 카드·수정본·업로드 영수증·채널 정책·처리 상태를 보관한다. 원본 bytes, 세션 토큰, 다운로드/업로드 인증 URL은 DB에 저장하지 않는다.
- 재시작/원본 캐시 만료 후 Slack 권한을 재검사하고 원본을 다시 내려받아 기존 카드에서 편집/이미지 추가를 지원한다. URL을 저장해 운영 origin 이전 후에도 이미 알려진 카드만 인정한다.
- 성공한 게시·업로드를 재실행하지 않고 중단 지점의 Slack 파일 공유를 확인한다. 불확실한 게시를 임의로 재게시하지 않는다.
- 예전 알 수 없는 카드/주소 요청을 실제 권한 거절과 구분하며 자동 갱신이 현재 문서에 오해를 주는 권한 메시지를 만들지 않게 한다.
- 검증: DB 재열기, 권한 철회, team/channel 격리, TTL 후 재다운로드, 중복 요청, 기존 Slack/security 테스트.

### Stage 8 — 채널 설정과 상태 반응

- App Home 및 /rhwp settings에서 지정 관리자만 채널별 auto/mention/off 정책을 설정한다. 기존 env 채널은 최초 DB 초기화 때 auto로 옮기며 신규 채널은 명시 활성화한다. 일반 사용자는 현재 채널에서 명시 요청을 실행한다.
- 관리자가 설정한 채널도 bot/user 참여·일반 공개/비공개·파일 공유 검증은 그대로 유지한다. 일반 대화 이력 scope를 추가하지 않는다.
- 원본 메시지에 hourglass_flowing_sand → white_check_mark 또는 warning. 메시지별 여러 파일 상태를 합산하고 재시작·중복 반응을 복구한다.
- 검증: 관리자 위조/비멤버/다른 team 거절, 모드 전환·재시작 보존, 자동+멘션 중복, 여러 파일/실패 상태.

### Stage 9 — 운영 연결과 실제 수용

- 운영 DB volume·restart 정책·고정 HTTPS 설정을 준비하고 도메인/호스팅 가용성을 확인한다. 미확정 비용을 임의 결제하지 않는다.
- Slack App Home/events/reactions scope 설정 후 재인증. 현재 채널 재현 및 사용자 지정 추가 채널에서 파일 처리·편집·스레드 저장 확인. 실제 다른 사용자 검증은 합성 actor 단위 테스트와 구분한다.
- README, docs/architecture.md, docs/development.md는 기존 공식 문서 위치를 유지한다. 계획/단계 증적/오늘할일은 기존 mydocs 경로를 사용한다.
- 검증: typecheck, test:slack, test:security, 전체 단위 테스트, production build, 필요 브라우저 회귀, 재시작 후 기존 카드 열기, 실제 Slack 다중 채널.
- 외부 환경이 준비되지 않은 항목은 구현 완료와 구분해 보고한다.


## Stage 10~12 — Google Cloud Run 전환 (2026-09-17 사용자 승인)

사용자가 “AI Pro의 실제 $10 혜택 연결 확인 → 기존 동작을 유지하며 저장·작업 처리 구조 변경 → 별도 Cloud Run 환경에서 비용과 동작 검증 → Slack 연결 전환을 진행해줘”라고 전체 순서의 진행을 명시했다. 같은 승인 범위의 로컬 구현·검증을 계속하고, 크레딧 적용·클라우드 인증·비용 조건이 확인되기 전 실제 유료 리소스나 운영 연결은 전환하지 않는다.

### Stage 10 — 저장·세션·작업 경계

- 기존 e17f86d 운영 checkout과 .env, DB, 터널을 유지한다. `codex/task1-cloud-run` 분리 worktree에서 후속 작업한다. 기존 Issue #1의 내부 운영·호스팅 후속 범위를 잇는다.
- 원본 HWP/HWPX, 수정본, PDF, PNG의 영구 보관처는 Slack으로 유지한다. Firestore와 Cloud Tasks에 문서 bytes·Slack bearer·인증 전송 URL을 저장하지 않는다.
- 비동기 메타데이터 저장 계약, SQLite 호환 adapter, Firestore adapter, 원자적 일회용 ticket 및 만료 세션, lease/CAS 경계를 먼저 독립 테스트한다.
- 작업 큐는 식별자만 영속화하고 다운로드·변환·업로드 전체를 작업 요청 수명 안에서 처리한다. 이벤트 접수와 긴 변환을 분리한다. 중복 요청과 응답 유실을 성공으로 추정하지 않는다.
- cloud backend 활성화 전 legacy 메모리 Map·checkpoint 전체 쓰기·detached promise·프로세스 시작 복구 경로를 정리한다. 저장소 adapter만 생긴 상태를 배포 가능으로 표시하지 않는다.

### Stage 11 — 별도 환경 검증

- 실제 AI Pro 계정의 월 $10 Cloud 혜택과 적용 결제 계정, 프로젝트, 지역을 확인한다.
- 최소 인스턴스 0, 변환 동시성 1, 인스턴스 상한, 요청/변환 시간·파일/페이지 제한을 명시한다. 콜드 스타트의 Slack 3초 응답과 실제 메모리·전송 비용을 검증한다.
- 운영과 분리된 서비스·Firestore namespace·task queue에서 합성 문서로 재시작/다중 인스턴스/ticket 1회 교환/중복 업로드 방지/권한 회수/문서 비영속 검증을 실행한다.
- 로컬 fake/emulator 결과를 실제 Google Cloud IAM·과금·콜드 스타트 검증과 구별한다.

### Stage 12 — 이전과 전환

- 기존 SQLite의 메타데이터만 검증 후 가져온다. 원래 카드 ID와 origin alias, 파일/스레드 연결·설정을 보존한다. 세션은 사용자가 카드에서 다시 열도록 한다.
- 원본 서버를 정지·재시작하거나 Slack 주소를 변경하기 전 별도 환경의 검증 근거와 복구 경로를 확보한다. 검증 완료 시 승인된 범위에서 Slack 주소·embed 도메인을 전환하고 업로드→카드→PDF/이미지→편집→같은 스레드 저장을 확인한다.
- Cloud 서비스/계정 인증이나 크레딧 확인이 막히면 기존 연결을 유지하고 완료/미완료를 구별한다.

### 문서 위치·검증·커밋

- 공식 배포/아키텍처 문서는 기존 `docs/development.md`, `docs/architecture.md`를 갱신한다. 신규 배포 안내가 필요하면 같은 공식 루트 `docs/cloud-run.md`를 사용한다. 대상 독자는 운영자, 대안 `mydocs/manual`은 제품 운영 문서 위치가 아니므로 사용하지 않는다.
- 단계 증적은 `mydocs/working/task_m010_1_stage10.md` 등, 일별 상태는 `mydocs/orders/20260917.md`에 남긴다.
- 자동 검증: typecheck, 기존 Slack/security regression, 저장·세션·작업 경계 테스트, 실제 변환 회귀. 클라우드 연결 이후 IAM·Firestore·Cloud Tasks 및 Slack 실제 수용 별도 검증.
- 단계별 소스와 보고서를 `Task #1 Stage 10: ...` 등으로 커밋한다. 최종 전환 전에는 완료 보고서·PR을 완료 상태로 만들지 않는다.
