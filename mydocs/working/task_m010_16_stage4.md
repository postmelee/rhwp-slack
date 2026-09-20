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
