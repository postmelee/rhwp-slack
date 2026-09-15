# Task #1 수행계획서 — Slack 내부 rhwp 뷰어와 `/rhwp` 명령어의 MVP 개발 기반

GitHub Issue: [#1](https://github.com/postmelee/rhwp-slack/issues/1)

마일스톤: [M010 — v0.1.0](https://github.com/postmelee/rhwp-slack/milestone/1)

작성일: 2026-09-15 (Asia/Seoul)

상태: 수행계획서 검토 대기. 이슈 등록 및 이 계획서 작성은 승인됨. 구현계획서·제품 소스는 아직 작성하지 않음.

## 목적

권한이 있는 사용자가 Slack에 공유된 평문 HWP/HWPX를 Slack 내부 rhwp 웹 뷰어에서 열고, 페이지를 이동하고 확대할 수 있게 한다. 사용자 명령어는 `/rhwp`로 통일한다.

이번 task는 C 방식(Work Objects embeds)의 실제 동작과 개발 기반을 먼저 완성한다. PDF, 썸네일, 전체/지정 페이지 PNG 변환과 B 방식(PDF 미리보기)은 같은 문서 서비스를 이용하는 후속 task로 남긴다. 제품 요구사항 전체는 이슈 #1에 보존되어 있다.

## 배경

- 신규 비공개 저장소에는 Hyper-Waterfall v0.3.0 한국어 운영 파일만 있다. 제품 소스와 README, CI는 아직 없다.
- 기준 브랜치는 `origin/devel`, 도입 커밋은 `f4343ad58fe8ad0e3f7d1384e2b5104843787911`이다. 작업 브랜치는 `local/task1`이다.
- 2026-09-15 사용자가 `M010` 생성, 승인된 초안의 이슈 등록, `task-start` 수행계획서 작성 진입을 승인했다.
- [Slack embeds](https://docs.slack.dev/messaging/work-objects-embeds/)는 앱이 올린 Work Object를 클릭할 때 `entity_details_requested`를 받고 `entity.presentDetails`로 iframe URL을 제공한다. 현재 자체 워크스페이스용 비배포 앱은 사용할 수 있으며 배포형 앱은 초대형 프로그램 대상이다.
- 같은 문서는 기본 iframe의 `Origin: null`과 인증·CSP·도메인 허용 목록 제약을 명시한다. 따라서 실제 Slack iframe 검증을 독립된 수용 기준으로 둔다.
- rhwp 소비자 문서에서 `@rhwp/core`의 `HwpDocument`, `pageCount`, `renderPageSvg`와 텍스트 폭 측정 callback을 확인했다. 로컬 엔진 문서는 현재 개발 소스이므로 정식 배포물의 같은 API와 동작은 Stage 1에서 다시 확인한다.
- npm registry에서 `@rhwp/core@0.8.6`의 존재를 확인했다. integrity는 `sha512-ZMO2QMHbR4v7t86feMWiRJ4QozjjqHDGv4PyzTT4LyMuX1LeUpmQaOHrGLQpbYMJV0IWCYjVRewKqkXx+w16XQ==`이다. upstream `v0.8.6` tag의 commit은 `f1f9c6ae58344ee9368996d3543f76b9345cf227`이다. 아직 이 task에 의존성을 설치하지 않았다.

## 범위

### 포함

- 단일 테스트 워크스페이스용 Slack 앱 manifest, 설정 예제, 개발 실행·테스트·CI 기반.
- `/rhwp open <문서 링크>`, `/rhwp help`, 메시지 바로가기 `한글 문서 열기`.
- 문서 링크/파일 식별, 파일이 여러 개인 메시지의 선택 UI, 명확한 실패 안내.
- Slack 서명 검증, 빠른 요청 접수, 비동기 파일 로딩, 중복 이벤트 처리.
- 파일 다운로드와 사용자 접근 권한 검사, 짧게 유지되는 뷰어 세션, 원본/세션 만료 처리.
- Work Object 카드와 `entity_details_requested` → `entity.presentDetails` 연결.
- `@rhwp/core`를 직접 쓰는 읽기 전용 웹 뷰어. 확대·축소, 1-based 페이지 이동, 로딩·오류 상태.
- WASM·글꼴을 앱 소유 경로에서 제공하고 실제 문서/iframe으로 검증.
- 개발자 문서와 task별 실행 근거, 최종 수용 기준 및 미검증 범위 기록.

### 제외

- PDF/PNG 변환 worker의 완성 구현, ZIP 생성, B 방식 PDF 미리보기. 이번 구현에서 변환 완료나 사용 가능으로 표시하지 않는다.
- 원본 편집·저장, OCR, LLM 요약, 암호 문서 입력 UI.
- 자동 전 채널 감시, Slack Connect 지원 보장, 조직 전체 배포·Marketplace 공개 배포.
- 유료 인프라 구매, 기존 rhwp 엔진 저장소 수정, 공개 데모 서버로 사용자 문서 전송.
- 실제 Slack 실행 없이 C 방식 전체 완료 선언.

## 설계 방향

### 실행 구성

- TypeScript로 Slack 서버와 웹 뷰어를 구성한다. 서버는 Node.js 24와 Slack Bolt, 프런트는 Vite 및 `@rhwp/core`를 우선 선택한다. 나머지 패키지의 호환 버전과 lockfile은 구현계획서에서 확정한다.
- 한 저장소 안의 `src/server/`, `src/viewer/`, `src/shared/`로 책임을 나눈다. 첫 버전은 단일 서버 인스턴스로 실행하고 문서 상태는 서버의 비공개 저장소에서 관리한다. 다중 인스턴스·분산 작업 큐는 이번 task의 필수 범위가 아니다.
- rhwp 파서와 조판을 새로 구현하지 않는다. `@rhwp/core@0.8.6`을 고정 후보로 사용하고, 배포물의 기능 부족이 발견되면 증거와 함께 버전 변경을 계획에 반영한다. `latest`와 무고정 외부 CDN은 사용하지 않는다.
- `@rhwp/editor`의 중첩 iframe 경로 대신 core를 직접 사용한다. 현재 editor 문서의 opaque-origin 거부 제약과 Slack 기본 sandbox의 충돌을 피하고, 필요한 읽기 UI를 얇게 구현하기 위한 선택이다.
- 폰트는 배포 가능한 Noto 계열을 앱에 고정하고 라이선스 정보를 포함한다. 실제 폰트 파일·해시·로딩 완료와 텍스트 폭 측정 callback을 함께 관리한다. 시스템 한컴 폰트와 완전히 같은 결과를 가정하지 않는다.
- 화면에는 현재 페이지부터 렌더링하고 문서 교체 시 이전 WASM 문서 객체와 리소스를 해제한다. 문서 크기·페이지 수·로딩 시간 한도는 구현계획서에서 구체화한다.

### Slack 진입과 파일 선택

- `/rhwp open`은 명시적인 문서 링크를 받는다. 처음에는 검증된 Slack 파일 permalink를 지원하고, 메시지 링크는 메시지 조회 권한과 API 범위를 확정한 경우에만 지원한다. 임의 외부 URL은 다운로드하지 않는다.
- 메시지 바로가기는 선택된 메시지의 파일을 사용한다. 여러 HWP/HWPX가 있으면 사용자가 선택한다. Slack 이벤트의 타임스탬프를 원본 메시지 번호로 추정하지 않는다.
- 채널의 기존 HWP 첨부 카드 교체를 시도하지 않고 앱 소유의 Work Object 카드를 게시한다. 해당 문서와 요청을 연결하는 내부 식별자를 유지한다.
- HTTP 요청에는 3초 이내 접수 응답하고 파일 다운로드·문서 준비는 별도로 처리한다. 이벤트 재전송과 같은 문서 요청의 변환 캐시를 서로 다른 개념으로 관리한다.
- 현재 지원하지 않는 `pdf`, `thumbnail`, `png`에는 사용 가능으로 오인할 수 있는 결과를 반환하지 않는다. 후속 task에서 같은 명령 디스패처와 문서 식별 경계를 확장한다.

### 접근 권한과 iframe

- 서버가 Slack 서명과 타임스탬프를 검증한 요청에서만 사용자·워크스페이스 식별자를 신뢰한다. 브라우저가 보내는 사용자 ID나 URL 서명만으로 Slack 사용자 본인임을 인정하지 않는다.
- bot이 파일을 읽을 수 있다는 사실과 클릭한 사용자가 읽을 수 있다는 사실을 분리한다. 첫 버전은 실제 공유 채널, 요청자의 현재 참여 상태, 파일의 공유 제한을 확인할 수 있는 경우를 대상으로 한다. 권한 증명이 불완전한 DM·Slack Connect·제한 공유는 거절한다.
- 정확한 scope와 페이지네이션·권한 취소 동작은 구현계획서와 API 계약 테스트에서 확정한다. 이 검증이 없는 동안 mock 통과를 실제 Slack 권한 보장으로 기록하지 않는다.
- 문서별·워크스페이스별 식별자와 짧은 만료를 가진 서버 발급 세션을 사용한다. 세션은 재발급 시 Slack 사용자 권한을 다시 확인하고 원본/문서 자산의 각 요청에서도 유효성을 검증한다.
- 만료 URL은 소지자에게 접근을 부여하는 값이므로 사용자 ID를 넣는 것만으로 복사·재사용을 차단한다고 주장하지 않는다. 일회성 교환과 짧은 세션, 로그 마스킹·Referrer 제한을 검증하고 남는 재사용 위험을 기록한다.
- 기본 `Origin: null`에서 동작하도록 자산을 요청한다. CORS의 origin만으로 인증하지 않으며, 자격 정보가 필요한 문서 API에는 유효한 세션을 요구한다. 실제 sandbox 안에서 WASM·폰트·문서 fetch를 확인한다.
- 문서 렌더 SVG의 삽입 경로를 검토해 문서에서 유래한 script·이벤트 속성·외부 리소스 요청을 실행하지 않도록 한다. 악성 입력 검증과 정상 이미지·표 표시 검증을 함께 수행한다.

### 호스팅과 후속 변환

- 로컬 개발과 Linux 컨테이너 실행을 기본으로 한다. 실제 Slack 연결에는 별도의 HTTPS 주소와 테스트 앱 설정이 필요하다. 공급자 계약·구매·공개 배포는 이 task에서 하지 않는다.
- 후속 변환 task는 같은 원본 문서와 접근 권한 서비스를 사용하며, 캐시 키는 원본 내용·rhwp 버전·폰트·출력 옵션을 포함한다.
- 사용자 페이지 번호는 모든 UI와 명령에서 1-based로 유지하고 엔진 경계에서 0-based로 변환한다.
- 후속 기능은 `/rhwp pdf`, `/rhwp thumbnail`, `/rhwp png`, `/rhwp png --page N`. 전체 PNG의 ZIP·첫 페이지 미리보기·페이지 수·파일명 계약은 이슈 #1의 합의 사항을 따른다.

## 문서 위치 판단

공식 문서 루트는 `docs/`로 제안한다. 아래 문서들은 계획 승인 후 구현 단계에서 작성하며 현재는 생성하지 않는다.

| 파일 | 분류 | 대상 독자 | 선택 위치 | 대안 위치 | 선택 이유 |
| --- | --- | --- | --- | --- | --- |
| README | 공식 제품 진입 문서 | 사용자·개발자 | `README.md` | GitHub Wiki | 저장소에서 지원 범위와 실행 진입점을 바로 확인 |
| 개발·Slack 설정 | 공식 개발 문서 | 앱 운영자·기여자 | `docs/development.md` | `mydocs/manual/` | 제품 실행 안내이며 Hyper-Waterfall 운영 절차가 아님 |
| 아키텍처·접근 권한 | 공식 설계 문서 | 유지보수자·통합자 | `docs/architecture.md` | `adr/` | 첫 버전의 책임 경계와 접근 계약을 코드 옆에서 검토 |
| 엔진·폰트 출처 | 공식 의존성 안내 | 유지보수자·배포 담당자 | `docs/dependencies.md` | README 본문 | 버전·라이선스·해시와 재현 절차를 분리 |
| task 산출물 | 내부 작업 기억 | 작업지시자·에이전트 | `mydocs/plans/`, `mydocs/working/`, `mydocs/report/`, `mydocs/orders/` | `docs/` | 제품 계약과 진행/검증 기록을 구분 |

## 예상 변경 파일

신규:

- `package.json`, `package-lock.json`, `tsconfig.json`, `vite.config.ts`, `.gitignore`, `.env.example`.
- `src/server/`, `src/viewer/`, `src/shared/`, `public/fonts/` 내 기능별 파일.
- `slack/manifest.json`, `scripts/`, `tests/`, `.github/workflows/ci.yml`, `Dockerfile`, `.dockerignore`.
- `README.md`, `docs/development.md`, `docs/architecture.md`, `docs/dependencies.md`.

수정:

- `AGENTS.md`의 프로젝트 고유 규칙·필수 문서 섹션: 실제 확정된 실행/검증·공식 문서 참조만 반영. Hyper-Waterfall 매뉴얼과 Skill 본문은 변경하지 않는다.

이번 task 산출물:

- `mydocs/orders/20260915.md`.
- `mydocs/plans/task_m010_1.md` 및 승인 후 `mydocs/plans/task_m010_1_impl.md`.
- `mydocs/working/task_m010_1_stage1.md` ~ `task_m010_1_stage4.md`.
- `mydocs/report/task_m010_1_report.md`.

## 잠정 단계

- **Stage 1 — 개발 기반과 실제 rhwp 뷰어**
  - TypeScript/Vite/Node 기반, 고정 엔진·폰트, 로컬 문서 읽기와 페이지/확대 UI, 기본 테스트·CI.
  - 실제 HWP/HWPX가 core 배포물로 열리는지와 Slack과 같은 opaque-origin iframe에서 WASM·폰트가 로드되는지 검증.
- **Stage 2 — Slack 명령과 문서 접근**
  - `/rhwp open`, `/rhwp help`, 메시지 바로가기, 파일 선택·다운로드·권한 검사, 비동기 처리와 중복 억제.
  - 인증 실패, 접근 불가, 파일 다중 선택, 재시도·rate limit·다운로드 제한을 검증.
- **Stage 3 — Work Objects와 뷰어 세션 연결**
  - 문서 카드, 클릭 이벤트, 상세 응답, 문서별 세션·자산 전달, 만료 처리와 오류 UI.
  - 실제 Slack C 경로, 다른 사용자/워크스페이스·만료 요청과 문서 자산 노출 여부 검증.
- **Stage 4 — 통합 검증과 인계**
  - Linux 실행 재현, 개발·아키텍처·의존성 문서, 샘플별 시각 확인, 최종 증거·미검증 목록.
  - 전체 사용자 여정과 원본/세션 정리 검증. 후속 PDF/PNG task의 계약과 준비 상태 확인.

각 Stage는 구현·검증·보고·커밋으로 마무리하고 다음 Stage 진입 승인을 받는다.

## 검증 계획

아래 명령은 구현 이후 제공할 검증 인터페이스 제안이며, 현재 존재하거나 실행해 통과한 테스트가 아니다. 정확한 스크립트와 도구 버전은 구현계획서에서 확정한다.

### 단계별 검증

| 단계 | 예정 검증 | 독립적인 판정 근거 |
| --- | --- | --- |
| Stage 1 | `npm ci`, `npm run typecheck`, `npm test`, `npm run build`, `npm run test:viewer` | 실제 엔진·폰트 로딩, 문서의 알려진 페이지 내용·화면과 페이지 이동, opaque-origin fixture |
| Stage 2 | `npm run test:slack`, `npm run test:security` | 공식 Slack 요청 형식, 정상/변조된 서명, 서로 다른 사용자·채널 접근 fixtures, 중복 요청 |
| Stage 3 | `npm run test:viewer`, `npm run test:security`, 테스트 앱 수동 시나리오 | 실제 Slack 카드 클릭→iframe, CORS/CSP·만료·권한 취소, 재사용 토큰 거절 범위 |
| Stage 4 | `npm run check`, `docker build`, Slack 웹·데스크톱 수동 확인 | 고정 의존성으로 재빌드, 같은 샘플/페이지의 시각 대조, 로컬과 실제 연동 결과 구분 |

- 샘플은 공유 가능한 문서만 쓰고 원본 SHA·출처·기대 페이지/내용을 기록한다. 사용자 업무 문서를 Git에 커밋하지 않는다.
- UI screenshot은 실제 문서 영역·표·텍스트를 직접 확인한다. 페이지 수·빈 화면 없는지만으로 시각 통과를 선언하지 않는다.
- 엔진에서 이미 발생하는 조판 차이와 앱이 추가한 자산/폰트/크기 오류를 구분한다. 검증 샘플 밖의 한컴 출력 정합성을 일반화하지 않는다.
- `--page` 변환 명령은 후속 task에서 검증하고, 이번 task에서는 뷰어 페이지 입력의 1-based/엔진 0-based 경계와 범위를 검증한다.

### 통합 검증

1. 권한 있는 사용자가 평문 HWP와 HWPX를 명령어 및 바로가기로 열고, Slack 안에서 페이지 이동·확대를 수행한다.
2. 권한 없는 요청, 다른 워크스페이스, 만료·변조 세션은 원본과 문서 자산을 받지 못한다.
3. 여러 파일, 손상·미지원 파일, 다운로드 실패는 선택/오류 화면으로 종료되며 성공으로 표시되지 않는다.
4. 재전송 이벤트가 문서 카드와 작업을 중복 생성하지 않는다.
5. 원본·임시 파일·세션이 정해진 만료 정책으로 정리되고 비밀값·내용이 로그에 남지 않는다.
6. 실제 Slack 실행 환경이 없으면 독립 개발·테스트를 계속하되 C 전체 수용은 미검증이다. 배포형 앱/모바일/Slack Connect의 미검증 여부를 별도로 명시한다.
7. PR 준비 전 `git status --short`는 빈 출력이고 `git diff --check`가 통과한다. 검증한 앱·엔진 SHA, 명령, 실행 환경, 근거와 미실행 항목을 최종 보고서에 기록한다.

### 수행계획서 자체 검증

- 중앙 템플릿의 모든 필수 섹션, 4개 Stage, 문서 위치 판단, 승인 범위와 후속 요구사항 참조를 확인한다.
- 이슈 #1의 OPEN/M010/enhancement/postmelee 설정과 오늘할일 연결을 확인한다.
- 계획서와 오늘할일만 로컬 커밋하고 이 단계에서 제품 소스·구현계획서·원격 PR은 만들지 않는다.

## 리스크

- **Slack 실행 환경**: 테스트 워크스페이스·앱 자격 증명·HTTPS 주소가 아직 제공되지 않았다. 필요한 시점에 설정 경로를 안내하고 비밀값은 로컬 환경변수로 받는다. 로컬 개발 검증과 Slack 실동작 검증을 분리한다.
- **embeds 지원 조건**: 배포형 앱은 현재 초대형 조건이다. 자체 워크스페이스에서 검증하고 공개 배포 조건은 별도 판단한다.
- **권한 API의 한계**: bot의 파일 접근과 요청자 권한은 다르다. 공유 제한·멤버십을 입증하지 못하는 경로는 실패로 처리하며 임의의 권한 확대를 하지 않는다.
- **iframe 호환성**: opaque origin에서 WASM·폰트·SVG·fetch가 다르게 동작할 수 있다. Stage 1에서 최소 실제 엔진을 먼저 검증하고 Stage 3에서 Slack에 연결한다.
- **폰트·문서 품질**: 대체 폰트와 엔진 차이로 줄바꿈·표 위치가 달라질 수 있다. 고정 샘플과 알려진 출력 기준으로 앱 회귀를 확인하고 미지원 문서를 구분한다.
- **성능·리소스**: 큰 문서는 첫 페이지에도 전체 파싱 비용이 들 수 있다. 크기·시간 한도와 취소/정리를 검증하고 실측 없이 응답 시간 SLA를 약속하지 않는다.
- **단일 인스턴스**: 재시작·다중 인스턴스까지 자동 복구된다고 주장하지 않는다. 상태 보존 방식과 실패 복구 범위는 구현계획서에 명시한다.

## 승인 요청 사항

1. 이번 task는 C 방식 뷰어와 `/rhwp open`, `/rhwp help`, 메시지 바로가기에 집중하고 PDF/PNG 완성은 후속 task로 둔다.
2. TypeScript + Slack Bolt + Vite + 직접 사용하는 `@rhwp/core@0.8.6`을 우선 구성으로 선택한다.
3. 공식 제품 문서는 `README.md`와 `docs/`에 두고 작업 기억은 `mydocs/`에 유지한다.
4. 위 4개 Stage와 실제 Slack 실행을 포함하는 수용 기준을 따른다.

승인되면 `task_m010_1_impl.md`에서 정확한 의존성·파일별 산출물·권한 계약·한도·검증 명령·커밋 메시지를 구체화한다.
