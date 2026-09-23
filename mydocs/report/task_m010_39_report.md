# Task #39 최종 보고 — 채널 탈퇴 중 미리보기 상태

GitHub Issue: https://github.com/postmelee/rhwp-slack/issues/39
마일스톤: M010, 3단계

## 작업 요약

변환·업로드 중 요청자가 탈퇴하면 실패를 표시하는 경로까지 권한 검사에 막혀 준비 중으로 남는 결함을 수정했다. 내부 실패 기록을 먼저 확정하고 봇이 접근 가능한 같은 조직 채널에 파일을 추가 공유하지 않는 중단 안내를 제공한다.

## 변경 파일·영향

| 파일 | 변경 |
|---|---|
| src/server/access.ts | 기존 bot 채널 안전 조건을 공통 함수로 분리, 사용자 검증 유지 |
| src/server/cloud/application.ts | 실패 기록 먼저 확정, 권한 거절 시 상태 전용 안내 |
| tests/slack/cloud-application.test.ts | 탈퇴·재참여·봇 부재·외부 공유·off·전송 실패·세대 보호 |

## 문서 위치

수행계획대로 mydocs/plans·working·report에 작업 근거 보존. 기존 #4/#13에 수용 및 후속 연결. 별도 제품 문서 루트 없음.

## 전후 비교·검증

| 기준 | 이전 | 이후 |
|---|---|---|
| 3회 access_denied 후 카드 | pending/running 유지 | failed 기록 |
| 탈퇴 후 안내 | 갱신 차단 | 고정 중단 안내와 재시도 버튼 |
| 권한 없는 새 공유 | 차단 | 계속 차단; 상태 payload에 file_ids/metadata/URL 없음 |
| 명시적 재시도 | pending이면 차단 | 재참여 후 새 세대로 가능 |
| 회귀 | pending !== failed 실패 | cloud application 13/13 통과 |

타입 PASS, Slack 97/97, security 56/56, 코드 head Linux 4개 SUCCESS. 실제 공개 서버 기존 실패 편집본의 재시도는 동일 카드에서 PDF·PNG ready 및 task done을 확인했다. 상세 source SHA·빌드·revision·관측은 [Stage 2](../working/task_m010_39_stage2.md), 코드 검토는 [Stage 3](../working/task_m010_39_stage3.md).

## 잔여 위험·후속

배포 후 새 계정의 실제 탈퇴 중단 안내는 재검증 전이다. 자동 회귀와 기존 사용자 탈퇴 실수용을 실제 재실행으로 바꾸어 주장하지 않는다. 진행 중 바이트의 즉시 취소는 보장하지 않으며 기존 완료/공유 권한 검사를 유지한다. 봇이 채널을 떠났거나 전송이 불가능하면 내부 상태만 확정되고 Slack의 옛 표시는 남을 수 있다.

실제 재시도에서 접수 지연·잠금 경합 및 오해를 주는 ephemeral이 먼저 발생했지만 큐는 완료했다. #13에서 별도 조사한다. 서버 사양·IAM·내부 앱·Pages는 유지했다. 최종 제출 제외.

## 승인

사용자의 수정 진행 승인과 기존 검토·병합 승인 범위로 PR #40을 진행한다.
