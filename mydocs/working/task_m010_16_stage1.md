# Task #16 Stage 1 — 설치 저장소와 OAuth 경계

## 구현

- 별도 설치 registry에 AES-256-GCM ciphertext만 저장한다. app/team/generation/key ID를 AAD로 묶고 교차 이동·잘못된 키의 복호화를 거부한다.
- 재설치마다 generation 변경, 과거 generation으로 폐기 시 새 설치 보존, 현재 폐기 시 암호문 제거.
- 일회용 state와 브라우저 결속 쿠키를 분리하고 hash만 저장한다. 원자적 consume·10분 만료·install/signin 목적 구분.
- 정확한 HTTPS callback, bot scope만 요청, oauth 응답의 app/team/권한과 auth.test의 실제 bot identity 확인. 취소·중복 callback·Grid·미지원 회전 토큰 응답은 안전하게 처리한다.
- `/install` 및 `/oauth/callback` 독립 route: Secure/HttpOnly/SameSite=Lax cookie, no-store, 외부 redirect 입력 없음, 오류 비밀값 미노출.

## 검증

Node 24.21.0 typecheck 및 `tests/security/installations.test.ts` 8/8 통과. 저장에는 실제 SqliteMetadata transaction/금지값 검사, 암호화에는 실제 Node crypto를 사용했고 Slack 응답은 합성이다. 초기에 scope 형식 검사에서 콜론 없는 `commands`를 거부하는 결함을 검사로 찾아 수정 후 전체 재실행했다.

## 미완료 경계

기존 운영 entrypoint에 연결하지 않았다. tenant별 receiver/queue/editor 분리, Sign in with Slack, 실제 Google Secret Manager 키·Slack OAuth 연결과 두 workspace 수용은 후속 단계다. 이 상태를 외부 설치 가능 완료로 표시하지 않는다.
