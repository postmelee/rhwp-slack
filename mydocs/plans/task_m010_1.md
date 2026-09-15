# Task #1 수행계획서 — Slack 내부 rhwp-studio 편집기와 `/rhwp` 명령어의 MVP 개발 기반

GitHub Issue: [#1](https://github.com/postmelee/rhwp-slack/issues/1)

마일스톤: [M010 — v0.1.0](https://github.com/postmelee/rhwp-slack/milestone/1)

작성일: 2026-09-15 (Asia/Seoul)

상태: Stage 1·2 완료. 사용자의 PDF 기본 열람·Studio 편집 분리 변경 승인으로 Stage 3을 구현한다.

## 목적

권한이 있는 사용자가 Slack에 공유된 평문 HWP/HWPX를 PDF로 보고, 편집을 선택하면 자체 호스팅 rhwp-studio에서 기존 메뉴·도구막대로 편집할 수 있게 한다. 복구본·최근 문서·이전 문서 기록은 영속화하지 않고 현재 편집의 undo/redo·미저장 상태는 유지한다. 편집본은 명시적인 동작으로 원래 Slack 대화에 새 파일로 저장한다. 사용자 명령어는 `/rhwp`로 통일한다.

이번 task는 C 방식(Work Objects embeds)의 실제 동작과 개발 기반을 먼저 완성한다. PDF 변환과 기본 PDF 미리보기는 이번 task에 포함한다. 썸네일·전체/지정 PNG·ZIP은 같은 문서 서비스를 이용하는 후속 task로 남긴다. 제품 요구사항 전체는 이슈 #1에 보존되어 있다.

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
- `/rhwp open <문서 링크>`, `/rhwp pdf <문서 링크>`, `/rhwp edit <문서 링크>`, `/rhwp help`, 메시지 바로가기 `한글 문서 열기`.
- 문서 링크/파일 식별, 파일이 여러 개인 메시지의 선택 UI, 명확한 실패 안내.
- Slack 서명 검증, 빠른 요청 접수, 비동기 파일 로딩, 중복 이벤트 처리.
- 파일 다운로드와 사용자 접근 권한 검사, 짧게 유지되는 뷰어 세션, 원본/세션 만료 처리.
- Work Object 카드와 `entity_details_requested` → `entity.presentDetails` 연결.
- `@rhwp/editor@0.8.6` SDK와 자체 호스팅 Studio v0.8.6의 편집 UI. 복구·자동 저장·최근 문서·문서 이력의 영속 저장 비활성화.
- 편집본 HWP/HWPX export와 명시적 Slack 새 파일 저장, 성공한 저장에 대해서만 `notifySaved`.
- WASM·글꼴을 앱 소유 경로에서 제공하고 실제 문서/iframe으로 검증.
- 개발자 문서와 task별 실행 근거, 최종 수용 기준 및 미검증 범위 기록.

### 제외

- PNG 변환과 ZIP 생성. 미구현 기능을 사용 가능으로 표시하지 않는다.
- Slack 원본 파일의 자동 덮어쓰기, 동시 협업 편집, OCR, LLM 요약, 암호 문서 입력 UI.
- 자동 전 채널 감시, Slack Connect 지원 보장, 조직 전체 배포·Marketplace 공개 배포.
- 유료 인프라 구매, 기존 rhwp 엔진 저장소 수정, 공개 데모 서버로 사용자 문서 전송.
- 실제 Slack 실행 없이 C 방식 전체 완료 선언.

## 설계 방향

### 실행 구성

- 호스트 TypeScript/Vite 화면은 Slack 문서 세션과 저장을 연결하는 역할만 맡고, 메뉴·편집·렌더링 UI는 `@rhwp/editor@0.8.6`으로 자체 호스팅한 rhwp-studio를 임베드한다.
- Studio source는 upstream v0.8.6 commit `f1f9c6ae58344ee9368996d3543f76b9345cf227`로 고정한다. 원본 rhwp 작업 디렉터리를 수정하지 않고 이 앱의 빌드 overlay로 문서 수명주기 정책을 적용한다.
- `chrome=embed`를 강제하고 복구 창·자동 저장·최근 문서·문서 이력의 영속 저장을 비활성화한다. 폰트/테마 등 문서 내용이 없는 사용자 설정은 별개다. undo/redo와 실제 저장 전 dirty 상태는 유지한다.
- 초기 문서는 인증된 호스트에서만 전달한다. Studio의 URL 로드·로컬 새 문서·파일 열기·인쇄·로컬 저장 진입은 호스트가 통제하고, 편집 기능 자체는 재사용한다.
- Studio 번들·WASM·배포 가능한 폰트는 앱이 제공한다. 외부 웹 폰트·PWA/service worker 등록은 Slack 빌드에서 끈다.
- 기존 worker 뷰어의 강제 종료 보장은 Studio로 승계하지 않는다. SDK 응답 timeout은 동기 WASM 실행의 강제 중단이나 메모리 상한이 아니다. 소스 byte 상한과 파싱 후 페이지 상한을 별도로 확인한다.

### Slack 진입과 파일 선택

- `/rhwp open`은 명시적인 문서 링크를 받는다. 처음에는 검증된 Slack 파일 permalink를 지원하고, 메시지 링크는 메시지 조회 권한과 API 범위를 확정한 경우에만 지원한다. 임의 외부 URL은 다운로드하지 않는다.
- 메시지 바로가기는 선택된 메시지의 파일을 사용한다. 여러 HWP/HWPX가 있으면 사용자가 선택한다. Slack 이벤트의 타임스탬프를 원본 메시지 번호로 추정하지 않는다.
- 채널의 기존 HWP 첨부 카드 교체를 시도하지 않고 앱 소유의 Work Object 카드를 게시한다. 해당 문서와 요청을 연결하는 내부 식별자를 유지한다.
- HTTP 요청에는 3초 이내 접수 응답하고 파일 다운로드·문서 준비는 별도로 처리한다. 이벤트 재전송과 같은 문서 요청의 변환 캐시를 서로 다른 개념으로 관리한다.
- 현재 지원하지 않는 `thumbnail`, `png`에는 사용 가능으로 오인할 수 있는 결과를 반환하지 않는다. 후속 task에서 같은 명령 디스패처와 문서 식별 경계를 확장한다.

### 접근 권한과 iframe

- 서버가 Slack 서명과 타임스탬프를 검증한 요청에서만 사용자·워크스페이스 식별자를 신뢰한다. 브라우저가 보내는 사용자 ID나 URL 서명만으로 Slack 사용자 본인임을 인정하지 않는다.
- bot이 파일을 읽을 수 있다는 사실과 클릭한 사용자가 읽을 수 있다는 사실을 분리한다. 첫 버전은 실제 공유 채널, 요청자의 현재 참여 상태, 파일의 공유 제한을 확인할 수 있는 경우를 대상으로 한다. 권한 증명이 불완전한 DM·Slack Connect·제한 공유는 거절한다.
- 정확한 scope와 페이지네이션·권한 취소 동작은 구현계획서와 API 계약 테스트에서 확정한다. 이 검증이 없는 동안 mock 통과를 실제 Slack 권한 보장으로 기록하지 않는다.
- 문서별·워크스페이스별 식별자와 짧은 만료를 가진 서버 발급 세션을 사용한다. 세션은 재발급 시 Slack 사용자 권한을 다시 확인하고 원본/문서 자산의 각 요청에서도 유효성을 검증한다.
- 만료 URL은 소지자에게 접근을 부여하는 값이므로 사용자 ID를 넣는 것만으로 복사·재사용을 차단한다고 주장하지 않는다. 일회성 교환과 짧은 세션, 로그 마스킹·Referrer 제한을 검증하고 남는 재사용 위험을 기록한다.
- Slack Work Objects의 `allow-same-origin`을 활성화한다. Slack → 앱 호스트 → Studio의 중첩 iframe과 SDK origin·source 검증을 확인한다. 문서 API는 여전히 bearer 세션을 요구하며 쿠키나 origin만으로 인증하지 않는다.
- Studio가 제공하는 렌더 경로와 CSP를 검증한다. 외부 문서 리소스를 CSP로 제한하고 정상 이미지·표 표시와 무허가 외부 요청 부재를 함께 확인한다. 이전 뷰어 sanitizer 테스트는 Studio 통과 근거로 승격하지 않는다.

### 호스팅과 후속 변환

- 로컬 개발과 Linux 컨테이너 실행을 기본으로 한다. 실제 Slack 연결에는 별도의 HTTPS 주소와 테스트 앱 설정이 필요하다. 공급자 계약·구매·공개 배포는 이 task에서 하지 않는다.
- 후속 변환 task는 같은 원본 문서와 접근 권한 서비스를 사용하며, 캐시 키는 원본 내용·rhwp 버전·폰트·출력 옵션을 포함한다.
- 사용자 페이지 번호는 모든 UI와 명령에서 1-based로 유지하고 엔진 경계에서 0-based로 변환한다.
- 후속 기능은 `/rhwp thumbnail`, `/rhwp png`, `/rhwp png --page N`. 전체 PNG의 ZIP·첫 페이지 미리보기·페이지 수·파일명 계약은 이슈 #1의 합의 사항을 따른다.

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
- `src/server/`, `src/viewer/`, `src/editor/`, `src/conversion/`, `src/shared/`, `public/fonts/` 내 기능별 파일.
- `slack/manifest.json`, `scripts/`, `tests/`, `.github/workflows/ci.yml`, `Dockerfile`, `.dockerignore`.
- `README.md`, `docs/development.md`, `docs/architecture.md`, `docs/dependencies.md`.

수정:

- `AGENTS.md`의 프로젝트 고유 규칙·필수 문서 섹션: 실제 확정된 실행/검증·공식 문서 참조만 반영. Hyper-Waterfall 매뉴얼과 Skill 본문은 변경하지 않는다.

이번 task 산출물:

- `mydocs/orders/20260915.md`.
- `mydocs/plans/task_m010_1.md` 및 승인 후 `mydocs/plans/task_m010_1_impl.md`.
- `mydocs/working/task_m010_1_stage1.md` ~ `task_m010_1_stage4.md`.
- `mydocs/report/task_m010_1_report.md`.

## 변경 후 단계

1. **Stage 1 — 초기 core 뷰어**: `62ab907`에 완료한 역사적 검증. Studio 검증으로 간주하지 않는다.
2. **Stage 2 — Studio 전환**: 전체 편집 UI 임베드, 고정 자체 호스팅, 복구·문서 기록 비활성, 편집·undo/redo·export 검증. 사용자의 이번 변경 지시로 진입 승인됨.
3. **Stage 3 — PDF 기본 열람·편집 분리**: 실제 PDF 변환과 viewer/editor 분리, 작은 편집 상태 영역, 개발 환경 검증.
4. **Stage 4 — Slack 명령과 문서 접근**: `/rhwp open`, `pdf`, `edit`, `help`, 메시지 바로가기, 권한·파일 선택·다운로드·중복 처리.
5. **Stage 5 — Work Objects·편집본 저장**: 세션과 실제 Slack 내부 편집, 새 파일 저장, 저장 확인·권한 취소·만료.
6. **Stage 6 — Linux·통합 검증**: 재현 가능한 컨테이너, 실제 Slack 웹·데스크톱, 인계·PDF 및 후속 PNG 계약.

각 Stage는 구현·검증·보고·커밋으로 마무리하고 다음 Stage 진입 승인을 받는다. 이 변경은 이전 Stage 결과의 소급 수정이 아니다.

## 검증 계획

- Studio를 `allow-scripts allow-same-origin` iframe에 임베드하여 실제 문서 열기·편집·서식·표·undo/redo·export 재열기를 확인한다.
- 이전 복구본·최근 목록이 이미 있는 경우에도 복구 UI가 나오지 않고 해당 문서를 읽지 않음을 확인한다. 편집 뒤 자동 저장 시간이 지나거나 창을 다시 열어도 새 문서 데이터가 IndexedDB/localStorage/Cache Storage에 남지 않음을 검증한다.
- 설정 UI로 자동 저장을 다시 켜도 Slack 빌드의 금지 정책을 우회하지 못해야 한다. 미저장 경고를 없애려고 `notifySaved`를 거짓 호출하지 않는다.
- Studio 요청의 origin/source/세션과 문서의 실제 접근 권한을 확인한다. SDK 실패·큰 파일·손상 파일은 명확히 실패하며 이전 문서와 현재 대상이 섞이지 않는다.
- 편집본 저장은 현재 사용자·채널·원본 접근을 재검증하고, 원래 채널/스레드에 새 파일로 업로드한 완료 응답 이후에만 해당 export revision을 저장됨으로 인정한다. 저장 중 추가 편집은 dirty로 남긴다.
- 실제 Slack 실행과 로컬 iframe, Linux CI는 별도로 판정한다. 프린트·파일 시스템·클립보드의 모든 브라우저 기능이 Slack에서 같다고 보장하지 않는다.
- 검증 소스·엔진 버전·명령·실패·미검증 범위를 단계 보고서에 기록한다.

## 리스크

- 실제 Slack 앱 자격 증명·HTTPS 주소는 아직 없다. Studio 전환은 로컬에서 먼저 검증한다.
- 불투명 origin을 유지한 기존 SDK 연결은 지원하지 않는다. Slack 설정에서 allow-same-origin이 준비되어야 실제 통합이 가능하다.
- 임베드 화면을 닫으면 복구를 비활성화한 미저장 편집은 잃을 수 있다. 현재 작업의 미저장 표시와 명시적 저장을 제공한다.
- Studio 동기 조판의 하드 timeout은 미지원이며 기존 worker 결과로 보장하지 않는다.
- Stage 1에서 확인한 HWPX inline 이미지 누락과 형식 간 위치 차이를 Studio 경로에서 다시 검증한다. core SVG 결과를 Canvas 출력에 그대로 적용하지 않는다.
- 외부 SDK 기본 데모에 문서를 전송하지 않는다. 고정 소스 overlay는 upstream 업데이트 시 재검토해야 한다.

## 변경 승인 기록

사용자가 2026-09-15 “변경해줘”라고 명시하여 Studio 전체 UI 재사용, 복구 비활성화, 자체 호스팅 및 계획 변경·전환 구현을 승인했다. 기존 Stage 1은 보존하고 Stage 2를 수행한다. Slack 업로드·실제 앱 연결은 해당 단계에서 검증·승인한다.

## PDF 기본 열람 변경 승인

사용자의 “그렇게 진행하고 싶어”를 PDF 기본 열람·Studio 편집 전용 진입 및 상단 축소의 계획 변경과 Stage 3 구현 승인으로 적용한다. 완료된 Stage 1·2는 보존한다. `/rhwp open`/`pdf`는 PDF, `/rhwp edit`와 “문서 편집”은 Studio로 연결한다. 원본 자동 덮어쓰기는 하지 않고 새 편집본 저장 후 해당 revision PDF를 생성한다. Stage 4는 Slack 명령·권한, Stage 5는 Work Objects·저장·PDF 재생성, Stage 6은 Linux·실제 Slack 통합 검증으로 이어진다.
