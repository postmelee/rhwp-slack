# Task #72 Stage 3 — 검증 및 배포

## 자동 검증
- 공개 최종 타입, unit15, Slack274, security84 통과. viewer38/conversion10 통과; 최종 runtime commit의 GitHub viewer/container CI 성공.
- 운영 고정 baseline 후보 타입, unit10, Slack292, security85, viewer33/conversion10 통과.
- metadata 추가 전 첫 build는 미배포 후보로 보존하고 최종 소스로 다시 build했다.

## 실제 Slack 검증
배포 전 최종 후보를 로컬 SQLite/queue와 실제 Slack API로 실행하여 기존 합성 2쪽 HWPX의 PDF+PNG2 생성·게시·공유 확인. prepare/preview 각각 1회 done, terminal failure0. 운영 Firestore·CloudTasks 쓰기 없음. 이것은 full ingress/UI/editor 검증과 구분한다.

배포 후 사용자 UI의 새 합성 업로드에서 신규 worker의 event/prepare/preview가 각각 1회 성공했다. UI 완료 체크, 2페이지, PDF+PNG2, 처리중 문구 제거를 확인했다. 테스트 문서와 실제 workspace/파일/로그 식별자는 공개하지 않는다.

## 재현성과 배포
기존 배포의 고정 Cloud Build archive·generation·SHA256에서 baseline을 복원하고 공개 delta와 비공개 계측을 분리했다. 최종209 입력의 exact upload 및 fresh 복원 일치, historical profiles/Pages/engine 불변을 비공개 운영 프로젝트에서 검증했다.

새 immutable worker image를 0%로 준비하여 Ready·TCP startup·worker 초기화를 확인했다. 기존 런타임 설정·IAM 전체 불변을 독립 대조 후100% 승격. 이전 revision을 rollback용으로 보존했다. ingress와 engine/Pages를 새로 배포하지 않았다.

## 한계
장기 무장애 보장이 아니다. 파일 삭제가 확정된 기존 카드만 조기 완료한다. 카드 없는 prepare, 파일 미발견/가시성 불확실성, 일시 저장소/lease 오류는 기존 보수적 처리 유지. 자동 prepare에 안내 대상이 없으면 새 메시지를 임의로 만들지 않는다. 실제 원본을 누가 삭제했는지는 단정하지 않는다.

실제 Slack 파일 삭제 시나리오는 별도 구체 승인 대기라 실행하지 않았다. 취소/경쟁/재전달 검증은 회귀 테스트 결과이며 실제 삭제 E2E 성공으로 주장하지 않는다.
