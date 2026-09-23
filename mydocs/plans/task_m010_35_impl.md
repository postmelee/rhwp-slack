# Task #35 구현계획

[수행계획](task_m010_35.md)의 사용자 순차 진행 승인을 적용한다.

## Stage 1 — 오류 분류와 복구 화면

- BrowserSignInError는 InstallationError를 상속하고 고정 reason만 전달한다.
- state 소비 실패는 로그인 만료, JWT 검증 후 설치·문서 거절은 문서 연결 불가, 외부 인증 실패는 일반 실패로 분류한다.
- callback/open 실패는 `/browser/result?reason=...`로 303, 결과 페이지는 고정 문구·Slack 복귀 링크·no-store·no-referrer·제한 CSP. 취소도 같은 안전한 결과 페이지.
- 기존 보안 검사에 redirect 이후 발급 없음·민감 값/HTML 반영 없음·취소/만료 분류를 추가한다. 수정 전 새 회귀 실패와 수정 후 통과를 기록한다.

## Stage 2 — 검증과 배포

- typecheck, security, slack, viewer를 변경 범위에 따라 실행하고 Linux CI로 컨테이너/브라우저 검증.
- desktop/mobile 오류 화면 직접 판독. 공개 ingress만 기존 Cloud Run 설정·IAM·비밀값 참조를 보존해 배포하며 rollback revision을 기록한다. worker는 같은 API 변경을 필요로 하지 않는다.
- 실제 이전 설치 카드·현재 카드 비교. 로그인 중 사용자의 직접 인증이 필요하면 해당 단계만 기다린다.

## Stage 3 — 수용·PR·심사 준비 연결

- #35 결과 보고와 #4 Marketplace 정본 갱신. 다른 사용자 검증은 현재 협력자가 없어 미검증.
- PR 검토·최종 head CI 후 병합. Marketplace 약관 확인이 필요한 경우 완성된 양식·자료를 제시하고 실제 동의 전에 확인한다. 최종 제출은 하지 않는다.
