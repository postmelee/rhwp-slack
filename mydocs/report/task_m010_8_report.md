# #8 최종 보고 — 편집기 로딩 최적화와 Pages 비교

GitHub Issue: [#8](https://github.com/postmelee/rhwp-slack/issues/8)
마일스톤: M010

## 작업 요약

- 대상 이슈 #8, 6개 Stage와 Stage 4.1로 구현·비교·운영 수용을 진행했다.
- 정적 프로그램에 버전 캐시와 압축을 적용하고, 중복 원본 다운로드를 제거하며 Studio 초기화와 문서 요청을 병렬화했다.
- **운영은 C: Pages 프로그램 + Cloud Run API로 전환했다.** B/C의 속도 차이가 작아 프로그램 전송 비용 분리를 선택했다. 실제 월 절감액은 미측정이다.
- 서버 사양·변환 worker·엔진·권한·예산을 유지했다. 실제 Slack 웹/데스크톱에서 내부 편집·같은 스레드 저장·PDF/PNG 완료를 확인했다.

실행 소스: `c6e609dcf3af0ff2d8f546ac91c3bc015f419121`. 이후 커밋은 문서다. 운영 ingress `rhwp-ingress-task8-c1`, worker `rhwp-worker-00008-6t7`; 각 100%. 비교 수치는 [Stage 5](../working/task_m010_8_stage5.md), 최종 C 배포·실제 Slack·복구 증거는 [Stage 6](../working/task_m010_8_stage6.md)에 있다.

## 변경 파일 목록과 영향 범위

| 경로 | 변경 요약 | 영향 범위 |
|---|---|---|
| `scripts/static-version*`, `build-static.mjs`, `build-host.mjs`, Vite 설정, `Dockerfile` | 빌드 입력 기반 버전·manifest·Brotli/gzip | 공개 프로그램 파일 |
| `src/server/static-assets.ts`, receiver·application 연결 | manifest 허용 경로·immutable·표현별 ETag·HEAD/304·구버전 거부 | 정적 HTTP |
| `src/editor/main.ts`, `src/server/editor-routes.ts` | 중복 원본 다운로드 제거·병렬 준비·실패 취소·mark | 편집기 초기 로딩 |
| `config.ts`, `documents.ts`, `editor-policy.ts`, `scripts/export-pages.mjs` | 고정 API origin·정확한 CORS·CSP·Pages export | 선택적 정적 호스팅 분리 |
| `tests/security/*`, `tests/viewer/*`, `scripts/benchmark-editor.mjs` | 캐시·권한·새 창·병렬·교차 origin·계측 | 회귀와 성능 측정 |
| `.env.example`, `docs/architecture.md`, `docs/static-hosting.md`, `docs/cloud-run.md` | 배포·인증/문서 처리·현재 C·복구 절차 | 제품 운영 문서 |
| `mydocs/plans`, `mydocs/working`, 본 보고서·오늘할일 | 승인된 범위와 검증 증거 연결 | 작업 기록 |

## 문서 위치 검증

| 파일 | 계획된 위치 | 실제 위치 | 결과 | 근거 |
|---|---|---|---|---|
| 아키텍처·운영 안내 | 기존 `docs/` | `docs/architecture.md`, `docs/cloud-run.md` | OK | 기존 공식 운영 문서 갱신 |
| 정적 호스팅 계약 | `docs/static-hosting.md` | 동일 | OK | 구현계획서에서 확정한 신규 제품 문서 |
| 환경 예시 | `.env.example` | 동일 | OK | 비밀값 없이 선택적 origin 설명 |
| 계획·단계·최종 결과 | `mydocs/`의 해당 역할 | plans/working/report/orders | OK | 수행·구현 계획과 일치 |

## 변경 전·후 정량 비교

편집 준비 시간은 각 조건 n=3의 중앙값이며 **서버 warm, 브라우저 캐시 cold/warm** 비교다. navigation부터 저장 버튼 표시까지로, 티켓 발급과 Slack 카드 클릭부터의 전체 시간은 제외한다.

| 지표 | A 기존 | B Cloud Run 최적화 | C Pages |
|---|---:|---:|---:|
| 최초 열기 | 10.818초 | **5.610초** | 6.412초 |
| 동일 문서 재접속 | 10.396초 | **4.557초** | 4.376초 |
| 다른 문서 재접속 | 12.094초 | **4.059초** | 4.897초 |
| 최초 정적 전송 | 12,394,784B | **3,543,521B** | 3,995,871B |
| 재접속 정적 전송 | 12,394,784B | **0B** | 0B |
| 편집 준비 성공 | 9/9 | 9/9 | 9/9 |

정적 전송은 Studio iframe HTML을 포함한 프로그램 9개만의 Resource Timing이며, 최상위 HTML·문서/API·Slack 전체 트래픽이 아니다. C cross-origin API의 0은 TAO 제한으로 캐시 적중에 포함하지 않았다. 조건별 범위·각 표본·단계별 API/Studio/source/load는 [Stage 5 비교표](../working/task_m010_8_stage5.md)에 보존했다. 단일 회선의 순차 측정이며 p95·통계적 유의성·월 총비용 절감을 주장하지 않는다.

B 비교 revision의 22분 관찰 창에서 활성 billable time 60.9초·인터넷 전송 11.13MB를 관찰했다. 활성 compute 단가만 적용한 약 $0.0016은 **무료 할당/크레딧 전 추정**이며 월 청구가 아니다. 운영 min1 대기·요청·문서 API·변환·스토리지 등은 별도다. 예산/서버 변경 없음.

## 검증 결과

| 수용 기준 | 결과 |
|---|---|
| 선행 #2/#10과 기준 A 고정 | OK — #11 merge cef52f1, 운영 소스/이미지/revision을 Stage 1에 고정 |
| A/B/C 비교와 판정 | OK(측정 범위 한정) — 27/27 준비·전송·API/초기화 기록. 성능 비교 후 프로그램 전송 비용 분리를 위해 C 선택 |
| 실제 Slack 웹/데스크톱 | OK — 내부 열기·편집·같은 원본 스레드 수정본 4/5(B) 및 7/8(C)·PDF/PNG 완료. Slack 기본 PDF 뷰어는 B 단계에서 확인 |
| HWPX·긴 HWP | OK — 2/69페이지 편집기 열기와 실제 PDF/PNG 작업 attempt 1 완료 |
| 보안 경계 | OK — 기존 권한/티켓/사용자·workspace 격리 회귀 + 정확한 Origin 거부 |
| 공개 프로그램만 캐시 | OK — 새 창 문서 없음·JS/WASM/WOFF2 재사용·비공개 no-store·manifest 밖 404 |
| 버전 갱신·복구 | OK(범위 명시) — legacy 재검증/다른 버전 거부 회귀, B→C→B→C 실제 트래픽 전환·기존 편집본 재진입 |
| 비용·병목·운영 결정 | OK(추정 범위 명시) — B/C 혼합 서버 지표와 전송 비교, 월 순청구 미측정, C 운영 선택 |

### 자동·원격 검증

[Linux CI 35459270890](https://github.com/postmelee/rhwp-slack/actions/runs/35459270890), 실행 소스 c6e609d의 viewer/container 모두 성공:

- typecheck, unit 9, Slack 81, security 30 통과.
- viewer 25개 기대 결과 충족(기존 엔진 mixed-format undo의 기대 실패 정책 포함), conversion 9 통과.
- canonical Dockerfile smoke/release, 네트워크 격리 합성 Slack, 운영과 같은 2CPU/4GiB 서버 PDF 통과.
- Stage 5–6·최종 보고서 변경은 문서뿐이며 제품 코드에 이전 결과를 적용해도 소스 차이가 없다. 최종 PR head의 자동 CI 상태는 PR Checks가 정본이다.

배포 이미지는 로컬 canonical AMD64 release 앱 산출물을 기존 운영 OS/의존성 이미지 위에 복사한 것이다. native Linux CI는 같은 소스를 별도로 검증했다. Mac ARM AMD64 에뮬레이션 smoke의 Go panic을 통과로 취급하지 않았다.

### 단계별 검증 결과

- [Stage 1](../working/task_m010_8_stage1.md): 기준 A 고정·측정기·첫/반복/다른 문서 계측.
- [Stage 2](../working/task_m010_8_stage2.md): 버전·압축·manifest·캐시와 구버전 HTTP 계약.
- [Stage 3](../working/task_m010_8_stage3.md): 원본 1회 다운로드·병렬 초기화·오류 취소.
- [Stage 4.1](../working/task_m010_8_stage4.1.md): API origin·CORS/CSP·Pages exporter·교차 origin 저장.
- [Stage 4](../working/task_m010_8_stage4.md): 실제 Pages 배포·identity 일치·원격 HTTP·Linux CI.
- [Stage 5](../working/task_m010_8_stage5.md): 비교·비용·운영 B·실제 Slack·복구 범위.
- [Stage 6](../working/task_m010_8_stage6.md): 운영 C·Slack 웹/데스크톱 편집·저장·B/C 복구 실증.

## 잔여 위험과 후속 작업

### 잔여 위험

- C 운영 전환과 실제 Slack embeds·복구 실험을 완료했다. 새 운영 Pages hostname의 n=3 성능 측정은 반복하지 않았고 비교표는 Stage 5의 lab 측정이다.
- 서버 cold·Slack 카드 클릭부터의 전체 시간·개별 글꼴·월 순청구·69페이지 전수 품질은 이번 검증으로 확정하지 않는다.
- 데스크톱 UI 자동 타이핑 제어가 불안정해 실제 붙여넣기·저장으로 검증했다. 웹 키보드 입력은 성공했다.
- 브라우저 캐시가 제거되면 최초 비용이 다시 발생한다. 프로그램 재사용이 문서 영구 저장이나 WASM 실행 인스턴스 공유를 뜻하지 않는다.
- 기존 엔진 mixed-format undo 한계는 유지한다. 소스/권한을 캐시해 개선 수치를 만드는 방식은 사용하지 않았다.

### 후속 작업 후보

- 인증된 원본 전달/API 단계의 병목을 더 세분화하고 실제 워크스페이스에서 관찰한다.
- 이후 엔진/프로그램 버전 갱신마다 자산 identity와 해당 배포의 수용·복구를 다시 검증한다.
- 재검토가 끝나면 Pages lab·`editor-b` 비교 tag의 보존 필요성을 판단한다.
- 월 순청구·사용량은 기존 운영 관찰 #3에서 추적한다. 서버 증설·Marketplace #4는 본 PR 범위 밖이다.

## 작업지시자 승인 요청

같은 스레드의 #8 구현·계속 진행·원격 push/Linux CI 승인으로 Open PR 게시까지 진행한다. 이번 변경은 **리뷰 대기**이며 #8 병합·이슈 close는 하지 않았다. 구버전 HTTP 회귀와 이번 B/C 복구 실증의 범위·한계를 구분해 리뷰어가 판단할 수 있게 한다.
