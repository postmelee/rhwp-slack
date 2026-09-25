# Task #10 Stage 5 — Linux·동일 사양 Cloud Run·운영 수용

GitHub Issue: [#10](https://github.com/postmelee/rhwp-slack/issues/10)
구현계획서: [task_m010_10_impl.md](../plans/task_m010_10_impl.md)

## 목적과 산출물

최종 소스 `93943c721c78f9a78de0fe1477e8d1a699d3c982`의 Linux 실행, 실제 Slack 생성물, 동일 사양 전후 측정과 운영 연결을 확인했다. 실행 자료는 ignored `.cache/validation/task10-*`, 장기 요약은 이 문서와 최종 보고서에 남긴다. 사용자 원본·PDF·PNG·자격정보를 Git에 추가하지 않았다.

## 수정과 검증 경과

- 빌드 전 단위 검증의 1ms timeout은 자산 미생성 오류와 경쟁했다. 사전 취소는 unit에서, 실제 제한 시간은 빌드 후 변환 suite에서 검증한다.
- 대기 중 만료와 실행 중 timeout을 분리했다. 대기 중 만료는 현재 runtime을 폐기하지 않는다. 실행 중 출력 callback을 붙잡은 실제 timeout은 runtime을 폐기하고 다음 PDF를 성공시킨다.
- 재사용 IPC가 최초 요청의 AsyncLocalStorage 문맥을 이어받아 후속 문서의 변환 지표가 잘못 귀속되는 문제를 실제 두 문서로 재현했다. 요청별 AsyncResource binding으로 고쳤고 컴파일 1회·새 WASM init 2회·재사용 1회를 요청 ID와 함께 검증한다. 초기 후보 측정은 `task10-before-context-fix`로 분리하여 최종 수치에 합치지 않았다.
- [최종 Linux CI](https://github.com/postmelee/rhwp-slack/actions/runs/35452975340): viewer/container 모두 성공. 타입, unit 9, Slack 81, 보안 28, UI 22, 실제 변환 9개 통과. UI에는 기존 upstream 0.8.6 mixed-format undo의 expected failure가 포함되며 한컴 조판 정답 일치를 의미하지 않는다.
- Linux AMD64/Node24.21, 비root·read-only·network none·2CPU/4GiB 컨테이너에서 OOM kill 0. cgroup peak: 서버 검증 721,715,200 bytes, Studio 브라우저까지 포함한 검증 1,162,104,832 bytes. 합성 문서 결과이며 임의 문서의 메모리 상한 보장이 아니다.
- 로컬 Docker의 upstream fetch가 시간초과되어 고정 SHA 검증을 통과한 동일 Studio archive만 별도 build context로 제공했다. CI는 canonical Dockerfile로 빌드했다. source/secret cache 전체를 빌드에 보내지 않았다.

## 실제 Cloud Run 비교

worker 2CPU/4GiB, 동시1, min0/max1, PNG 업로드1, us-central1 고정. 입력은 같은 Slack 파일 ID의 1/2/69페이지 HWP와 2페이지 HWPX이다. 문서마다 서버 중지/재시작 후 1회, 같은 서버에서 2회 반복했다.

**기준:** preview 작업 시작부터 `first_image`(첫 PNG의 Slack 공유 확인)까지. 사용자의 업로드 시점이나 Slack 클라이언트 화면 paint 시간을 직접 측정한 값은 아니다. 원격 CLI의 요청·폴링 시간은 별도로 보존하며 이 표에 넣지 않는다.

| 입력 | 최초 전 → 후 (초, 각 1회) | 반복 전 → 후 (초, 각 2회 중앙값) |
|---|---|---|
| 복학원서 HWP 1페이지 | 21.11 → 15.17 | 16.04 → 9.65 |
| 합성 HWP 2페이지 | 13.98 → 19.38 | 11.98 → 9.24 |
| 합성 HWPX 2페이지 | 16.92 → 11.57 | 11.27 → 8.61 |
| 사양서 HWP 69페이지 | 47.98 → 51.23 | 44.79 → 45.00 |

변경 전 2026-09-18 UTC 14:08–14:20, 변경 후 2026-09-19 UTC 실행. 각 버전 12/12 성공, 시도1에서 완료. 날짜와 Slack 네트워크 상황이 달라 작은 차이·배수 개선을 보장하지 않는다. 로그의 새 인스턴스와 동일 runtime ID로 최초/반복 조건을 확인했다. HWP 2페이지 최초 실행은 변경 후 더 느렸으며 browser_start와 Slack 업로드 지연이 증가했다. 최초 실행 개선을 보장하지 않는다. 최종 후보에서 WASM compile 4회, runtime reuse 8회가 해당 요청에 기록됐다. 실제 upload 시작과 공유 확인 시점은 JSON summary에 보존한다.

Cloud Run이 Slack에 저장한 PDF 74페이지를 96dpi로 렌더해 전후 pixel 일치, PNG 8장 byte 일치를 확인했다. 대표 표·접수증·목차·마지막 페이지를 직접 확인했다. 동일 앱의 변경 전 출력과의 회귀 비교이며 독립 한컴 출력 정답지가 아니다.

## 배포와 운영 수용

| 구성 | 값 |
|---|---|
| 최종 실행 소스 | `93943c721c78f9a78de0fe1477e8d1a699d3c982` |
| AMD64 이미지 | `sha256:bda18bbfb4cd3182e5692749beea87b531107bc37ec707a6f18fac24b8f5906a` |
| ingress 100% | `rhwp-ingress-00012-6hv` |
| worker 100% | `rhwp-worker-00008-6t7` |
| rollback | ingress `rhwp-ingress-00011-l6z`, worker `rhwp-worker-00007-jbt` |

사양·min/max·동시 처리·권한·secret version·workspace namespace·Slack URL·예산을 유지했다. 실제 운영 namespace에서 비공개 합성 문서 2회 PDF/PNG 준비 성공을 확인했다. 인증 티켓 교환·문서 정보·원본 전달·Studio·편집기 host는 200, 인증 없는 원본 요청은 403이었다. 합성 원본을 저장 API로 전송한 수정본 1개의 PDF/PNG 완료와 원래 스레드 연결을 확인했다. 이번 단계에서는 데스크톱 화면의 실제 타이핑을 다시 수행하지 않았다. 시험용 worker는 삭제했고 서비스 목록에는 운영 ingress/worker만 남았다.

공개 `/healthz`가 Google Frontend 404를 반환해 점검 스크립트를 실제 `/editor/`와 `/studio/` 경로로 바꿨다. Google의 [예약 URL 경로 안내](https://docs.cloud.google.com/run/docs/known-issues#reserved-url-paths)는 일부 `z`로 끝나는 경로를 사용할 수 없다고 명시한다. 앱 자체의 로컬 healthcheck는 변경하지 않았다. 배포 복구는 기존 namespace를 유지하고 위 두 revision으로 트래픽을 되돌린다.

## 잔여 위험과 다음 단계

장문 파싱·SVG/DOM 생성·문서별 글꼴 적용·Slack 공유 API는 계속 필요하다. 재사용은 인스턴스와 앱의 유한 수명 안에서만 성립한다. 요청 간 문서 JS/WASM 메모리/context를 재사용하지 않지만 JS worker를 별도 OS 보안 sandbox로 주장하지 않는다. #8의 editor/Pages 작업은 이 운영 버전을 새 기준으로 별도 진행한다. 새 PR 병합은 작업지시자 검토 대상이다.
