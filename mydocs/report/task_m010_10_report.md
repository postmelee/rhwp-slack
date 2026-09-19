# Task #10 최종 보고서 — 첫 이미지 게시 단축·변환 환경 재사용

GitHub Issue: [#10](https://github.com/postmelee/rhwp-slack/issues/10)
마일스톤: M010
완료 기록: 2026-09-20 01:28 KST

## 작업 요약

- 대상 이슈 #10, M010, Stage 1–5 완료. 선행 PR #9는 `19d33b9`로 병합했고 #2를 닫았다.
- PDF 업로드·공유를 기다리던 PNG 게시를 독립 실행하고, 같은 worker의 Chromium·컴파일된 WASM·고정 글꼴/print helper를 재사용한다.
- 문서마다 새 JS/WASM 실행 환경과 browser context를 만들고 폐기한다. 실패·취소·시간초과·자산 변경과 수명 정책으로 runtime을 교체한다.
- 최종 실행 소스 `93943c721c78f9a78de0fe1477e8d1a699d3c982`를 기존 Cloud Run 사양·권한·예산으로 운영 반영했다. 이후 커밋은 보고서·운영 문서만 변경한다.

## 변경 파일 목록과 영향 범위

| 경로 | 변경 요약 | 영향 범위 |
|---|---|---|
| `src/server/cloud/application.ts` | PDF/PNG 독립 bounded pool, 모든 작업 회수, 카드 쓰기 직렬화·중복 최종 갱신 제거 | Slack 게시 순서·재시도 |
| `src/conversion/convert.mjs`, `runtime-child.mjs`, `pdf-child.mjs`, `frames.mjs`, `font-routes.mjs`, `convert.d.mts` | credential-free runtime, 문서별 worker/context, 고정 자산 재사용, 요청별 지표 문맥·종료 프레임 | 서버 변환·취소·환경 수명 |
| `src/server/cloud/main.ts`, `src/server/main.ts`, `src/server/cloud/telemetry.ts` | 서버 종료 정리·compile/reuse 계측 허용 | 서버 수명·관측 |
| `scripts/build-conversion.mjs`, `benchmark-conversion.mjs`, `container-smoke.mjs` | 자산/버전 해시, fresh/repeated 측정, 실제 컨테이너 회귀 | 빌드·검증 |
| `tests/conversion/render.test.mjs`, `tests/slack/cloud-application.test.ts`, `tests/unit/dev-documents.test.mjs` | 실제 재사용·오류 복구·격리·병렬 게시, 빌드 전/후 timeout 분리 | 회귀 방지 |
| `docs/dependencies.md`, `docs/architecture.md`, `docs/cloud-run.md` | 재사용 범위·업스트림 묶음 갱신·운영/복구 기준 | 공식 제품/운영 문서 |
| `mydocs/plans/task_m010_10*.md`, `mydocs/working/task_m010_10_stage*.md`, 이 보고서·오늘할일 | 계획·단계·증적·최종 결과 | 내부 작업 기록 |

## 문서 위치 검증

| 파일 | 계획된 위치 | 실제 위치 | 결과 | 근거 |
|---|---|---|---|---|
| 의존성·아키텍처·Cloud Run | 기존 `docs/` 문서 확장 | `docs/dependencies.md`, `architecture.md`, `cloud-run.md` | OK | 수행계획서 문서 위치 판단과 일치 |
| 계획·단계·최종 결과 | `mydocs/plans`, `working`, `report` | 동일 | OK | 구현계획서 Stage 1–5 산출물 |
| 입력·출력·상세 실행 자료 | ignored `.cache/validation` | 동일 | OK | 원본 문서·비밀값을 Git에 포함하지 않음 |

## 변경 전·후 정량 비교

동일 Cloud Run worker 2CPU/4GiB, min0/max1, 동시1, PNG 업로드1, us-central1. 전 `19d33b9`, 후 `93943c7`. 각 입력 최초 1회와 같은 서버에서 반복 2회, 버전별 총 12회 모두 시도1 성공.

**preview 작업 시작 → 첫 PNG Slack 공유 확인** 시간이다. 사용자 업로드부터 Slack 화면에 그려지기까지의 전체 시간은 아니다.

| 입력 | 최초 전 → 후 (초, 각 1회) | 반복 전 → 후 (초, 각 2회 중앙값) |
|---|---|---|
| 복학원서 HWP 1페이지 | 21.11 → 15.17 | 16.04 → 9.65 |
| 합성 HWP 2페이지 | 13.98 → 19.38 | 11.98 → 9.24 |
| 합성 HWPX 2페이지 | 16.92 → 11.57 | 11.27 → 8.61 |
| 사양서 HWP 69페이지 | 47.98 → 51.23 | 44.79 → 45.00 |

단문 반복 요청에서 약 24–40% 단축됐고 장문은 약 45초로 비슷했다. HWP 2페이지의 최초 실행은 오히려 느렸고 browser 시작·Slack 업로드 지연이 증가했다. 변경 전후 날짜가 다르고 표본이 작으므로 최초 실행과 모든 문서의 속도 개선을 보장하지 않는다. 상세 단계/시점은 [Stage 5](../working/task_m010_10_stage5.md)에 있다.

| 지표 | 변경 전 | 변경 후 |
|---|---|---|
| PDF 게시를 기다리는 PNG 업로드 | 대기 | 독립 시작; 실제 최초 1페이지 PNG 공유 15.174초, PDF 준비 17.061초 |
| 12회 후보에서 runtime 준비 | 호출마다 새 child/browser | WASM compile 4회, reuse 8회 |
| 요청 간 문서 WASM 메모리·browser context | 새로 생성 | 새로 생성 유지 |
| 실제 Cloud PDF 회귀 비교 | 기준 74페이지 | 96dpi raster 74/74 pixel 일치 |
| 실제 Cloud PNG 회귀 비교 | 기준 8장 | 8/8 byte 일치 |

로컬 ARM/Node24.15에서 각 3회 중앙값은 1페이지 1030→856ms, HWP 2페이지 640→476ms, HWPX 2페이지 655→472ms, 69페이지 9638→9056ms였다. Slack 네트워크를 포함한 위 Cloud 결과와 구분한다.

## 검증 결과

| 수용 기준 | 결과 |
|---|---|
| PDF 업로드가 첫 PNG 게시를 막지 않음 | OK — PDF 완료를 붙잡은 Slack 테스트에서 PNG 시작 확인; 실제 후보에서 PNG가 PDF보다 먼저 공유된 사례 확인 |
| 모든 게시 작업 회수와 재시도·권한 경계 보존 | OK — Slack 81개, 보안 28개; PDF/PNG 실패 후 완료 receipt 유지, lease 소실 회귀 |
| 컴파일 결과·브라우저 재사용, 문서별 메모리/context 분리 | OK — 실제 변환 9개, 22회 연속 수명 재생성·출력 동일; 후보 compile 4/reuse 8 |
| 손상 문서·취소·timeout 후 복구 | OK — queued deadline은 기존 runtime 보존, active timeout은 폐기 후 다음 변환 성공 |
| 요청별 지표 귀속 | OK — 지속 IPC의 최초 요청 문맥 재현 후 AsyncResource binding 적용; 두 문서의 compile/init/reuse 귀속 검증 |
| 자산 버전 혼합 방지 | OK — core/editor/Studio 버전과 WASM/JS/font/helper 해시로 식별·검증; 엔진 0.8.6 유지 |
| 출력·줄바꿈 회귀 | OK — PDF 74페이지/PNG 8장 동일, 표·접수증·목차·마지막 페이지 직접 시각 확인 |
| Linux·컨테이너 | OK — [최종 소스 CI](https://github.com/postmelee/rhwp-slack/actions/runs/35452975340)의 viewer/container 성공, 타입/unit 9/Slack 81/보안 28/UI 22/변환 9 |
| 메모리·권한·사양 | OK — 비root·read-only·network none·2CPU/4GiB container OOM kill 0; 서버 peak 721,715,200 bytes, Studio 포함 peak 1,162,104,832 bytes |
| 같은 사양 운영 연결 | OK — 운영 합성 변환 2회 PDF/PNG 성공, 인증 교환·문서·원본·편집기 host·Studio 200, 무인증 원본 403 |
| 운영 저장·스레드 | OK — 합성 원본을 저장 API로 전송, 수정본 1개 PDF/PNG 완료·원래 스레드 유지 |
| 운영 복구·시험 서버 정리 | OK — 이전 revision 보존, 시험 큐 비움·별도 성능 worker 삭제, 운영 두 서비스만 유지 |

### 단계별 검증 결과

- [Stage 1](../working/task_m010_10_stage1.md): 변경 전 입력·출력·로컬 시간 기준 확보.
- [Stage 2](../working/task_m010_10_stage2.md): 독립 게시와 실패/receipt/lease 회귀.
- [Stage 3](../working/task_m010_10_stage3.md): 유한 재사용 runtime·문서 격리·오류 복구.
- [Stage 4](../working/task_m010_10_stage4.md): 빌드 자산 고정·22회 반복·전후 출력 직접 비교.
- [Stage 5](../working/task_m010_10_stage5.md): 최종 Linux CI·동일 Cloud Run 비교·운영 수용·복구 기준.

### 운영 버전

- ingress: `rhwp-ingress-00012-6hv` 100%, 이전 `rhwp-ingress-00011-l6z`.
- worker: `rhwp-worker-00008-6t7` 100%, 이전 `rhwp-worker-00007-jbt`.
- 이미지 AMD64 digest: `sha256:bda18bbfb4cd3182e5692749beea87b531107bc37ec707a6f18fac24b8f5906a`.
- 같은 workspace namespace·Slack 주소·비밀값 버전·사양·월 한도를 유지했다. 복구 시 위 이전 revision으로 트래픽을 되돌리고 Firestore를 유지한다.

## 잔여 위험과 후속 작업

### 잔여 위험

- 재사용은 인스턴스 수명 안에서만 가능하다. 성공 20회, 직전 child RSS 768MiB 초과, idle 타이머 5분, 실패/취소/자산 변경 시 교체한다. Cloud Run CPU가 정지된 유휴 시간에는 타이머 실행이 늦어질 수 있다.
- 장문 DOM 생성·문서별 font decode/적용·PDF/PNG 렌더와 Slack 공유는 남는다. 모든 폰트 준비를 없앤 것이 아니며, 이번 단계는 renderer 자체를 변경하지 않았다.
- JS worker/context 수명 분리는 별도 OS sandbox와 같지 않다. 실측 메모리 peak는 임의 문서의 상한 보장이 아니다.
- 시각 비교 기준은 동일 앱의 변경 전 출력이며 한컴 정답지 일치가 아니다. UI 22개에는 기존 upstream 0.8.6 mixed-format undo expected failure가 포함된다. 이번 운영 수용은 HTTP/API 저장 확인이며 동료의 데스크톱 클릭·타이핑을 재현한 검증은 아니다.
- 로컬 상세 자료는 ignored cache다. CI artifact는 보존 기간 후 만료될 수 있으므로 이 문서·단계 보고서의 수치와 조건을 장기 기록으로 삼는다.

### 후속 작업 후보

- [#8](https://github.com/postmelee/rhwp-slack/issues/8): 이번 운영 버전을 기준으로 편집기 정적 로딩·Pages 분리를 별도로 진행한다.
- 장문은 DOM 생성/글꼴 적용 시간을 먼저 분석한 뒤 변경 전후 출력으로 검증한다. 이번 결과만으로 VM 이전·사양 증설을 결정하지 않는다.
- 업스트림 업데이트는 core/editor/Studio·JS/WASM·글꼴/helper를 한 묶음으로 고정해 새 이미지에서 검증한다. 파일 하나만 바꾸는 hot swap이나 최신 자동 배포는 이번 범위에 포함하지 않았다.

## 작업지시자 승인 요청

기존의 새 성능 개선 이슈 진행·검증·원격 게시 승인으로 PR까지 준비한다. #10의 새 PR 병합은 별도 검토 대상으로 남긴다. PR #9의 이전 원격 브랜치는 삭제 승인이 없어 유지했다.
