# Task #13 구현계획서

수행계획: [task_m010_13.md](task_m010_13.md).

1. **Stage 1 — 편집 API 세부 계측**: 요청별 runId, 고정 API operation, Slack 메서드와 Firestore get/list/atomic 시간. API handler의 HTTP 상태와 예외, 종료 시 RSS 기록. 요청/응답 body는 전달하지 않는다. 기록 실패·동시 요청·민감값 테스트. 커밋: `Task #13 Stage 1: 편집 API와 외부 호출 계측`.
2. **Stage 2 — 요청 안의 중복 파일 조회 제거**: authorize 결과를 내부 `{card,source}`로 전달하고 공개 authorize는 card 계약 유지. ensureSource에서 재사용하고 다운로드 뒤 새 검사 유지. 원본/수정본/권한 회수/내용 변화/호출 수 비교. 커밋: `Task #13 Stage 2: 원본 전달의 다운로드 전 중복 조회 제거`.
3. **Stage 3 — 통합 검증·문서**: typecheck, unit, Slack, security. 고정 Node 환경, source SHA·명령/건수·한계 기록. 운영 시간/요금의 개선률을 합성 결과로 주장하지 않는다. 커밋: `Task #13 Stage 3 + 최종 보고서: API 계측과 호출 수 비교 검증`.

운영은 C 그대로 유지한다. 새 Cloud 리비전/원격 push/CI는 검토 가능한 변경과 보고서를 준비한 뒤 현재 사용자 승인 범위에 따라 처리한다.
