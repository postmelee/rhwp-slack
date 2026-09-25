# Task #17 구현계획

[수행계획](task_m010_17.md). M010, #17.

| Stage | 산출물 | 검증 |
|---|---|---|
| 1 | slack-flow test.step 및 단계 duration 로그 | typecheck, 실제 합성 흐름 |
| 2 | CI 전용 artifact mount, always upload, finally cgroup 기록 | node --check, Linux container CI |
| 3 | 실패 한계·새 증거 report | 최종 CI 확인, diff check |

공식 제품 문서는 변경하지 않는다. 90초·CPU2·4GiB·network none·nonroot·read-only 조건 유지. 시간 초과 원인과 관측 개선 완료를 구분한다. 단계별 커밋과 working 보고서를 남긴다.

## 승인된 후속 구현

| Stage | 산출물 | 검증 |
|---|---|---|
| 4 | receiver 종료와 살아 있는 브라우저/TCP 연결의 대기 재현 | 원인별 duration·연결 상태 |
| 5 | 클라이언트 자원을 먼저 닫고 서버/runtime 정리 | typecheck, bounded socket regression, 실제 Studio smoke |
| 6 | 최종 report와 PR | 동일 Linux 제약의 container/viewer CI 및 검토 |
