# Task #5 구현계획

수행계획: [task_m010_5.md](task_m010_5.md) · M010

| 단계 | 산출물 | 검증 |
|---|---|---|
| 1 재현 | tests/slack/channel-revocation.test.ts·Stage 1 | 기존 전역 무효화로 정상 채널 세션이 실패하는지 |
| 2 수정 | 공유 조회 helper·로컬/Cloud 무효화·Stage 2 | 집중 회귀·typecheck |
| 3 수용 | docs/development.md·최종 보고·PR | test:slack, test:security, diff check, CI |

문서 위치는 수행계획과 같다. 각 단계 소스·보고서를 함께 커밋한다. 실제 Slack 이벤트 발생 검증과 합성 API 검증은 구분한다. 운영 설치 제거·토큰 회수는 이 단계에서 자동 실행하지 않는다. 승인 근거는 같은 스레드의 진행 지시다.
