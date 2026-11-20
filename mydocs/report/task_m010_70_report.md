# Task #70 최종 보고 — 실패 종료 처리 및 진단
GitHub Issue: https://github.com/postmelee/rhwp-slack/issues/70 · M010 · 3단계

## 작업 요약
무효화 카드의 실패 종료가 접근 거부를 반복하던 경로를 별도 lease/atomic 종료 처리로 수정했다. 일반 문서 권한은 유지하고 최초 업무 실패와 고정 접근 거부 사유를 보존했다.

## 변경 범위
- cloud/application.ts: 종료 skip 및 카드 상태 진단. 삭제/팀 변경 경쟁에도 복원·공유하지 않음.
- errors.ts, access.ts, cloud/error-diagnostics.ts: 고정 enum과 안전한 직렬화/복원. 기존 권한 조건 보존.
- cloud/tasks.ts, telemetry.ts: 최초 업무 실패 보존, 기존 최종 실패 판정/중복 제거 유지.
- 회귀 테스트: 삭제 경쟁, watchdog/원본 재전달, 일시 저장소 장애, 최초 실패 복원, 개인정보 미노출, 기존 페이지 제한 안내.

## 문서 위치 검증
계획한 mydocs/orders, plans, working, report에만 작업 문서를 추가했다. 제품 문서 루트나 engine은 변경하지 않았다.

## 검증 결과
타입 검사와 unit 15 / Slack 246 / security 79 / viewer 38 / conversion 10 모두 통과. 배포 후보는 기존 엔진/비공개 계측 보존 후 별도 전체 검증도 통과했다. 실제 Slack API 후보 테스트와 배포 후 사용자 UI→새 worker→PDF·이미지 정상 게시 E2E를 구분해 확인했다. 상세는 Stage 3 보고.

## 변경 전후
기존 removed 종료 분기는 공통 lock 접근 검사 뒤라 도달 불가였다. 수정 후 removed/missing은 terminal skipped로 완료하고 4회 재전달에서도 외부 안내 재시도를 소모하지 않음을 검증했다. 정상 문서 접근 차단과 저장소 장애 재시도는 유지한다.

## 잔여 위험과 후속
동시 무효화가 write 직전에 일어나면 보호적 오류 한 번은 가능하며 후속 전달에서 skip한다. prepare 접근 거부의 모든 원인을 영구 실패로 바꾸지 않았고 신규 사유 계측으로 후속 판단한다. 페이지 제한은 기존 200쪽 유지. reaction no-op을 task 실패와 혼동하지 않는다. 운영 배포 입력/rollback 증적은 비공개 보존하며 공개 저장소에 복제하지 않는다. 장기 오류율 검증과 GitHub CI 결과는 별도 확인 대상이다.

사용자의 수정·실제 테스트 후 배포 지시와 추적 이슈 승인을 따라 수행했다. 공개 PR은 비밀·운영 데이터 없이 코드 검토용으로 게시한다.
