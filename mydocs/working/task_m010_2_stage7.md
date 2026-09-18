# Task #2 Stage 7 — 동일 사양 전후 비교

## 로컬 결과

Stage1 계측 baseline과 Stage6 소스21e0652의 각3회 변환 중앙값이다. Node24.15.0/macOS ARM에서 매회 새 child/browser를 사용했다. Slack 업로드·큐·Cloud 시작 시간은 포함하지 않는다.

| 입력 | 변경 전 | 변경 후 | 성공 |
|---|---:|---:|---|
| 2페이지 HWP | 5,549ms | 589ms | 각각3/3 |
| 2페이지 HWPX | 5,179ms | 594ms | 각각3/3 |
| 69페이지 HWP | 13,595ms | 8,924ms | 각각3/3 |

- 기준 측정 일부는 typecheck와 시간이 겹쳤으므로 미세한 차이는 성능 증거로 해석하지 않는다. 원시 수치는 ignored `.cache/validation/task2-local-stage1-baseline.json`, `task2-visual-final.json`에 보관한다.
- 동일 입력의 전체73페이지 PDF를96dpi로 렌더링해 모든 픽셀이 동일함을 확인했다. Slack PNG7개도 바이트가 동일하다. 표지·목차·표·마지막 페이지, HWP/HWPX 그림·표 페이지를 직접 확인했다. 글꼴·줄바꿈·표선의 변경을 발견하지 않았다. 이는 변경 전 출력과의 동등성 검증이며 별도의 한컴 정답지 적합성 증거는 아니다.
- 증적은 ignored `.cache/validation/task2-final-visual-comparison/`, `task2-before/`, `task2-after-final/`에 둔다. 문서 원본·산출물을 Git에 넣지 않는다.

## Cloud 기준 측정 완료

고정 baseline7bf0ce9, 전용 비공개 worker,2CPU/4GiB/동시1/min0/max1. 운영 서비스를 변경하지 않았다. 파일은 미리 Slack에 공유한 뒤 작업 제출부터 카드 완료 관찰까지 측정했으며 관찰 주기는3초이다. 각 cold/warm3회, 총18표본이다.

| 입력 | cold 중앙값 | warm 중앙값 | 성공 |
|---|---:|---:|---|
| 2페이지 HWP | 71,544ms | 65,430ms | 6/6 |
| 2페이지 HWPX | 72,824ms | 63,919ms | 6/6 |
| 69페이지 HWP | 미완료 | 미완료 | 0/6 |

- 69페이지는 기존60초 변환 제한에 걸렸다. 마지막 단계는 page_attach였다. 실패 표본을 성공 시간으로 환산하지 않는다. 첫 표본은5회 실패 후 중지했으며 나머지는 첫 실패 후 다음 전달을 취소했다.
- Cloud 시작 로그와 runtime 식별자로9개 cold/warm 쌍을 확인했다. warm은 대응 cold와 동일한 인스턴스이다. 일부 표본은9/17, 나머지는9/18에 측정했으므로 네트워크 시점 차이는 남는다.
- cgroup peak는 이 환경에서 읽히지 않아 null로 남겼다. 부모 RSS와 전체 컨테이너 peak를 혼동하지 않는다.
- 원시 JSON과 허용 목록 로그는 ignored `.cache/validation/task2-cloud-baseline*.json`에 보관한다.

## 통합 검토와 현재 검증

- 늦게 실패한 이전 작업자가 새 작업의 UI를 덮어쓰지 못하도록 실패 안내에도 작업 소유권 checkpoint를 추가했다. 소유권 교체 후 오류를 발생시키는 계약 검사를 통과했다.
- typecheck, unit9, Slack80, security28 통과. 전체 viewer21개와 기존 expected failure1개(러너22passed), 실제 변환2개 통과. viewer/변환 검증은21e0652이며 이후 소유권 수정은 서버 측 Slack 검사로 검증했다.
- 측정 스크립트는 PDF 생성/페이지별 PNG 생성 시점을 기록한다. 단일 합성 HWP 실행과 git diff --check 통과.
- 로컬 AMD64 컨테이너 빌드는 pinned upstream git fetch가300초를 초과해 완료하지 못했다. 애플리케이션 변환 실패와 구분한다. 이후 승인된 원격 push의 네이티브 Linux CI와 동일 입력 archive를 이용한 로컬 release 이미지 빌드가 성공했다. 아래 증적과 구분한다.

## 네이티브 Linux 검증

- source `b07998115fcaf653001746afce04af3f4d9d1137`, [CI35339089528](https://github.com/postmelee/rhwp-slack/actions/runs/35339089528)의 viewer/container 모두 통과했다. 고정 Node24.21.0, Linux AMD64에서 확인했다.
- 2CPU/4GiB, non-root/read-only/외부 네트워크 차단 조건에서 OOM kill0이었다. server PDF 검사 cgroup peak는559,517,696bytes, Studio 브라우저를 같은 cgroup에 포함한 검사는1,067,655,168bytes였다.
- Stage1 [CI35232425870](https://github.com/postmelee/rhwp-slack/actions/runs/35232425870)의 대응 수치는2,157,334,528bytes와2,907,877,376bytes였다. 테스트 전체 최대치이며 개별 문서 변환의 메모리나 Cloud69페이지 peak로 해석하지 않는다. 새 회귀 검사도 추가되어 검사 집합이 완전히 동일하지는 않다.
- 로컬 release 이미지의 입력은 같은 b079981이다. upstream git fetch 지연을 피하기 위해 동일한 SHA256 검사를 통과하는 Studio archive를 임시 빌드 컨텍스트에 넣었다. 저장소 Dockerfile과 네이티브 CI는 원래 fetch 경로를 유지한다. 이미지에는 비밀값·사용자 원본을 넣지 않았다.

## Cloud 최적화·순차 업로드 결과

동일 digest `f47bbd2111af14c4076c4637b2a55e3668072381ec16348e3de5c53c9027f664`, source b079981, 전용 worker 리비전00004-n4d에서 각각cold/warm3회씩18회 모두 첫 시도에 성공했다. 아래는 **Mac의 제출 시작 → 완료 관찰**이다. 이미 Slack에 공유한 파일을 사용하며 현지 클라이언트의 권한 확인·Firestore 왕복과3초 polling 오차가 포함된다. 실제 사용자의 드래그 업로드부터 걸리는 시간으로 해석하지 않는다.

| 입력 | cold 중앙값 (범위) | warm 중앙값 (범위) | 성공 |
|---|---:|---:|---|
| 2페이지 HWP | 36,972ms (32,599~38,290) | 37,379ms (36,858~56,013) | 6/6 |
| 2페이지 HWPX | 38,168ms (33,220~39,775) | 36,127ms (35,616~37,290) | 6/6 |
| 69페이지 HWP | 70,405ms (68,298~75,186) | 75,020ms (69,276~86,595) | 6/6 |

worker의 preview 실행 자체 중앙값은 HWP cold15,861/warm15,289ms, HWPX17,411/14,650ms,69페이지52,811/52,975ms이다. 최종 비교에서는 제출 관측값과 이 처리 시간을 분리한다. 첫 카드/PDF/첫이미지·내부 단계는 `task2-cloud-optimized-1-summary.json`에 있다. 모든9쌍에 새 인스턴스 시작 로그가 있고 대응warm은 같은 runtime이다. Cloud cgroup peak는 계속 미지원이다.

## 실제 UI 사전 수용

- 후보 worker가 만든69페이지 PDF 링크를 Chrome의 실제 Slack에서 눌러 Slack 미디어 PDF 뷰어로 열었다. 같은 댓글의 첫 PNG도 Slack 이미지 뷰어로 열었고 기본 갤러리와 편집 카드가 함께 유지됐다.
- 운영 ingress는00009-btj에100%를 유지한 채 `task2-check` tag의00016-yok에서 후보 Studio를 확인했다. 합성2페이지 HWP에 `Task 2 verified `를 입력하고 실제 Slack에 저장했다. 편집본 파일·PDF·PNG가 동일 부모 스레드에 준비되고 dirty 상태가 해제됐다. 저장 영수증은 ignored `task2-editor-save.json`이다.
- 티켓 없는 `/documents/{id}` 외부 진입은 Studio를 띄우지 않고 Slack 카드로 재진입하도록 안내했다.
- tag URL은 Slack embeds의 기존 허용 origin에 포함되지 않는다. 위 Studio 검사는 실제 Cloud 서버·Slack 저장을 이용한 **독립 브라우저 검사**이다. 기존 origin의 Slack 내부 embed는 아래 운영 전환 후 수용에서 별도로 통과했다. 기존 허용 도메인·권한을 확장하지 않았다.

## 업로드 동시 1/2 비교와 운영 선택

같은 b079981 이미지에서 `RHWP_IMAGE_UPLOAD_CONCURRENCY`만 1→2로 바꾸고 독립 namespace에서 같은 18회 측정을 반복했다. 두 경우 모두 18/18, 첫 시도에 성공했다. 동시2의9개 cold/warm쌍도 시작 로그와 같은 runtime을 확인했다.

| 입력 | 동시1 cold / warm | 동시2 cold / warm |
|---|---:|---:|
| 2페이지 HWP | 36,972 / 37,379ms | 36,637 / 34,258ms |
| 2페이지 HWPX | 38,168 / 36,127ms | 38,908 / 31,969ms |
| 69페이지 HWP | 70,405 / 75,020ms | 82,299 / 80,683ms |

동시2의 범위: HWP cold35,850~49,141/warm32,201~36,386ms, HWPX cold37,364~44,560/warm30,905~32,408ms,69페이지 cold76,945~95,436/warm77,862~86,381ms. 표본을 제외하지 않았다.

PDF ready→전체 ready 중앙값도 HWP6,874→7,194ms, HWPX6,618→7,470ms,69페이지9,116→8,077ms로 일관된 개선은 없었다.69페이지의 업로드 이전 `page_attach`도 두 비교군에서 차이가 있으므로 전체 증가를 병렬화의 인과적 회귀로 단정하지 않는다. 운영은 **동시1 유지**, 동시2는 구현·회귀 검사를 갖춘 선택 설정으로 남긴다.

Cloud Monitoring `container/memory/usage`의 단일 표본 최대는 동시1 3,425,550,336bytes(30표본), 동시2 2,563,547,136bytes(22표본)였다. 수집 구간의 표본이며 순간 최대나 OOM 안전성의 보장이 아니다. Cloud cgroup peak는 얻지 못했다. 4GiB 한도를 유지하고 큰 문서는 후속 운영 관찰 대상으로 남긴다.

## 운영 반영과 실제 Slack 수용

2026-09-18 21:33 KST에 기존 주소와 namespace를 유지하며 worker `rhwp-worker-00007-jbt`, ingress `rhwp-ingress-00011-l6z`로 각각 트래픽 100%를 전환했다. 실행 소스는 b079981이며 이후 최종 보고서 커밋은 문서만 바꾼다.

- 이미지 index digest: `f47bbd2111af14c4076c4637b2a55e3668072381ec16348e3de5c53c9027f664`.
- Cloud Run이 선택한 Linux AMD64 image digest: `322103757f4d16c44e08384fd1d41a9acff36985fe8caad03590275add40a79b`. index manifest의 플랫폼 항목과 대조했다.
- ingress 1CPU/1GiB/서비스 최소1·최대1/동시4, worker 2CPU/4GiB/최소0·최대1/동시1, 이미지 업로드 동시1을 유지했다. ingress의 승인된 공개 호출과 비공개 worker의 task caller 전용 IAM도 유지한다. 예산·비밀값·Slack scope 변경은 없다.
- `/editor/`는 200, 인증 없는 `/api/editor/source`는 403, 서명 없는 `/slack/events` 요청은 401, 인증 없는 worker `/internal/tasks`는 403이었다.
- 실제 Slack 내부 Studio에서 합성 2페이지 HWP에 `Task 2 Slack verified `를 입력하고 저장했다. 화면의 dirty 상태가 `변경 없음`으로 바뀌고 `편집본과 PDF를 Slack에 저장했습니다.`가 표시됐다. 화면에서 수정 내용과 우측 스레드의 편집본 갤러리를 직접 확인했다.
- 원본 카드 `17e999ac-0d88-4848-aeee-fac0b6547547`, 편집본 `a144a94f-b76d-459d-8e2f-b0fcca247c79`는 같은 부모 스레드 `1789654893.253979`에 있고 PDF·PNG가 모두 ready였다. [실제 수용 댓글](https://rhwphq.slack.com/archives/C0C1X3ENGD8/p1789734864007979?thread_ts=1789654893.253979&cid=C0C1X3ENGD8).
- 영수증은 ignored `task2-production-smoke.json`, `task2-production-*-release.json`, `task2-final-service-check.json`, `task2-activation.log`에 보관한다. 실제 사용자 문서는 Git에 넣지 않는다.

## 복구와 검증 자원 정리

이전 ingress `rhwp-ingress-00009-btj`, worker `rhwp-worker-00006-m9v`는 남겨 둔다. 복구 시 처리 중 작업과 큐를 먼저 확인하고 두 서비스의 트래픽을 해당 리비전으로 되돌린다. 같은 Firestore namespace를 사용해 전환 이후 문서 연결 정보를 보존한다. 이전 코드의 재시도/실패 UI는 이번 개선과 다르므로 미완료 작업을 점검한다. 오래된 SQLite로 되돌리지 않는다.

검증 큐에 대기 작업이 없음을 확인한 후 전용 `rhwp-performance-worker` 서비스와 ingress `task2-check` 태그를 제거했다. 기존 검증 큐·운영 서비스·Slack 검증 파일·원시 증적과 복구 리비전은 유지했다. 정리 영수증은 ignored `task2-cleanup.json`이다.

Stage 7의 구현·검증·운영 반영을 완료했다. 공개 Marketplace와 한 달 운영 평가는 후속 이슈 범위로 남는다.
