# Task #2 구현계획서

수행계획서: [task_m010_2.md](task_m010_2.md) · Issue #2 · M010

## 문서 위치 확인

제품 안내는 기존 docs/에, 계획·단계별 결과와 최종 비교는 mydocs/에 둔다. 재현용 스크립트는 scripts/, 민감한 원시 증적은 ignored .cache/validation/이다. 수행계획서의 위치 판단과 동일하다.

## Stage 1 — 계측과 기준 측정

- 산출물: `src/server/cloud/telemetry.ts, main.ts, application.ts, src/conversion/convert.mjs, pdf-child.mjs, scripts/benchmark-conversion.mjs` 및 `mydocs/working/task_m010_2_stage1.md`.
- 변경: 허용 목록 단계/오류 프로토콜과 작업 식별자. 출력 내용 없는 단계별 숫자. 기존 기능을 변경하지 않은 local/Linux/Cloud 기준 측정.
- 검증: 로그 민감값/크기·구조 검사, 변환 출력 계약, 동일 문서 반복 기준. 영향 코드의 typecheck/단위·Slack·보안 검사를 수행하고 `git diff --check`를 통과한다.
- 커밋: `Task #2 Stage 1: 계측과 기준 측정`.

## Stage 2 — 복구 상태와 유한 재시도

- 산출물: `src/server/cloud/tasks.ts, application.ts, receiver.ts, document-message.ts, documents.ts` 및 `mydocs/working/task_m010_2_stage2.md`.
- 변경: 시도/재시도/최종 실패 상태, 실패 영수증, 새 세대 수동 재시도. PDF/PNG 부분 성공과 반응 일치. 측정 기반 제한 시간.
- 검증: 최종 실패·재시도 소진·동시 재시도·권한 회수·중복 방지. 영향 코드의 typecheck/단위·Slack·보안 검사를 수행하고 `git diff --check`를 통과한다.
- 커밋: `Task #2 Stage 2: 복구 상태와 유한 재시도`.

## Stage 3 — 변환 코드·정적 글꼴 사전 준비

- 산출물: `scripts/build-conversion.mjs, package.json, Dockerfile, src/conversion/pdf-child.mjs` 및 `mydocs/working/task_m010_2_stage3.md`.
- 변경: 동일 pinned 코드/글꼴 빌드. 런타임 TS 변환·글꼴별 base64 반복 제거. Stage1의 page_attach 병목에 따라 허용 목록의 로컬 리소스 응답으로 고정 글꼴 전달량을 줄여 비교한다. 새 파서/브라우저 격리 유지.
- 검증: 고정 빌드·엔진/폰트 동일·원본/비밀값 부재·PNG/PDF 시각 대조. 영향 코드의 typecheck/단위·Slack·보안 검사를 수행하고 `git diff --check`를 통과한다.
- 커밋: `Task #2 Stage 3: 변환 코드·정적 글꼴 사전 준비`.

## Stage 4 — PDF 먼저 제공하고 완료 결과 재사용

- 산출물: `src/conversion/convert.mjs, pdf-child.mjs, src/server/cloud/application.ts` 및 `mydocs/working/task_m010_2_stage4.md`.
- 변경: bounded framed output으로 PDF와PNG 순차 전달. PDF 완료/공유확인 후 카드 먼저갱신. 같은파싱 결과 사용, 재시도시완료PDF 재생성/업로드 건너뛰기.
- 검증: 부분 프레임·크기·timeout·PDF후PNG실패·중복 영수증·권한. 영향 코드의 typecheck/단위·Slack·보안 검사를 수행하고 `git diff --check`를 통과한다.
- 커밋: `Task #2 Stage 4: PDF 먼저 제공하고 완료 결과 재사용`.

## Stage 5 — 제한된 업로드 병렬화

- 산출물: `src/server/cloud/application.ts, uploads.ts, scripts/benchmark-conversion.mjs` 및 `mydocs/working/task_m010_2_stage5.md`.
- 변경: 최대2개 업로드와 순차 방식 비교. checkpoint/카드 쓰기 직렬화. 문서갤러리 순서 보존.
- 검증: 응답유실·오류·취소·순서·메모리·처리시간 비교. 영향 코드의 typecheck/단위·Slack·보안 검사를 수행하고 `git diff --check`를 통과한다.
- 커밋: `Task #2 Stage 5: 제한된 업로드 병렬화`.

## Stage 6 — 편집 초기화와 외부 열기 안내

- 산출물: `src/editor/main.ts, style.css, src/server/editor-routes.ts` 및 `mydocs/working/task_m010_2_stage6.md`.
- 변경: 전체 초기화 제한과 단계별 안내. timeout시늦은SDK결과 정리. 무티켓직접열기 Slack재진입 안내. 기존권한/소비티켓 유지.
- 검증: iframe load/SDK/document stall·늦은응답·권한실패·일반편집/저장. 영향 코드의 typecheck/단위·Slack·보안 검사를 수행하고 `git diff --check`를 통과한다.
- 커밋: `Task #2 Stage 6: 편집 초기화와 외부 열기 안내`.

## Stage 7 — 동일 사양 전후 비교와 운영 반영

- 산출물: `scripts/, docs/cloud-run.md, docs/architecture.md, mydocs/report/task_m010_2_report.md` 및 `mydocs/working/task_m010_2_stage7.md`.
- 변경: 각기능의baseline대비수치·성공률·출력대조. 전체자동검사·Linux·Slack수용·고정사양 배포와rollback기록.
- 검증: npm run check, Linux smoke, 반복측정표, 실제Slack PDF/Studio/저장. 영향 코드의 typecheck/단위·Slack·보안 검사를 수행하고 `git diff --check`를 통과한다.
- 커밋: `Task #2 Stage 7: 동일 사양 전후 비교와 운영 반영`.

## 단계 의존성과 완료

Stage1 기준을 남긴 뒤 Stage2~5를 순서대로 적용한다. Stage6은 기존 편집 진입 계약을 보존하며 최종Stage7에서 통합한다. 각 단계의 보고·커밋 뒤 다음 단계로 진행한다. 실패한 검사나 측정하지 못한 지표는 미완료/미검증으로 유지한다. 사용자 지시가 승인한 범위 안에서 반복 확인 없이 진행하며 증설·새 권한·외부 OAuth·별도 후속 이슈 작업은 포함하지 않는다.
