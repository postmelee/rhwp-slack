# Task #16 Stage 4 — 후보 구성과 로컬 수용

## 준비한 구성

기존 Cloud Run main과 별도로 distributed 번들을 빌드하고 비밀값 없는 warm-code 실행을 확인했다. 베타 manifest 생성기는 내부 embeds 이벤트를 제외하고 OAuth/OpenID callback과 설치 폐기 이벤트를 구성한다. bootstrap은 권한 부여 없이 앱 정의만 만든다. 운영자 설정과 실제 수용·복구 절차는 기존 공식 문서 루트의 `docs/external-beta.md`에 둔다.

2026-09-20 읽기 전용 확인에서 현재 GCP 프로젝트에는 rhwp-ingress/rhwp-worker만 있었다. 새 서비스·큐·비밀값·공개 호출 권한은 아직 생성하지 않았다. Chrome에서 rhwp beta 앱 정의를 입력하고 생성 검토 화면(권한 0개)까지 준비했으며 새 인증정보 생성 승인을 기다린다. Marketplace 약관 동의나 기존 앱 설정 변경은 하지 않았다.

## 로컬 검증

- Node 24.21.0, 실제 npm 11.12.1. package engines의 npm 11.19.0과 차이가 있어 설치 시 경고가 있었으며 CI 결과와 구분한다.
- typecheck, unit 9, Slack 86, security 50 통과.
- test:viewer: 25개 시나리오 통과. 기존 upstream 혼합 서식 undo 테스트는 선언된 expected failure이며 이번 작업에서 완화하지 않았다. 변환 9개 통과.
- 외부 browser workspace 헤더·fragment 제거 시나리오를 startup suite에 추가했다. 실제 Slack OIDC 서버 대신 로컬 API 응답을 사용한다.
- main/distributed esbuild 번들 생성 및 distributed --warm-code 통과.

## 남은 수용

Linux CI와 별도 후보 배포·API 경계 검증은 아래와 같이 완료했다. 두 workspace OAuth 설치, 다른 실제 사용자 편집·동일 스레드 저장, 설치 삭제/재설치, 초기 응답 시간과 비용 검증은 아직 미완료다. 본 구현을 공개 베타 완료로 표시하거나 운영 Slack URL을 전환하지 않는다.


## 2026-09-20 후보 배포 진행 기록

- 소스 `b84c1a5609dc39f6d9be52d8d938e536403aba57`, push/PR Linux CI 각각 viewer·container 통과(35481981833, 35481983883).
- 별도 Slack 앱 `A0C329NJ85C`(rhwp beta)를 생성했다. 사용자 승인으로 Client Secret·Signing Secret·설치 토큰 암호화 키를 Secret Manager에 저장하고 베타 서비스 계정에 runtime 읽기 권한을 부여했다. 원문은 Git·보고서에 기록하지 않았다.
- 별도 큐 `rhwp-beta`, Cloud Run `rhwp-beta-ingress`/`rhwp-beta-worker`, Pages `rhwp-slack-beta-editor`를 생성했다. ingress 1 CPU/1GiB·worker 2 CPU/4GiB, 둘 다 최소0·최대1, 큐 동시 실행1. 기존 프로젝트 예산을 변경하지 않았다.
- Cloud Build `c3ba10b3-fcaa-45d6-ac7f-f64c8af00dd1` 성공. 이미지 digest `sha256:e57037796731fd6bcbd4b0417e55fd9859afab079a5e469f473f78b9b2f45be2`로 배포했다.
- Pages deployment `dc5dc18f`, static namespace `132d1c9c8599e7086296ec3c316482dff0650443e44c45691f80b9b947f88874`. 로컬/Cloud Build의 namespace가 같고 프로그램 파일만 게시했다. API origin과 CSP가 베타 ingress를 가리키며 `/editor/` HTTP200을 확인했다.
- 비공개 상태에서 14개 HTTP 경계 검사 통과: ingress/worker 라우팅 및 익명 거부, 설치 랜딩·OAuth 시작·bot-only scope·Secure 쿠키, 잘못된 callback·workspace·origin 거부, Pages preflight, Slack 정상 서명 challenge·위조 서명 거부. Slack 실제 OAuth 설치 성공을 뜻하지 않는다.
- 별도 명시적 승인 후 베타 ingress에만 allUsers/run.invoker를 부여했다. 익명 ingress `/` 200, worker `/` 403 확인.
- 실제 테스트 workspace는 사용자가 지정한 `alhangeul.slack.com`, 채널은 `test`다. 명시적 권한 승인 후 manifest를 저장하고 Public Distribution 활성화 화면을 확인했다. 직접 설치 시작은 Slack이 로그인된 다른 workspace(rhwphq)로 이동하려 해 자동 검토가 차단했다. 대상 workspace를 바꾸지 않고 사용자에게 설치 링크에서 alhangeul을 직접 선택하도록 요청했다. 실제 기능 수용은 아직 남아 있다.

### 배포 중 발견 및 처리

1. 로컬 Docker 최종 이미지 export가 host 디스크 부족으로 실패했다. 생성한 재다운로드 가능 upstream bare cache만 정리하고, 비밀값 없는 allowlist 입력 147개(686,446 bytes)로 Cloud Build를 사용했다. 애플리케이션 테스트 실패와 구분한다.
2. 최초 worker 배포의 `WORKER_ORIGIN=https://example.invalid`가 `.run.app` 제한에 걸렸다. Cloud Run이 할당한 실제 URL로 배포 설정을 수정했다. 앱의 검증 조건을 완화하지 않았다.
3. 외부 `/healthz` 요청은 Google 프런트엔드 404를 반환했다. 서비스 Ready 상태와 실제 앱 `/`·OAuth·Slack 경로를 사용해 배포를 검증했다. 내부 컨테이너 healthcheck와 외부 URL 검증을 구분한다.

- 배포 후 기존 `rhwp-ingress`/`rhwp-worker`의 Ready revision·트래픽이 배포 전과 동일함을 확인했다. 베타 서비스 Ready 및 최소0·최대1, ingress 공개·worker 비공개도 확인했다.


### 실제 첫 외부 설치

사용자가 설치 완료를 알린 뒤, 서버에서 `T0B3KRJ67LG`의 active 설치와 요청한 8개 bot scope를 확인했다. Slack이 반환한 canonical workspace 주소는 사용자가 처음 적은 alhangeul과 철자가 다른 `alhanguel.slack.com`이다. 암호화된 저장 토큰을 메모리에서 복호화해 `auth.test`의 team/bot user 일치도 확인했다. 토큰 원문을 로그나 파일에 출력하지 않았다.

`test` 채널(`C0C2ZCX509K`)은 존재하며 첫 조회 시 봇은 아직 참여하지 않았다. Chrome에도 해당 workspace 로그인이 없어 사용자에게 로그인·채널 초대를 요청했다. 실제 파일 변환·편집·저장 수용은 미완료이며, 설치 성공과 구분한다.


### 외부 수용에서 발견한 결함과 수정

Chrome 로그인·test 초대 후 `/rhwp settings`에서 자동 감지를 활성화하고 `viewer-two-pages.hwp` 합성 문서를 게시했다. PNG 2장은 생성됐으나 PDF는 세 번 재시도 뒤 실패했다. 저장 기록상 PDF 변환·업로드는 완료되어 있었으며, browser mode가 Work Objects metadata를 생략하면서 PDF의 실제 메시지 공유도 빠졌다. ready 이전 공유 확인이 끝날 수 없는 순환을 제거하도록 browser message의 `file_ids`에 업로드된 PDF를 포함했다. 편집본 HWP의 최초 게시에도 같은 누락이 있어 함께 고쳤다. 내부 embed metadata 경로는 유지한다.

사용자 OpenID 코드 입력 후 callback은 실제 Cloud Run 요청에서 GET/400(2026-09-20T02:33:36Z)으로 확인됐다. form_post 전용 수신을 GET query 및 POST form 수신으로 확장하되, 둘 다 동일한 일회용 state·브라우저 쿠키 결속·JWT 서명/issuer/audience/nonce·workspace·문서 권한 검사로 보낸다. 혼합 query/body, 중복 파라미터, 8KiB 초과, 미지원 method는 거부한다. Chrome의 ERR_BLOCKED_BY_CLIENT 표시 자체의 원인은 아직 별도로 미확정이다.

추가로 distributed worker에서 빠진 `traceTask`를 연결했다. 단계별 시간과 허용 목록 오류 코드만 기록하며 문서명·토큰·OAuth code를 애플리케이션 로그에 남기지 않는다. 파일 공유 확인 실패는 `share_pending`으로 구분한다.

검증: typecheck, security 52, Slack 87 통과. GET/POST 각각 실제 state 저장소와 서명된 합성 JWT로 쿠키 누락/위조·재사용 거부 및 정상 ticket 발급을 검사했다. browser mode의 PDF 공유와 편집본 HWP/PDF 동일 스레드 저장을 회귀 검사했다. 기본 sandbox에서는 로컬 listen EPERM으로 실행이 막혀 허용된 환경에서 재실행했다. 수정 버전의 실제 배포·수용은 후속 기록과 구분한다.


### 수정 후보 실제 재검증

`652b7a9` Linux CI push/PR의 viewer·container 모두 통과했다(35484783650, 35484785895). Cloud Build `12331613-c450-4ed4-9ffc-4b185e5bed6f` 성공 후 베타 worker 00004-6cv/ingress 00003-6ns로 반영했다. Pages namespace는 동일하며 재배포하지 않았다. 기존 운영 revision/traffic 유지 및 beta 공개 ingress/비공개 worker를 다시 확인했다.

기존 실패 카드의 재시도 버튼으로 동일 PDF 파일 ID가 ready로 복구되고 PNG 2장도 ready가 됐다. Chrome에서 OpenID 재승인 후 실제 Pages Studio에 2페이지 문서가 열렸고, 첫 문단에 `External beta saved revision` 텍스트를 입력했다. 앞선 ERR_BLOCKED_BY_CLIENT는 이 새 로그인 흐름에서 재현되지 않았다.

실제 저장에서는 새 카드가 같은 스레드에 게시됐지만 HWP 공유가 되지 않아 접근 거부가 발생했다. fake Slack이 chat.postMessage의 file_ids도 첨부로 처리한 가정이 실제와 달랐다. fake를 실제 동작대로 chat.update만 첨부하도록 수정하고, browser revision 게시 직후 부모 문서 권한으로 chat.update를 호출해 HWP를 공유한다. 공유 확인 중에는 부모 권한을 검사하고, 완료 후 새 편집본 권한도 검사한다. 저장 receipt의 동일 요청 재시도로 복구하며 새 파일/카드를 다시 만들지 않는다.
