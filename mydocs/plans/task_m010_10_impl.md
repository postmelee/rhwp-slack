# 첫 이미지 표시 단축·변환 환경 재사용 구현계획서

수행계획서: [task_m010_10.md](task_m010_10.md)
GitHub Issue: [#10](https://github.com/postmelee/rhwp-slack/issues/10)
마일스톤: M010

## 단계 개요

| Stage | 제목 | 주요 산출 | 검증 |
|---|---|---|---|
| 1 | 기준 측정 | scripts/benchmark-conversion.mjs, .cache/validation/task10-before | 기존 변환 테스트, 실제 입력 3회씩 |
| 2 | 게시 병렬화 | src/server/cloud/application.ts, tests/slack/cloud-application.test.ts | 느린 PDF 동안 PNG 시작, 실패 뒤 receipt 재사용, lease 소실 회귀 |
| 3 | 변환 환경 재사용 | src/conversion/*, scripts/build-conversion.mjs, tests/conversion/* | 실제 반복 변환·취소/손상 문서 복구·격리·메모리 |
| 4 | 자산 버전과 출력 검증 | docs/dependencies.md, docs/architecture.md, scripts/benchmark-conversion.mjs | PDF raster/PNG 비교·대표 페이지 직접 시각 확인·타입/보안/Slack 전체 |
| 5 | Linux와 운영 수용 | docs/cloud-run.md, mydocs/report/task_m010_10_report.md | Linux CI·후보/운영 Slack·사양 확인·rollback 기준 |

## 문서 위치 확인

기존 docs/dependencies.md·docs/architecture.md·docs/cloud-run.md만 제품 운영 문서로 확장한다. 이슈별 계획/단계/최종 결과는 mydocs에, 사용자 원본/변환물/상세 로그는 ignored .cache/validation에 남긴다. 수행계획서 위치 판단과 일치한다.

## Stage 1 — 기준 측정

### 산출물

scripts/benchmark-conversion.mjs, .cache/validation/task10-before, mydocs/working/task_m010_10_stage1.md

### 변경 내용

기준 SHA 19d33b9에서 1/2/69페이지 변환 출력과 cold/repeated 실행을 확보한다.

### 검증

기존 변환 테스트, 실제 입력 3회씩. git diff --check. 실행 명령과 결과는 단계 보고서에 고정한다.

### 커밋

`Task #10 Stage 1: 기준 측정`

## Stage 2 — 게시 병렬화

### 산출물

src/server/cloud/application.ts, tests/slack/cloud-application.test.ts, mydocs/working/task_m010_10_stage2.md

### 변경 내용

PDF 업로드와 PNG 업로드를 각각 제한된 작업으로 시작하고 모두 회수한다. 카드 갱신은 직렬화하며 최종 중복 갱신을 줄인다.

### 검증

느린 PDF 동안 PNG 시작, 실패 뒤 receipt 재사용, lease 소실 회귀. git diff --check. 실행 명령과 결과는 단계 보고서에 고정한다.

### 커밋

`Task #10 Stage 2: 게시 병렬화`

## Stage 3 — 변환 환경 재사용

### 산출물

src/conversion/*, scripts/build-conversion.mjs, tests/conversion/*, mydocs/working/task_m010_10_stage3.md

### 변경 내용

비밀값 없는 별도 runtime에서 browser·compiled WASM을 보관하고 작업마다 새 worker/context를 만든다. 유한 큐와 실패/종료 폐기를 구현한다.

### 검증

실제 반복 변환·취소/손상 문서 복구·격리·메모리. git diff --check. 실행 명령과 결과는 단계 보고서에 고정한다.

### 커밋

`Task #10 Stage 3: 변환 환경 재사용`

## Stage 4 — 자산 버전과 출력 검증

### 산출물

docs/dependencies.md, docs/architecture.md, scripts/benchmark-conversion.mjs, mydocs/working/task_m010_10_stage4.md

### 변경 내용

고정 font/helper cache 식별과 갱신 절차를 기록하고 전후 PDF/PNG를 비교한다.

### 검증

PDF raster/PNG 비교·대표 페이지 직접 시각 확인·타입/보안/Slack 전체. git diff --check. 실행 명령과 결과는 단계 보고서에 고정한다.

### 커밋

`Task #10 Stage 4: 자산 버전과 출력 검증`

## Stage 5 — Linux와 운영 수용

### 산출물

docs/cloud-run.md, mydocs/report/task_m010_10_report.md, mydocs/working/task_m010_10_stage5.md

### 변경 내용

CI와 같은 Cloud Run 사양의 후보를 검증하고 운영 전후 수치/한계를 최종 보고한다.

### 검증

Linux CI·후보/운영 Slack·사양 확인·rollback 기준. git diff --check. 실행 명령과 결과는 단계 보고서에 고정한다.

### 커밋

`Task #10 Stage 5: Linux와 운영 수용`

## 검증

단계 검증과 보고를 커밋한 뒤 다음 단계로 진행한다. 최종 성공 전에 모든 upload/변환 작업이 끝나야 한다. 전체 출력 픽셀 비교는 변경 전 동일 엔진과의 회귀 검사이며 한컴 정답지 일치를 주장하지 않는다.

## 단계 의존성

1 → 2 → 3 → 4 → 5. #8은 이 작업 결과의 운영 버전을 기준으로 시작한다.

## 위험과 대응

WASM binding singleton은 문서별 worker로 분리하고 컴파일된 Module만 공유한다. 실패/취소/시간초과 시 browser와 runtime을 교체한다. 반복 처리 수/프로세스 메모리를 제한한다. Slack 부작용은 기존 lease·idempotency 경계를 유지한다.

## 승인 요청 사항

2026-09-18 같은 스레드의 새 성능 개선 이슈 진행 지시를 위 기존 합의 범위의 구현·검증 승인으로 적용한다. 사양·엔진 버전·예산 변경은 별도 범위이다.
