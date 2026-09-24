# #41 최종 보고 — 재시도 접수와 진행 표시

GitHub Issue: [#41](https://github.com/postmelee/rhwp-slack/issues/41), M010, 3단계.

## 작업 요약
재시도는 성공하는데 Slack이 실패처럼 보이던 문제를 수정했다. 서명된 버튼 입력을 영속 접수한 뒤 응답하고, 권한 조회와 진행 표시는 worker로 옮겼다. 카드 잠금을 해제한 후 변환 작업을 발행한다.

## 변경 파일 목록과 영향 범위
| 경로 | 변경 | 영향 |
|---|---|---|
| src/server/cloud/receiver.ts, events.ts | 버튼 영속 접수, worker 권한 처리 | 재시도·추가 이미지 버튼 |
| src/server/cloud/application.ts, tasks.ts | 예약/발행 분리, 같은 요청 예약 재사용 | 카드 잠금 경합·중복 접수 |
| src/server/document-message.ts, cloud/telemetry.ts | 접수·실행 문구, 안내 오류 별도 기록 | 진행/실패 구분 |
| tests/slack/cloud-{receiver,application}.test.ts | 서명 HTTP와 큐·권한 경계 회귀 | 사용자 교체·안내 실패·발행 재전달 |

## 문서 위치 검증
수행계획의 mydocs/plans·working·report·orders에 기록했다. 제품/사용자 문서 변경은 없으며 새 제품 문서 루트를 만들지 않았다.

## 변경 전·후 정량 비교
| 항목 | 이전 | 이후 |
|---|---|---|
| Slack API가 응답하지 않는 동일 HTTP 회귀 | 약 3.1초 후 404 | 200, 접수 경로 Slack API 호출 0 |
| 처리 표시 | 완료 전 진행 상태를 알아보기 어려움 | 접수 → 실행 → 완료 |
| 카드 잠금과 큐 발행 | 잠금 안에서 발행 | 잠금 해제 후 발행 |
| 진행 안내 전송 실패 | 작업 접수와 실패 안내 혼동 | 오류 기록 후 예약 작업 발행 유지 |

## 검증 결과
| 수용 기준 | 결과 |
|---|---|
| 느린 Slack API와 접수 분리 | OK — 서명 HTTP 수정 전후 회귀 |
| 중복·위조·다른 사용자 권한 | OK — Slack 101/101, security 56/56, typecheck PASS |
| 예약 후 안내 실패·큐 발행 복구 | OK — 잠금 해제 assertion 및 같은 요청 재전달 |
| Linux 실행 | OK — push/PR container·viewer 4개 PASS |
| 공개 서비스 반영 | OK — source 2d6501b, 새 worker/ingress 100%, IAM/사양 동일 |
| 실제 진행 상태 | OK — Alhanguel 새 계정, 추가 이미지 버튼 200/1.531초, 접수→실행→10장 완료 |

- [Stage 1](../working/task_m010_41_stage1.md): 구현과 회귀.
- [Stage 2](../working/task_m010_41_stage2.md): CI·검토.
- [Stage 3](../working/task_m010_41_stage3.md): 정확한 source/build/revision·실제 관측.

## 잔여 위험과 후속 작업
- 실제 배포 후 버튼 검증은 공통 경로의 추가 이미지 요청이다. 실패 카드 재시도와 다른 사용자의 권한 경계는 자동 검사이며 실화면 재실행으로 주장하지 않는다.
- 콜드 스타트·Cloud Tasks 자체 접수 지연의 3초 상한은 보장하지 않는다. 1.531초는 단일 관측이다.
- 장기 큐 장애/worker 전체 정지 복구는 이번 검증에 포함하지 않는다. #13의 운영 지연 범위로 관측한다.
- #4 Marketplace 준비로 복귀할 수 있으며 최종 제출은 별도로 남긴다.

## 승인 근거
사용자의 수정 진행 지시와 기존 PR 검토·병합·공개 배포 승인 범위로 진행한다.
