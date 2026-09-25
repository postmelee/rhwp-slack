# Task #16 Stage 3 — 브라우저 편집 사용자 인증

## 구현

- Add to Slack 시작 페이지와 설치 완료 안내를 제공한다. 외부 카드의 `rhwp에서 편집`은 로그인 시작 URL이며, 문서 ID만으로 편집 티켓을 발급하지 않는다.
- 설치 OAuth와 별도로 `openid profile` 로그인, 브라우저에 결속된 state, nonce, Slack JWKS의 RS256 서명·issuer·audience·만료·team/user를 확인한다. 설치자 대신 실제 로그인한 사용자의 채널/파일 권한을 검사한다.
- Slack의 OpenID `form_post` callback에는 Secure/HttpOnly/SameSite=None 쿠키를 사용한다. 중복 파라미터·재사용·잘못된 워크스페이스를 거절한다. 사용자 access token과 프로필은 저장하지 않는다.
- Pages 편집기는 fragment의 workspace와 티켓을 읽은 뒤 URL에서 지우고 API 요청에 workspace 헤더를 전달한다. 서버는 해당 설치의 세션 저장소와 현재 권한으로 검증한다. 기존 fragment/내부 embed 경로는 기본값으로 유지한다.
- 후보 전용 진입점·설정과 설치 폐기 처리를 준비했다. 설치 폐기 이벤트는 현재 토큰을 확인하며 늦게 도착한 과거 이벤트가 새 설치를 폐기하지 않도록 한다. Slack 일시 장애는 재시도 가능한 실패로 처리한다.

## 검증

Node 24.21.0에서 typecheck 통과, unit 9/9, Slack 86/86, security 50/50 통과. 보안 검증에는 실제 로컬 HTTP, SQLite, RSA/JWT 서명을 사용하며 Slack 네트워크 응답은 합성이다. 교차 workspace 티켓 교환/세션 사용 거부, CORS, 단일 사용, 권한 없는 로그인, 설치 폐기/재설치를 확인했다.

처음 sandbox 안에서 실행한 HTTP 테스트는 loopback listen EPERM으로 실패했다. 허용된 로컬 서버 실행 권한으로 재실행하여 위 결과를 확인했다. 실제 Slack OAuth·Pages·Cloud Run 수용 결과로 간주하지 않는다. 후보 컨테이너 빌드·Linux CI·실제 두 워크스페이스 수용은 다음 단계다.

## 근거와 제한

[Sign in with Slack](https://docs.slack.dev/authentication/sign-in-with-slack/), [OAuth 설치](https://docs.slack.dev/authentication/installing-with-oauth/), [tokens_revoked](https://docs.slack.dev/reference/events/tokens_revoked/)의 흐름을 사용한다. JWKS는 고정 Slack 주소로 제한하고 jose 6.2.12를 고정했다. Enterprise Grid와 토큰 회전은 아직 지원하지 않는다. 실제 신규 앱 설정과 배포는 수행 전이며 기존 운영 서비스·앱은 변경하지 않았다.
