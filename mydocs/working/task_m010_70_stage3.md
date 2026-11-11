# Task #70 Stage 3 — 통합 검증 및 배포
Issue #70 · 구현계획 ../plans/task_m010_70_impl.md

## 검증 결과
공개 제품 고정 Node 24.21.0: typecheck, unit 15, Slack 246, security 79, viewer 38, 실제 변환 10 통과. 기존 배포 입력에 같은 최소 변경을 적용한 후보는 typecheck, unit 10, Slack 268, security 80, viewer 33, 변환 10 및 두 worker bundle warm-code 통과.

## 실제 Slack 검증 경계
배포 전 후보 코드와 실제 Slack API를 사용한 테스트: 합성 원본의 2쪽 PDF·이미지 게시 성공. 이번 실행에 새로 올린 합성 사본만 삭제하고 동일 invalidation handler를 호출해 terminal skipped, notice 0회, 추가 재전달 4회 정상 종료 확인. 이 단계의 metadata/큐는 로컬이므로 운영 ingress/Cloud Tasks E2E로 주장하지 않는다.
배포 후 실제 사용자 UI 업로드를 통한 정상 E2E를 별도로 실행했다. 새 worker에서 event/prepare/preview 모두 성공, HTTP 204, PDF·PNG 2장 게시, UI 완료 체크와 영속 card/task를 대조했다.

## 배포 안전성
immutable 이미지 빌드 성공 후 0% 후보 revision을 만들고 런타임 설정·IAM 불변, startup Ready, 보호 handler 인증 거부를 확인했다. 기존 및 후보 모두 외부 /healthz 경로는 frontend HTML404여서 이를 앱 장애 또는 HTTP200 헬스 통과로 기록하지 않는다. 확인 후 worker 트래픽 전환, 기존 revision 보존. 수신/엔진/권한 설정 변경 없음.

## 경계
실제 workspace·문서·로그·배포 인프라 식별자는 비공개 증적에만 보존한다. 기대 가능한 reaction no-op 단계 기록은 남아 있으나 최종 작업 실패와 분리했다. 장기 운영 무장애를 보장하는 결과는 아니다.
