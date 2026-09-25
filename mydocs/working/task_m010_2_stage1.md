# Task #2 Stage 1 — 계측과 기준 측정

계획: [수행계획서](../plans/task_m010_2.md), [구현계획서](../plans/task_m010_2_impl.md)
상태: 계측·기준 버전 고정과 최초 Cloud 표본 확보 완료. 고정 baseline 이미지의 반복 표본은 Stage2 이후와 독립적으로 수집하며 Stage7에서 최종 집계한다. 최적화 미적용.

## Stage 1.1 계측

- 작업/인스턴스 ID와 시도 번호, 카드 ID의 비가역 해시로 관련 prepare/preview 작업을 연결한다. 인증·다운로드·변환·PDF/PNG 업로드·공유확인·카드 게시/갱신 구간을 분리한다.
- 별도 fd3의 크기 제한 JSON으로 브라우저 시작·자식 시작·입력·WASM·파싱·SVG·글꼴·DOM·페이지 전달·글꼴 로딩·PDF·PNG 시간을 기록한다. 문서 stdout 바이너리 형식과 실행 순서는 유지한다.
- 알려진 오류 코드만 기록하며 message/stack/문서명/토큰/파일 URL을 기록하지 않는다. 계측 callback 실패가 변환을 실패시키지 않는다. memory는 부모/자식 RSS와 지원 시 cgroup lifetime peak를 구분한다.
- 첫 카드·PDF 공유확인·첫 이미지 공유확인·전체 카드 갱신 시점을 기록한다. Cloud Logging의 절대 timestamp와 cardKey로 작업 간 차이를 계산하며, 각 task elapsed만을 업로드부터 걸린 전체 시간으로 해석하지 않는다.
- `scripts/benchmark-conversion.mjs`는 파일명/bytes를 출력하지 않는 로컬/Linux 변환 전용 측정 도구다. 메모리·시간만으로 출력 품질 통과를 선언하지 않는다.

## 변경 전 로컬 기준

코드 `0b18002`(Task #1 최종), macOS arm64 / Node24.15.0, 순차3회, 매회 새 parser/browser, timeout60초. Slack에서 권한 확인 후69페이지 원본은 메모리로만 내려받았다. 데이터 파일은 Git에 포함하지 않는다.

| 입력 | 성공 | 중앙값 | 범위 |
| --- | --- | --- | --- |
| 2페이지 HWP | 3/3 | 5,132ms | 5,081~6,221ms |
| 2페이지 HWPX | 3/3 | 5,117ms | 4,974~5,174ms |
| 69페이지 HWP | 3/3 | 13,906ms | 13,779~14,071ms |

로컬 부모 프로세스의 첫 호출과 반복 호출이며 Cloud Run cold/warm을 뜻하지 않는다. 다운로드/Slack 업로드는 제외한다. 원시 증적 `.cache/validation/task2-local-original.json`.

## 검증과 환경 한계

- typecheck·Slack72/72·security22/22 통과. 계측 민감값 제외·동시 trace 격리·실패 보존과 child protocol 허용 목록 검사를 포함한다.
- 계측 후 첫 표본은 로컬 Docker build가 일부 겹쳐 성능 개선 비교에는 사용하지 않는다. 최종 세분화 계측은 부하가 없는 상태에서 다시 측정한다.
- linux/amd64 이미지는 빌드됐다. aarch64 Colima에서 AMD64 에뮬레이션 실행 중 esbuild Go heap의 bad pointer 오류로 Slack test 모듈 로딩이 실패했다. 메모리 한도 위반으로 판정하지 않으며 native Linux CI에서 재검증한다. 통과로 표시하거나 검사 기준을 낮추지 않는다.
- 현재 운영 리비전/이미지/사양/큐는 변경하지 않았다. Cloud Run baseline과 명확한 timeout 원인 확인이 끝날 때까지 Stage1 전체 완료로 처리하지 않는다.

## 기준 버전 고정과 초기 Cloud 표본

- 계측 source `7bf0ce92d514e3f20b981446522e63c44017ac78`, native Linux CI [35232425870](https://github.com/postmelee/rhwp-slack/actions/runs/35232425870) viewer/container 모두 통과.
- baseline image `sha256:f5356a3b36d7fa5abb86dcd87ddf9be2dbe72e0d8d8609640ad70e1aab7b4a9a`, private `rhwp-performance-worker`, 2CPU/4GiB/min0/max1/concurrency1. 운영 큐·서버는 변경하지 않았다.
- 업로드된 같은 파일로 submit~최종 ready 관찰: 2페이지 HWP cold 첫 표본71,544ms, warm 첫 표본65,430ms, 각1시도 성공. 3초 polling 오차를 포함한다. 상세 milestone은 Cloud 로그로 최종 계산한다. cold 최초 runtime 시작 로그를 확인했다. 전체 반복 표본 수집은 계속된다.
- local 계측69페이지3회 중앙값13,595ms. parse175ms, SVG342ms, fonts32ms, DOM5ms, page_attach10,163ms, fonts_ready487ms, PDF821ms, PNG1,000ms(각 단계 중앙값). 초반 소형 문서 일부에 typecheck/단위 검사 부하가 겹쳤으므로 미세한 오버헤드 차이는 판정하지 않는다.
- 브라우저로 모든 base64 글꼴을 전달하는 구간이 크다. Stage3에서는 동일 고정 글꼴을 사전 준비하되 **허용 목록의 로컬 리소스 응답으로 필요한 글꼴을 전달**하는 방법을 비교한다. 외부 네트워크와 문서 제공 URL은 허용하지 않고 글꼴과 출력은 유지한다.
- 기준 실행 도구의 source도 ignored `.cache/task2-baseline-src`에 고정했다. 이후 source 수정이 baseline submit/작업 처리에 섞이지 않는다. 최종 비교 표의 반복 수·실패와 조건은 Stage7에서 확정한다.
