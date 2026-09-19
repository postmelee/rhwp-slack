# #8 Stage 5 — 비교 결과와 운영 수용

GitHub Issue: [#8](https://github.com/postmelee/rhwp-slack/issues/8)
구현계획서: [task_m010_8_impl.md](../plans/task_m010_8_impl.md)
Stage: 5

> 이 보고서는 B 수용 시점의 기록이다. 이후 승인한 C 운영 전환·실제 Slack 검증·rollback 결과는 [Stage 6](task_m010_8_stage6.md)을 따른다.
검증일: 2026-09-20 KST (원격 측정 시각은 UTC)

## 단계 목적

A/B/C를 같은 서버 사양에서 비교하고, 실제 Slack 사용을 확인해 운영안을 결정한다. **B를 운영에 반영했다.** Pages C는 비교 환경으로 남긴다.

## 산출물

| 산출물 | 역할 |
|---|---|
| 이 보고서 | 측정 조건·원시 수치·판정·실제 Slack 수용·한계 |
| `docs/cloud-run.md` | 현재 운영 리비전·사양·복구 절차 |
| `mydocs/working/task_m010_8_stage4.md` | 배포 이미지 빌드 출처를 CI와 구분하여 명확화 |
| ignored `.cache/validation/task8-*` | 수치 JSON·배포 receipt·로컬 화면 증거; Git에 포함하지 않음 |

## 본문 변경 정도 / 본문 무손실 여부

실행 소스는 Stage 4.1의 `c6e609dcf3af0ff2d8f546ac91c3bc015f419121` 그대로다. 이 단계는 보고서·운영 문서만 바꾼다. 엔진 0.8.6·글꼴·변환 worker·문서 포맷·권한·예산·서버 사양을 유지했다. 문서 본문·티켓·세션·토큰·화면 이미지는 Git에 넣지 않는다.

## 검증 결과

### 1. 배포와 측정 조건

| 조건 | 실행 소스 / 리비전 | 정적 호스팅 |
|---|---|---|
| A | `93943c7` / ingress `00012-6hv` | #10까지 반영한 기존 Cloud Run |
| B | `c6e609d` / 비교 `task8-b1`, 운영 `task8-b2` | Cloud Run, 압축·버전 캐시·병렬 초기화 |
| C | B와 동일 소스 / Pages `1b695dc3` | Pages 정적 파일 + B 비교 API |

B/C의 58개 프로그램 identity 파일 43,294,079 bytes는 SHA-256 전수 일치했다. 정적 namespace는 `78e373467afb21ac634c3312ea53441245d94e2470baff0e1e8f34adc4399d0f`다. 각 앱의 캐시·HTTP 계약은 [Stage 4](task_m010_8_stage4.md)에 있다.

- 클라이언트: macOS ARM, 프로젝트 소유 Chromium 153.0.8010.12, 1152×900, 동일 기기/회선.
- 조건당 3회. 매 회 새 browser context에서 `HWP 첫 열기 → 같은 HWP 새 창 → 다른 편집본 새 창` 순서다. 총 27/27 준비 성공, 실패 0.
- 시작은 **티켓 발급을 마친 뒤 페이지 navigation**, 종료는 편집 준비 후 저장 버튼 표시다. Slack 카드 클릭→티켓 발급이나 별도 첫 paint 타이밍을 측정한 값은 아니다.
- 서버 warm / 브라우저 cache cold·warm을 구분한다. 측정 중 B `cloud_ready` 1회(17:45:15Z)였으며 서버 cold start 비교가 아니다.
- A 17:02–17:04, B 17:46, C 17:47 UTC에 순차 측정했다. 교차 무작위 실험이 아니므로 회선·API 시간 변화가 섞일 수 있다.
- 원시 결과 `task8-editor-{A,B,C}.json`, 집계 `task8-summary.json`. 실행은 `node --import tsx scripts/benchmark-editor.mjs .cache/task8-provider*.ts`의 해당 A/B/C provider를 사용했다. provider는 운영 인증이 필요한 비공개 로컬 파일이다.

### 2. 편집 준비 시간

단위 ms, **중앙값 (최솟값–최댓값)**. 각 칸 n=3.

| 브라우저 조건 | A 기존 | B Cloud Run 최적화 | C Pages |
|---|---:|---:|---:|
| 최초·캐시 없음 | 10,818 (10,078–11,027) | 5,610 (4,995–6,498) | 6,412 (4,112–6,554) |
| 같은 문서·캐시 있음 | 10,396 (10,357–10,398) | 4,557 (4,063–5,060) | 4,376 (3,869–4,380) |
| 다른 문서·캐시 있음 | 12,094 (11,919–12,792) | 4,059 (4,052–5,068) | 4,897 (4,376–5,375) |

원시 준비 시간(ms):

| 조건 | A | B | C |
|---|---|---|---|
| 최초 | 10818 / 11027 / 10078 | 5610 / 6498 / 4995 | 6412 / 4112 / 6554 |
| 동일 문서 | 10396 / 10357 / 10398 | 5060 / 4063 / 4557 | 4380 / 3869 / 4376 |
| 다른 문서 | 12094 / 11919 / 12792 | 4059 / 5068 / 4052 | 4897 / 5375 / 4376 |

### 3. 정적 파일 실제 전송량

Resource Timing의 프로그램 리소스 9개(Studio iframe HTML 포함)를 합산했다. 호스트 최상위 navigation HTML, 인증·문서 API, Slack 앱 전체 트래픽은 제외한다. 디스크 총용량과 다르다.

| 지표 | A | B | C |
|---|---:|---:|---:|
| 최초 전송 bytes 중앙값 | 12,394,784 | 3,543,521 | 3,995,871 |
| 같은 문서 재접속 bytes | 12,394,784 | 0 | 0 |
| 다른 문서 재접속 bytes | 12,394,784 | 0 | 0 |
| 최초 네트워크 리소스 수 | 9 | 9 | 9 |
| 재접속 네트워크 리소스 수 | 9 | 0 | 0 |

C 최초 bytes 3표본은 3,995,871 / 3,996,100 / 3,995,178이다. B 최초 프로그램 전송은 A보다 약 71.4% 감소했다. 재접속 0은 이 9개 프로그램 리소스가 브라우저 캐시에 있었다는 뜻이며, 원본 문서 다운로드와 API 요청은 계속 수행한다. C의 cross-origin API Resource Timing 크기 0은 TAO 미제공 영향이므로 캐시 적중으로 집계하지 않았다.

### 4. 단계별 시간과 남은 병목

단위 ms, 각 조건 중앙값. API 시간은 Playwright response timing이다. 병렬 구간이 있으므로 아래 중앙값을 합산해 전체 시간을 만들면 안 된다.

| 조건 | A 교환 / 정보 / 원본 | B 교환 / 정보 / 원본 | C 교환 / 정보 / 원본 |
|---|---|---|---|
| 최초 | 919 / 2260 / 1839 | 1274 / 1065 / 2166 | 1119 / 1187 / 2206 |
| 동일 문서 | 777 / 2384 / 2070 | 753 / 1169 / 2706 | 965 / 1380 / 2211 |
| 다른 문서 | 1060 / 3360 / 2807 | 968 / 1528 / 2542 | 1353 / 1656 / 2829 |

| 조건 | B Studio 준비 / 원본 준비 / 문서 load | C Studio 준비 / 원본 준비 / 문서 load |
|---|---|---|
| 최초 | 2971 / 2167 / 344 | 4244 / 2206 / 343 |
| 동일 문서 | 102 / 2707 / 347 | 97 / 2211 / 342 |
| 다른 문서 | 100 / 2543 / 350 | 100 / 2830 / 346 |

B/C Studio 준비와 원본 요청의 시작 간격은 0–1ms였다. 반복 열기에서는 프로그램 준비 약 0.1초보다 인증된 원본/API 대기가 크게 남았다. A에는 같은 내부 mark가 없어 엔진 초기화·load를 독립 비교하지 않았다. 짧은 합성 문서에서 개별 글꼴 다운로드 시간도 분리 측정하지 않았다. WOFF2 재사용은 별도 캐시 회귀 테스트로 확인했다.

### 5. 실제 운영 Slack 수용

자동 API/독립 Chromium과 실제 Slack UI 증거를 구분한다. 아래 실제 UI는 허용된 비공개 `rhwp-slack-test`의 동일 합성 테스트 스레드에서 수행했다.

| 시나리오 | 확인 결과 | 비공개 로컬 증거 |
|---|---|---|
| Slack 데스크톱 내부 편집기 | 카드→내부 Studio 2페이지→문자 붙여넣기→dirty→저장 완료 | `task8-slack-desktop-saved.jpeg` |
| 데스크톱 편집본 결과 | 편집본 4가 같은 원본 스레드의 새 답글; PDF ready·PNG 2개 ready | `task8-slack-desktop-card.json` |
| Slack 웹 내부 편집기 | 카드 아이콘→내부 Studio→키보드 입력→dirty→저장 완료 | `task8-slack-web-saved.png` |
| 웹 편집본 결과 | 편집본 5가 같은 원본 스레드의 새 답글; PDF ready·PNG 2개 ready | `task8-slack-web-card.json` |
| Slack 웹 PDF 열기 | 편집본 5의 PDF 링크→Slack 기본 미디어 뷰어, 2페이지와 입력한 문자열 확인 | `task8-slack-web-pdf.png` |
| 독립 Chromium 실제 저장 | 별도 브라우저에서 수정본 3 저장·같은 스레드 PDF/PNG 완료, page error 없음 | `task8-browser-accept.json`, `task8-browser-save.json` |
| 운영 HWPX | 2페이지 편집기 열기 + PDF/PNG 생성 성공, 작업 attempt 1 | `task8-additional-opens.json`, `task8-cloud-production.json` |
| 운영 긴 HWP | 69페이지 열기 + PDF/첫 3페이지 PNG 생성 성공, 작업 attempt 1 | 같은 JSON, `task8-long-editor.png` |

HWPX·69페이지 작업은 요청 제출→완료 관찰까지 각각 44,137ms·74,834ms였다. 폴링·Slack 게시가 포함된 기능 수용 값으로, 첫 이미지 성능 비교에 사용하지 않는다. 이 기록의 image 필드는 유지한 **worker 이미지**이며 ingress B 이미지와 구분한다.

데스크톱 직접 자동 타이핑은 일부 문자와 문단 설정 창으로 전달되어 취소한 뒤 붙여넣기로 편집·저장을 검증했다. 따라서 데스크톱 모든 키 입력을 검증했다고 주장하지 않는다. 웹 카드 중앙 자동 클릭은 hover의 외부 열기 영역에 걸렸고 카드 아이콘 클릭으로 내부 경로를 검증했다. 실제 Slack UI 결과는 B만의 수용이며 C의 실제 Slack embeds는 검증하지 않았다.

화면은 직접 확인했다. 합성 HWP/HWPX의 표·한국어·2페이지 표시와 긴 문서 첫 페이지를 확인했지만, 69페이지 전수 시각 검증이나 한컴 정답지 대조를 수행한 것은 아니다. 엔진 출력 품질은 이번 변경 범위가 아니다.

### 6. 회귀·보안·원격 CI

실행 소스 c6e609d의 [Linux CI 35459270890](https://github.com/postmelee/rhwp-slack/actions/runs/35459270890) viewer/container가 모두 성공했다.

| 검증 | 결과 |
|---|---|
| `npm run typecheck`, `npm test` | 통과, unit 9 |
| `npm run test:slack`, `npm run test:security` | Slack 81·security 30 통과 |
| `npm run test:viewer` | viewer 25개 기대 결과 충족(기존 upstream mixed-format undo의 기대 실패 정책 포함), conversion 9 통과 |
| canonical Linux Docker smoke/release | 빌드·2CPU/4GiB PDF·네트워크 격리 합성 Slack runtime 통과 |
| 권한/캐시/Origin | 매 요청 권한 회수·티켓 만료/재사용·사용자/워크스페이스 격리·정확한 Origin·비공개 no-store 유지 |
| 새 창·이전 버전 | 새 편집기는 문서 없음; JS/WASM/WOFF2 캐시 재사용; legacy HTML 재검증, 없는 버전 404 no-store |

기존 엔진 undo 기대 실패는 새로 통과시킨 항목이 아니며 #8에서 고치거나 기준을 완화하지 않았다. Mac ARM의 AMD64 에뮬레이션 smoke 실패와 native Linux 성공은 [Stage 4](task_m010_8_stage4.md)에 구분했다.

### 7. 비용 관찰과 판정

Cloud Monitoring의 B 비교 리비전 관찰 창은 **2026-09-19 17:44–18:06 UTC**다. `task8-cloud-metrics.json`에 저장했다.

| 관찰 지표 | 값 |
|---|---:|
| billable instance time | 60.9초 |
| 인터넷 전송 | 11,133,591 bytes |
| Google 네트워크 전송 | 695,604 bytes |
| private 전송 | 0 bytes |
| 응답 | 200:85 / 204:28 / 304:6 / 403:2 / 5xx:0 |

403 두 번은 의도한 비인증/잘못된 Origin 검사다. B/C benchmark와 probe를 합친 창이므로 이 서버 지표에서 A/B의 개별 청구 차이를 계산하지 않는다. [Cloud Monitoring 지표 정의](https://docs.cloud.google.com/monitoring/api/metrics_gcp_p_z).

**추정**: 요청 기반 1CPU·1GiB의 활성 사용 단가를 적용하면 `60.9 × (0.000024 + 0.0000025) ≈ $0.0016`의 compute에 해당한다. 이는 무료 할당/크레딧 전 추정이며 청구서가 아니다. 요청·전송·Firestore·Tasks·빌드·이미지 저장·운영 min1 대기를 제외한다. [Cloud Run 가격](https://cloud.google.com/run/pricing).

운영 min1·변환 worker·문서 API는 유지되어 월 고정 대기 비용은 이번 캐시 개선으로 없어지지 않는다. 실제 한 달 순청구와 계정 공유 무료 할당/크레딧 적용 결과는 아직 측정하지 않았다. B의 브라우저 전송 감소만으로 총요금 감소율을 주장하지 않는다.

**결정**: B는 모든 측정 조건에서 A보다 빨랐고 반복 프로그램 전송을 제거했다. C는 같은 문서에서 조금 빠르지만 최초/다른 문서에서 더 느려 일관된 추가 이점이 없었다. 작은 표본으로 통계적 유의성을 주장하지 않고, 현재 운영은 B를 선택한다.

### 8. 운영 반영과 복구

- ingress `rhwp-ingress-task8-b2` 100%, 실행 c6e609d, 이미지 `sha256:cecce003ca327ca3cc8660bc1a7d02fd2e08db82b8a13890d702a8f5b2d61ebd`.
- ingress 1CPU·1GiB·min1/max1·동시4; worker `rhwp-worker-00008-6t7` 2CPU·4GiB·min0/max1·동시1·PNG 업로드 동시1 유지.
- Slack URL·권한·Firestore namespace·기존 예산 알림(총사용 20,749원/순사용 13,833원)을 유지했다. 예산 알림은 강제 과금 상한이 아니다.
- 운영 `EDITOR_ORIGIN` 없음. Pages lab과 C API용 `editor-b` tag만 비교용으로 보존; 추가 revision 최소 대기 없음.
- 이전 ingress `rhwp-ingress-00012-6hv`로 트래픽 복구 가능; worker와 Firestore를 되돌리지 않는다. 명령은 [운영 문서](../../docs/cloud-run.md)에 있다.
- 기존 카드·이전 편집본을 B에서 여는 전환은 실제 검증했다. 버전/legacy 계약과 이전 revision 설정도 확인했다. **운영 트래픽을 A로 되돌렸다가 B로 다시 보내는 rollback 실험은 미실행**이다. 열려 있던 구버전 창은 필요 시 카드에서 다시 연다.

## 잔여 위험

- 각 조건 n=3, 서버 warm·독립 브라우저 측정이다. 실제 Slack 진입 전체 시간·서버 cold·개별 글꼴·첫 paint·월 순청구 수치는 별도다.
- C 실제 Slack embeds, 운영 rollback 실험, 긴 문서 전체 시각 대조는 미검증이다.
- 캐시는 브라우저/저장 공간 정책으로 제거될 수 있으며, 문서나 편집기 인스턴스 자체를 영구 재사용하지 않는다.
- 동일 revision이 살아 있는 것과 warm을 영구 보장하는 것은 다르다.

## 다음 단계 영향

최종 보고서·이슈 수용 현황과 전후 비교표를 PR 본문에 연결한다. 추가 성능 후보는 인증된 원본/API 단계 계측과 제한된 운영 관찰이다. 서버 증설이나 Pages 운영 전환을 이번 결과만으로 진행하지 않는다.

## 승인 요청

같은 스레드의 #8 진행과 원격 push/Linux CI 승인 범위로 보고서·Open PR 게시를 마무리한다. #8 병합은 수행하지 않으며 리뷰 대상으로 남긴다.
