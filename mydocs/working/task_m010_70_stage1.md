# Task #70 Stage 1 — 종료 처리
GitHub Issue: https://github.com/postmelee/rhwp-slack/issues/70
구현계획: ../plans/task_m010_70_impl.md

## 목적과 산출물
application.ts의 실패 종료 경로만 별도 lease/원자적 카드 조회를 사용한다. missing/removed 카드는 되살리지 않고 skip하고 일반 locked()와 write() 보안은 그대로 유지한다. tenant 불일치는 계속 거부한다.

## 검증
고정 Node 24.21.0에서 `node --import tsx --test tests/slack/cloud-application.test.ts`: 21/21 통과.
신규 회귀: 제거된 카드 반복 전달, 잠금 획득 중 삭제/제거/팀 변경, 저장소 일시 오류 재시도 보존, watchdog→원본→watchdog 재전달. 실제 Slack 호출은 합성 API로 검증했으며 실제 워크스페이스 검증과 구분한다.

## 잔여 위험 및 다음 단계
전체 타입/보안 검증과 실제 workspace/배포 검증은 이후 단계다. 종료 처리 밖의 문서 권한은 완화하지 않았다. 사용자의 수정→검증→배포 진행 지시에 따라 진단 단계로 진행한다.
