# Task #34 Stage 2 — 일관된 저장 스냅샷

구현계획: [task_m010_34_impl.md](../plans/task_m010_34_impl.md)

## 구현

`studio/vite.config.ts`의 Slack 전용 overlay에서 커서 기록을 포함한 export와 후속 상태 캡처를 한 동기 작업으로 묶었다. `src/editor/save-snapshot.ts`는 반환된 실제 바이트의 SHA-256을 캡처 상태와 대조한다. `save.ts`의 Slack 저장과 연결 실패 시 다운로드가 이 공통 결과를 사용한다. 업로드 후 epoch/seq/hash 일치 검사, 동시 편집 dirty 보호, 재시도의 동일 요청 ID·바이트 보존은 유지했다.

## 검증

- 수정 전 동일 회귀: HWP 첫 저장 실패(내보내는 동안 문서가 변경됨), HWPX 통과. HWPX 결함 재현으로 주장하지 않는다.
- 수정 후 저장 검사 6개 모두 통과: HWP/HWPX 한글 붙여넣기·커서 이동 후 첫 저장과 실제 저장 바이트 내용, 업로드 중 추가 편집, 실패 후 같은 바이트 재시도, 잘못된 해시의 업로드 차단.
- `npm run build`, `npm run build:dev`, `npm run typecheck` 통과.
- 전체 Playwright 32/32, security 53/53, unit 10/10 통과. 원본 저장 바이트를 WASM으로 다시 열어 입력 내용도 검사했다.
- 첫 전체 실행은 sandbox의 listen EPERM으로 서버가 시작되지 않았다. 허용된 로컬 서버 실행으로 재실행한 결과가 위 수치다. 제품 실패로 분류하지 않는다.

## 범위와 다음 단계

고정 upstream Studio/core 0.8.6을 유지한다. 조판/글꼴/변환 서버/권한 변경은 없다. 임시 진단 테스트는 정식 회귀로 대체해 제거했다. Linux CI와 공개 Pages 배포 후 새 Slack 편집 세션의 첫 저장을 검증한다. OS별 IME 조합 전체는 미검증이다.
