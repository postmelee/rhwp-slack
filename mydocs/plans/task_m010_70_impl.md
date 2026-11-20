# Task #70 구현계획
수행계획: task_m010_70.md · Issue #70 · M010

## Stage 1 — 종료 처리
application.ts failed 전용 lease에서 카드 소멸/무효화/새 세대 여부를 원자적으로 읽고 skip한다. 일반 locked와 write 보안은 유지. cloud-application 테스트로 원본 재전달/watchdog 및 일시 store 실패를 검증한다.

## Stage 2 — 진단 및 안내
errors/access/cloud error diagnostics에 안전한 denialReason enum을 넣고 재생성된 terminal 기록에도 보존한다. 임의 문자열·개인정보는 배제한다. 페이지 제한은 200쪽과 분할 안내를 명시한다. npm run typecheck, npm test, npm run test:slack, npm run test:security, git diff --check 실행.

## Stage 3 — 통합 검증 및 배포
검증된 배포 baseline에 최소 변경 반영, 두 worker bundle 재빌드. 지정 테스트 워크스페이스에서 합성 문서 업로드·변환과 삭제 경쟁 확인. 실제 E2E와 합성 검증을 구분해 보고. 통과 뒤 고정 이미지 배포 및 로그/상태 확인, rollback digest 보존.

## 문서·커밋
문서 위치는 수행계획과 일치한다. 각 단계 보고는 mydocs/working/task_m010_70_stageN.md, 최종은 mydocs/report/task_m010_70_report.md. 커밋 형식은 Task #70 Stage N: 요약. 실제 운영 증적/비밀/워크스페이스 정보는 공개 문서에 넣지 않는다.
