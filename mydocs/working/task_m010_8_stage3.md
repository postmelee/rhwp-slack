# #8 Stage 3 — 문서 조회·초기화 병렬화

GitHub Issue: [#8](https://github.com/postmelee/rhwp-slack/issues/8)
구현계획서: [task_m010_8_impl.md](../plans/task_m010_8_impl.md)
Stage: 3

## 단계 목적

원본 다운로드 중복과 순차 대기를 제거하되 매 요청의 권한 검사·취소를 유지한다.

## 산출물

- `src/server/editor-routes.ts`: metadata는 현재 문서 접근 권한만 검사하고 이름/형식을 반환한다. 원본 파일 다운로드와 fresh authorization/hash 검증은 source 경로에서 한 번 수행한다.
- `src/editor/main.ts`: 티켓 교환 성공 후 Studio 초기화·metadata·source를 동시에 시작한다. 모두 성공한 뒤에만 loadFile/저장 기능을 활성화한다. 실패 시 진행 중 요청/Studio 및 늦게 반환된 Studio를 취소/폐기한다.
- 개인정보 없는 `rhwp:*` Performance mark: host, 요청 headers, metadata/source 완료, Studio 준비, 문서 load, editor-ready. 외부 telemetry로 전송하지 않는다.
- API 테스트와 UI의 지연된 Studio/원본 실패/timeout 회귀 테스트 보강.

## 본문 변경 정도 / 본문 무손실 여부

문서 조판·변환·저장 파일 포맷은 그대로다. 상태가 잘못된 원본은 source 검증에서 거부하며 metadata 성공만으로 편집할 수 없다.

## 검증 결과

- `npm run typecheck`: 통과.
- `npm run test:security`: 29/29 통과. metadata만으로 원본 다운로드 0회, 이후 source에서 1회, 권한 회수 후 두 경로 모두 거부.
- `npm run build && npm run build:dev`: 통과.
- `npx playwright test tests/viewer/startup.spec.ts tests/viewer/cache.spec.ts tests/viewer/slack-flow.spec.ts`: 6/6 통과. Studio 응답을 멈춰도 원본을 먼저 받고, 둘 다 성공한 후 편집/저장 버튼을 활성화한다. 실제 HWP 수정본→같은 스레드→실제 PDF/PNG 생성까지 확인했다.

## 잔여 위험

운영 A와 같은 네트워크에서의 B 성능 수치는 아직 측정하지 않았다. 캐시 적용의 로컬 재사용 및 병렬 동작은 검증됐지만 실제 Cloud Run 시간으로 확대 해석하지 않는다. 서로 다른 origin 비교를 위한 Stage 4 설정 완료 후 같은 빌드의 B/C를 함께 측정한다.

## 다음 단계 영향

C는 B와 동일한 JS/WASM/font를 배포하고 shell의 API origin 설정만 구분한다. 운영 트래픽을 유지한 비교 revision에서 A/B/C를 측정한다.

## 승인 요청

기존 #8 진행 승인 범위로 Stage 4를 계속한다. 운영 100% 트래픽은 기존 #10을 유지한다.
