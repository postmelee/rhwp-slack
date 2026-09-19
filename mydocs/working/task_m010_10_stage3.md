# Task #10 Stage 3 — 변환 환경 재사용

GitHub Issue: [#10](https://github.com/postmelee/rhwp-slack/issues/10)
구현계획서: [task_m010_10_impl.md](../plans/task_m010_10_impl.md)
Stage: 3

## 단계 목적

반복 변환의 브라우저·WASM 컴파일·고정 자산 준비를 재사용하면서 문서별 실행 상태를 분리한다.

## 산출물

| 파일 | 변경 요약 |
|---|---|
| src/conversion/convert.mjs, convert.d.mts | 브라우저와 비밀값 없는 child 감독, 유한 큐·재사용 수명·실패 폐기 |
| src/conversion/runtime-child.mjs | 고정 compiled Module·font bytes·print helper 보관, 문서별 Worker 생성 |
| src/conversion/pdf-child.mjs | 새 thread의 binding/WASM 메모리/context로 문서 처리 후 종료 |
| src/conversion/frames.mjs | EOF 대신 명시적 작업 종료 frame을 사용하는 반복 스트림, 기존 일회용 EOF 검사 유지 |
| src/conversion/font-routes.mjs | 허용된 고정 글꼴의 메모리 복사본 공급 |
| scripts/build-conversion.mjs | runtime child 사전 번들 |
| src/server/cloud/main.ts, telemetry.ts | 서버 종료 정리·busy 오류 분류 |
| tests/conversion/render.test.mjs | 실제 재사용·문서 교체·실패/취소/시간초과·유한 큐 회귀 |

## 본문 변경 정도 / 본문 무손실 여부

print DOM·폰트 공급 목록·PDF/PNG 순서와 크기 제한을 유지한다. font bytes는 worker마다 복제하고 WebAssembly.Module만 공유한다. SharedArrayBuffer 또는 문서 WASM 메모리를 공유하지 않는다. 부모 서버의 Slack 환경변수는 child/browser/thread에 전달하지 않는다.

## 검증 결과

- `node --test tests/conversion/render.test.mjs`: 5/5. 세 변환에서 compile 1회·fresh WASM init 3회, 중간 다른 형식 문서 후 PNG 동일.
- malformed input, 실행 중 abort, 1ms timeout 뒤 새 runtime의 PDF 성공.
- 대기 포함 4개 상한·초과 거절, 대기 요청 20ms timeout이 현재 문서를 취소하지 않음.
- `npm run typecheck`: 통과. `npm run test:security`: 28/28.
- `.cache/validation/task10-after`: 실제 1/2/69페이지 각 3회 모두 성공. 상세 시각 대조와 최종 시간표는 Stage 4.

## 잔여 위험

JS worker는 별도 OS 보안 sandbox가 아니다. 기존 비밀값 없는 child·외부 네트워크 차단·Chromium 격리 한계를 유지한다. runtime은 성공 20회 또는 관측 child RSS 768MiB 초과 시 다음 작업 전에, idle 5분 시 종료한다. RSS는 브라우저 전체 메모리 상한이 아니며 Cloud Run cgroup 4GiB 검증이 필요하다. Cloud Run CPU 할당 중단 시 idle timer는 재개 시 실행될 수 있다.

## 다음 단계 영향

WASM compile과 runtime_reuse 지표로 새 인스턴스/반복 작업을 구별한다. 문서 메모리는 thread 종료로 반환하며 요청 결과를 큐 tail에 캐시하지 않는다.

## 승인 요청

승인한 범위의 Stage 4 자산 버전/시각 검증으로 진행한다.
