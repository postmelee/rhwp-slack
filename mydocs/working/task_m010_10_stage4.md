# Task #10 Stage 4 — 자산 버전·출력·반복 검증

GitHub Issue: [#10](https://github.com/postmelee/rhwp-slack/issues/10)
구현계획서: [task_m010_10_impl.md](../plans/task_m010_10_impl.md)
Stage: 4

## 단계 목적

고정 자산과 컴파일 결과의 버전 혼합을 방지하고 동일 출력·반복 변환 효과를 검증한다.

## 산출물

| 파일 | 변경 요약 |
|---|---|
| scripts/build-conversion.mjs | core/editor/Studio 버전 일치, WASM·JS·print·font·child 해시와 Node/Playwright 버전으로 runtime 식별 |
| src/conversion/runtime-child.mjs, convert.mjs | 고정 빌드 해시 검증, cacheKey 변경 시 환경 교체 |
| scripts/benchmark-conversion.mjs | 기본 재사용/--fresh-runtime 비교 모드와 종료 정리 |
| scripts/container-smoke.mjs, src/server/main.ts | 검증 도구·로컬 서버 종료 시 재사용 프로세스 정리 |
| tests/conversion/render.test.mjs | 22회 연속 처리 중 환경 재생성·출력 일치 |
| docs/dependencies.md, architecture.md, cloud-run.md | 재사용 범위·수명·업스트림 묶음 갱신/rollback 절차 |

## 본문 변경 정도 / 본문 무손실 여부

공식 문서 기존 내용을 보존하고 해당 운영 절차만 확장했다. 렌더링 규칙·폰트 bytes·엔진 0.8.6은 유지한다.

## 검증 결과

- `npm run typecheck`, `npm test`, `npm run test:slack`, `npm run test:security`: 각각 통과, 9/81/28개 통과.
- `npm run test:viewer`: Playwright 22개 완료(기존 Studio 0.8.6 mixed-format undo의 expected failure 포함), 변환 6/6. 새 실패 없음.
- 반복 22회 실제 변환: 1회 이상 재사용, 2회 이상 환경 준비, PNG 동일. 손상·취소·timeout 뒤 복구 테스트 포함.
- `.cache/task10-bench.mjs`: 같은 4문서 각 3회, 총 12/12. 19d33b9 기준은 매 호출 새 child/browser, 변경 후는 최초 준비 이후 환경 재사용. Node24.15/macOS ARM이며 Cloud Run/Slack API 시간은 아니다.

| 입력 | 변경 전 중앙값 ms | 변경 후 중앙값 ms |
|---|---|---|
| 복학원서 1페이지 | 1030 | 856 |
| 합성 HWP 2페이지 | 640 | 476 |
| 합성 HWPX 2페이지 | 655 | 472 |
| 사양서 HWP 69페이지 | 9638 | 9056 |

첫 요청은 Node 모듈 로딩과 OS cache 영향을 포함한다. 3회 소표본이며 긴 문서 개선폭을 서버 성능 보장으로 일반화하지 않는다. 상세 값/지표: `.cache/validation/task10-before/results.json`, `task10-after-final/results.json`.

`pdftoppm -r 96 -png`와 Pillow 비교: PDF 74페이지 pixel 일치, PNG 8장 byte 일치. 최종 증적 `.cache/validation/task10-visual-final/results.json`. 복학원서 표·로고·접수증, 합성 표, 사양서 목차·마지막 페이지의 실제 출력도 직접 확인했다. 변경 전 앱과의 회귀 비교이며 독립 한컴 출력 일치를 주장하지 않는다.

## 잔여 위험

Linux/Cloud Run 실제 Slack 전후 검증은 Stage 5에 남아 있다. Chromium 프로세스의 내부 해석/OS allocator 잔류까지 지우는 보안 sandbox를 주장하지 않으며 문서별 context와 JS/WASM 실행 객체의 수명을 분리한다.

## 다음 단계 영향

Stage 5는 현재 사양으로 Linux CI·후보를 검증한 뒤 실제 Slack 게시 시간을 확인한다. 운영 버전은 아직 #2 배포 그대로이다.

## 승인 요청

승인된 순서에 따라 Stage 5를 진행한다.
