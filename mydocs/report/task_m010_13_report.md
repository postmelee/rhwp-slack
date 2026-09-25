# Task #13 — 편집 API 계측과 중복 조회 개선 보고

Issue: [#13](https://github.com/postmelee/rhwp-slack/issues/13), M010.

## 결과

편집 HTTP 요청에서 원본/API 지연을 구분할 수 있도록 고정 operation과 Slack/Firestore stage 시간을 기록한다. 원본 다운로드 전 이미 검증한 파일 정보를 같은 함수 호출에서 재사용하여 중복 조회를 줄였다. 다운로드 후 최신 권한과 내용 해시 검사는 유지한다.

구현·로컬 검증 완료. 이 보고서는 실제 운영 속도 개선·비용 절감 또는 운영 배포 완료 보고가 아니다. 브랜치는 OPEN인 PR #12의 `4d26ac8`에서 분리했으며 통합 시 그 의존성을 해결해야 한다.

## 변경 범위와 문서 위치

| 파일 | 변경 |
|---|---|
| `src/server/cloud/telemetry.ts`, `src/server/editor-routes.ts` | API context·상태·고정 operation·외부 단계 측정 |
| `src/server/slack-api.ts`, `src/server/cloud/firestore-metadata.ts` | 인수·응답을 받지 않는 시간 계측 |
| `src/server/cloud/application.ts` | 다운로드 전 검증된 SourceFile 재사용, 사후 검사 유지 |
| `tests/slack/{telemetry,cloud-application}.test.ts` | 비밀값·동시성·실패·권한 회수·호출 수 회귀 |
| `docs/architecture.md` | 운영 계측 계약; 수행계획의 기존 제품 docs/ 위치와 일치 |
| `mydocs/plans/`, `mydocs/working/`, 본 보고서 | 계획·단계 검증·장기 보관; 계획된 위치와 일치 |

## 동일 입력의 전후 비교

기준: `a20d51c`(계측 도입, 최적화 전), 변경: `30e7f0d`.
단일 멤버 목록 페이지의 합성 `ensureSource` 호출, 원본/수정본별 전후 각3회.

| 지표 | 변경 전 | 변경 후 |
|---|---|---|
| 원본 Slack 논리 호출 | 9 | 6 |
| 수정본 Slack 논리 호출(root 검사 포함) | 15 | 12 |
| metadata get(양쪽 경로) | 5 | 4 |
| 파일 다운로드(양쪽 경로) | 1 | 1 |

각3회 결과가 같았다. HTTP 세션 확인 등 `ensureSource` 바깥의 호출은 제외했다. Slack 내부 재시도·Firestore 실제 read 과금·실제 지연을 측정한 값으로 해석하지 않는다. 운영 전후 초 단위 비교와 월 절감액은 미측정이다.

## 검증

Source SHA `30e7f0d86e89b9212e0a2231dc781737499fdb48`, Node24.21.0, macOS ARM64에서 typecheck와 unit9·Slack86·security30개(합계125개) 통과. 최종 문서 diff의 whitespace도 확인했다.

- [Stage 1](../working/task_m010_13_stage1.md): 동시 API context, 로그 민감값 배제, 실패 상태, 실제 Slack/Firestore adapter wrapping.
- [Stage 2](../working/task_m010_13_stage2.md): 원본/수정본 호출 수와 다운로드 중 권한 회수·root 공유 해제·무효화·해시 변경 거부.
- [Stage 3](../working/task_m010_13_stage3.md): 전체 회귀 및 계측 해석 문서.

권한 캐시·bytes 캐시를 새로 도입하지 않았다. 엔진·WASM·글꼴·PDF/PNG 출력 코드는 변경하지 않아 별도 조판 시각 비교 대상이 아니다. Linux CI 결과는 PR checks에 별도로 기록하며 이 로컬 결과로 대신하지 않는다.

## 운영 적용 전 남은 일

1. PR #12를 포함한 통합 head의 Linux CI와 컨테이너 검증.
2. 운영과 분리한 후보 환경에서 동일 문서·원본/수정본·권한 회수 테스트. 콜드/웜 상태와 반복 횟수를 함께 기록.
3. handler·authorize·Slack/Firestore·download 구간을 대조하고 중첩 시간을 중복 합산하지 않는다. 클라이언트 전체 체감 시간은 별도 측정한다.
4. 승인된 운영 사양과 월 예산을 유지하며 후보 확인 후 전환. #3 실제 비용 관찰과 #4 외부 배포는 별도 추적한다.

로그 항목 추가에 따른 수집량과 비용도 후보 환경에서 확인한다. 계측만으로 DB/Slack 호출의 정밀 과금량을 알 수는 없다. 비교 lab/tag의 삭제나 운영 자원 정리는 이 변경에 포함하지 않는다.
