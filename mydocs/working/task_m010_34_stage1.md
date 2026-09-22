# Task #34 Stage 1 — 내보내기 상태 원인

구현계획: [task_m010_34_impl.md](../plans/task_m010_34_impl.md)

## 목적과 산출물

같은 합성 HWP와 고정 Studio 0.8.6(f1f9c6ae)로 fresh build 후 export 경계를 계측했다. 진단 테스트는 최종 회귀 테스트로 대체한다. 제품 소스는 이 단계에서 변경하지 않았다.

## 검증 결과

`npm run build && npm run build:dev`, `playwright test tests/viewer/task34-diagnostic.spec.ts` 통과.

- 일반 `insertText`: epoch=1, seq=1, hash 동일. 오류 비재현.
- 붙여넣기 뒤 커서 이동: epoch=1, seq=1 유지. 첫 export 전 hash `842912…`, 후 `39d73d…`로 변경. 두 번째 export는 동일 바이트/상태.
- 상태 해시는 controller.ts의 `exportDocumentSha256`이 raw document export로 계산한다.
- 실제 SDK export는 WasmBridge.exportHwp → onBeforeExport → main.ts:648의 setCaretPosition → raw export를 호출한다. 커서 위치 메타데이터만 바뀌어도 이전 해시와 달라진다.
- 본문 수정 횟수가 그대로인데 export 전후 해시만 달라져 save.ts의 전체 상태 비교가 거절한다. 네트워크 요청 이전 오류다.

## 다음 단계와 위험

커서 기록을 제거하지 않는다. Slack 전용 Studio에서 커서 기록·export·반환 상태를 같은 동기 실행 안에서 묶고, 호스트는 바이트 해시와 그 상태를 대조한다. 실제 문서 교체/편집 및 업로드 중 dirty 보호를 회귀 검증한다. 수동 OS IME 전수 검증은 별도 범위다. 사용자 승인한 순차 진행 범위에서 Stage 2로 이어간다.
