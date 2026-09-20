# Task #23 구현 계획

1. OIDC 시작의 선택적 reconnect nonce를 state에 묶고 성공 후 editor fragment로 전달한다. 기존 기본 signin 결과 유지.
2. 인증 metadata에 외부 모드에서만 identity 추가, API 오류에 안전한 error code 제공.
3. 별도 창의 일회용 ticket 전달 → 같은 identity 확인 → bearer 교체. Studio/미저장 내용/저장 재시도 바이트 보존, 로컬 다운로드 제공.
4. 실제 Studio save 회귀·위조/다른사용자/취소 경계 검증, 운영 안내 갱신. 실제 Slack popup 정책이 차단하면 미검증으로 남기고 우회로 인증을 완화하지 않는다.

## 빌드 검증 보정

공유 캐시의 realpath와 Vite transform ID가 달라 main overlay가 생략된 원인을 해결한다. 필수 overlay 미적용은 빌드 실패로 처리하며 캐시 공유 여부와 무관하게 Slack 정책을 보존한다.
