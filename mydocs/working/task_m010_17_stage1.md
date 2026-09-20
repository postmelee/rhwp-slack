# Task #17 Stage 1 — 편집 통합 테스트 단계 계측

`slack-flow.spec.ts`의 원본 준비/열기, 수정본 저장/PDF, 재열기, receiver/runtime 정리를 `test.step`으로 나눴다. stdout에 고정 단계명과 시작·종료·duration·성공 여부만 기록한다. 문서·URL·세션 값을 로그에 넣지 않는다.

검증: Node 24.21.0 `npm run typecheck` 통과. 테스트 제한 90초 및 제품 소스는 그대로다. 실제 Linux 실행은 Stage 2의 artifact 보존 경로까지 포함한 CI에서 검증한다. 최초 실패 원인은 미확정이다.
