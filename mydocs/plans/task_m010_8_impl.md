# 편집기 로딩 최적화·Pages 비교 구현계획서

수행계획서: [task_m010_8.md](task_m010_8.md)
GitHub Issue: [#8](https://github.com/postmelee/rhwp-slack/issues/8)
마일스톤: M010

## 단계 개요

| Stage | 제목 | 주요 산출 | 검증 |
|---|---|---|---|
| 1 | 기준 A 계측과 배포 확인 | scripts/benchmark-editor.mjs·비공개 결과·stage1 | 기존 운영 revision/사양, 최초·반복/동일·다른 문서 최소3회, 전송량·편집 준비 시간 |
| 2 | 버전 정적 자산 캐시 | 빌드 자산 manifest·editor-routes·보안/HTTP 테스트·stage2 | immutable은 검증된 버전 경로만, shell 재검증, 압축/304/HEAD/오류 no-store·구버전 호환 |
| 3 | 문서 요청과 초기화 최적화 | editor main/계측·metadata 경로·UI/API 회귀·stage3 | 권한 확인 유지·원본 다운로드1회·초기화 병렬·오류/늦은 결과 폐기·B 비교 |
| 4 | Pages C 분리 실험 | 정적 배포 산출·정확한 API/Origin 설정·stage4 | 무료 파일/헤더 한도·CORS/CSP/iframe·인증/저장·동일 B 프로그램 |
| 5 | 비교와 운영 수용 | A/B/C 요약·운영 문서·최종 보고·stage5 | Linux CI, 실제 Slack 웹/데스크톱, 비용/전송/편집 시간·보안·복구·최종 PR |

## 문서 위치 확인

수행계획서대로 제품 배포/보안 계약은 기존 docs에, 작업 계획/결과는 mydocs에, 원본과 상세 네트워크 자료는 ignored cache에 둔다. 새 공식 정적 호스팅 문서가 필요하면 docs/static-hosting.md를 사용한다.

## Stage 1 — 기준 A 계측과 배포 확인

### 산출물

scripts/benchmark-editor.mjs·비공개 결과·stage1 및 mydocs/working/task_m010_8_stage1.md.

### 변경 내용

기준 A 계측과 배포 확인. 원래 이슈의 A/B/C 조건과 권한·캐시 제외 범위를 유지한다.

### 검증

기존 운영 revision/사양, 최초·반복/동일·다른 문서 최소3회, 전송량·편집 준비 시간. 영향 범위에 맞는 typecheck·unit·Slack·security·viewer와 git diff --check를 실행하고 명령/결과를 단계 보고에 고정한다.

### 커밋

`Task #8 Stage 1: 기준 A 계측과 배포 확인`

## Stage 2 — 버전 정적 자산 캐시

### 산출물

빌드 자산 manifest·editor-routes·보안/HTTP 테스트·stage2 및 mydocs/working/task_m010_8_stage2.md.

### 변경 내용

버전 정적 자산 캐시. 원래 이슈의 A/B/C 조건과 권한·캐시 제외 범위를 유지한다.

### 검증

immutable은 검증된 버전 경로만, shell 재검증, 압축/304/HEAD/오류 no-store·구버전 호환. 영향 범위에 맞는 typecheck·unit·Slack·security·viewer와 git diff --check를 실행하고 명령/결과를 단계 보고에 고정한다.

### 커밋

`Task #8 Stage 2: 버전 정적 자산 캐시`

## Stage 3 — 문서 요청과 초기화 최적화

### 산출물

editor main/계측·metadata 경로·UI/API 회귀·stage3 및 mydocs/working/task_m010_8_stage3.md.

### 변경 내용

문서 요청과 초기화 최적화. 원래 이슈의 A/B/C 조건과 권한·캐시 제외 범위를 유지한다.

### 검증

권한 확인 유지·원본 다운로드1회·초기화 병렬·오류/늦은 결과 폐기·B 비교. 영향 범위에 맞는 typecheck·unit·Slack·security·viewer와 git diff --check를 실행하고 명령/결과를 단계 보고에 고정한다.

### 커밋

`Task #8 Stage 3: 문서 요청과 초기화 최적화`

## Stage 4 — Pages C 분리 실험

### 산출물

정적 배포 산출·정확한 API/Origin 설정·stage4 및 mydocs/working/task_m010_8_stage4.md.

### 변경 내용

Pages C 분리 실험. 원래 이슈의 A/B/C 조건과 권한·캐시 제외 범위를 유지한다.

### 검증

무료 파일/헤더 한도·CORS/CSP/iframe·인증/저장·동일 B 프로그램. 영향 범위에 맞는 typecheck·unit·Slack·security·viewer와 git diff --check를 실행하고 명령/결과를 단계 보고에 고정한다.

### 커밋

`Task #8 Stage 4: Pages C 분리 실험`

## Stage 5 — 비교와 운영 수용

### 산출물

A/B/C 요약·운영 문서·최종 보고·stage5 및 mydocs/working/task_m010_8_stage5.md.

### 변경 내용

비교와 운영 수용. 원래 이슈의 A/B/C 조건과 권한·캐시 제외 범위를 유지한다.

### 검증

Linux CI, 실제 Slack 웹/데스크톱, 비용/전송/편집 시간·보안·복구·최종 PR. 영향 범위에 맞는 typecheck·unit·Slack·security·viewer와 git diff --check를 실행하고 명령/결과를 단계 보고에 고정한다.

### 커밋

`Task #8 Stage 5: 비교와 운영 수용`

## 검증

각 Stage 검증·보고를 커밋한 뒤 다음 단계로 이동한다. 외부 계정/Slack surface가 불가하면 독립 작업은 진행하고 해당 검증을 완료로 표시하지 않는다. 최종 수용은 A/B/C 비교·변환 회귀·정적 캐시와 비공개 응답 분리·권한 회수·갱신/rollback·실제 Slack 사용이다.

## 단계 의존성

1→2→3→4→5. A는 소스 변경 전에 확보한다. C는 B와 동일한 프로그램으로 제공하고 API origin 설정만 구분한다. 운영 전환은 수용 결과로 결정한다.

## 위험과 대응

캐시 버전은 build 입력 또는 내용 해시와 묶고 오래된 shell은 재검증한다. API와 파일 응답 no-store, 정확한 origin만 허용한다. 한 테스트의 cache clear가 다른 조건에 영향을 주지 않게 브라우저 context를 분리하고 서버 cold 여부를 기록한다.

## 승인 요청 사항

같은 스레드의 #8 진행 승인으로 위 합의된 범위의 단계 작업을 진행한다. 범위·예산·권한 확대는 포함하지 않는다.

## Stage 6 — Pages C 운영 전환 (2026-09-20 추가 승인)

작업지시자가 비용·공개 배포 관점의 C 권장안을 확인한 뒤 “C 방식으로 전환할 수 있어?”로 실행을 요청했다. Stage 5의 B 선택을 이 후속 단계에서 C로 전환한다. 별도 기능 이슈나 브랜치를 만들지 않고 열린 #8 / PR #12에 반영한다.

1. 기존 B 운영 revision·worker·Pages lab을 복구 기준으로 보존한다. 이미 검증한 동일 이미지·프로그램 namespace로 운영 Pages 프로젝트 `rhwp-slack-editor`를 준비한다. API 주소는 운영 Cloud Run이다.
2. Slack embed에 정확한 Pages hostname을 추가하고 기존 domain·sandbox 권한을 보존한다. ingress 새 revision에 EDITOR_ORIGIN만 설정한다. 서버 사양·예산·Slack 수신 URL·worker는 유지한다.
3. HTTP/인증/CORS/자산·독립 브라우저 검사 후 실제 Slack 웹/데스크톱의 내부 편집·같은 스레드 저장·PDF/PNG를 확인한다. B→C→B→C 전환과 기존 카드 재진입을 검증해 복구 항목을 보완한다.
4. 결과·최종 선택·복구 명령을 `mydocs/working/task_m010_8_stage6.md`, 기존 최종 보고서·`docs/cloud-run.md`·`docs/static-hosting.md`·오늘할일 및 PR/이슈에 갱신한다. 문서 위치는 기존 계획과 같다.

전환 실패 시 B 리비전으로 복구한다. 문서/티켓/세션/토큰은 Pages 정적 산출물에 포함하지 않는다. 기존 사용자 승인 범위로 진행하며 새 권한·비용 설정을 추가하지 않는다.
