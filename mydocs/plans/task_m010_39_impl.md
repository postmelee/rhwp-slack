# Task #39 구현계획

## Stage 1 — 실패 메타데이터와 상태 표시

failed()에서 사용자 권한 검사 이전에 tenant·lease·task generation 검증 후 종료 기록. 기존 정상 권한 메시지 경로 유지. 권한 거절 시 동일 조직·허용 채널·봇 참여를 검증하는 별도 상태 전용 안내. 이 경로에 파일 ID·문서 URL·이름·metadata 전달 금지. 회귀는 멤버 탈퇴와 재참여, 봇 제거, task generation, Slack 갱신 실패를 검사한다.

## Stage 2 — CI·배포·운영 검증

타입, Slack/security, Linux CI 통과 후 기존 Cloud Run 사양/IAM 유지 배포. 이전에 실패한 카드의 작업 종료 표시 확인. 실제 탈퇴 실수용은 사용자 관측과 서버 로그를 구분한다.

## Stage 3 — 검토·최종 보고

검증 증거와 남은 제한을 기록하고 PR 검토·병합. Marketplace 최종 제출 제외.

## 승인

사용자 수정 진행 승인 범위로 계속 진행한다. 커밋은 각 단계 Task #39 Stage N 메시지를 사용한다.
