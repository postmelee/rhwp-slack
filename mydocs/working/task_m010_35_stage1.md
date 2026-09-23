# Task #35 Stage 1 — 안전한 로그인 복구 화면

GitHub Issue: [#35](https://github.com/postmelee/rhwp-slack/issues/35)
구현계획서: [구현계획](../plans/task_m010_35_impl.md)

## 단계 목적

재설치·권한 변경·로그인 만료로 거절되는 요청에 문서 권한을 부여하지 않으면서 복구 방법을 안내한다.

## 산출물

- `signin-result.ts`: 고정 오류 분류 및 한국어 HTML.
- `signin.ts`: state 실패와 신원 검증 후 문서 접근 거절 구분.
- `browser-routes.ts`: callback/open 실패를 자격정보 없는 `/browser/result`로 303 이동. no-store, no-referrer, CSP 유지·강화.
- 두 보안 테스트: 취소·만료·거절·악성 입력·발급 없음 검증.

## 본문 변경 정도 / 본문 무손실 여부

성공 로그인·권한 검사·세션 발급 조건은 보존한다. 실패 응답의 표현과 이동만 변경한다. 입력/예외의 원문은 HTML에 반영하지 않는다.

## 검증 결과

- 수정 전 새 `failed login leaves` 회귀: 예상한 400 !== 303 실패.
- 수정 후 `npm run typecheck`: PASS.
- `npm run test:security`: 56/56 PASS (`/private/tmp/task35-security.log`).
- `npm run test:slack`: 95/95 PASS (`/private/tmp/task35-slack.log`).
- 잘못된 nonce, state 재사용, 채널 접근 거절, 설치 해제에서 ticket 발급 0 확인.
- GET/POST 실패의 Location을 고정 오류 경로로 검사하므로 성공 303과 혼동하지 않는다.

## 잔여 위험

- ERR_BLOCKED_BY_CLIENT의 확장 프로그램 원인은 확정하지 않았다.
- 실서비스 배포와 실제 이전 카드/현재 카드 비교는 Stage 2에 남는다.
- 다른 사용자 채널 탈퇴 검증은 협력자가 없어 미검증이다.

## 다음 단계 영향

공개 ingress만 배포한다. worker·내부 앱·IAM·비밀값·리소스 사양은 유지한다.

## 승인 요청

사용자의 최종 제출 전까지 진행 지시에 따라 Stage 2를 계속한다. Marketplace 최종 제출은 제외한다.
