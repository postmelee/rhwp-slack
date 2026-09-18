# Task #2 Stage 7 — 동일 사양 전후 비교 (진행 중)

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
- 로컬 AMD64 컨테이너 빌드는 pinned upstream git fetch가300초를 초과해 완료하지 못했다. 애플리케이션 변환 실패와 구분한다. 승인받은 원격 push로 네이티브 Linux CI를 실행한다.

## 남은 완료 조건

네이티브 Linux smoke, 새 이미지 Cloud cold/warm 비교, 업로드 동시1/2 비교, 실제 Slack PDF/Studio/저장, 고정 사양 운영 반영·rollback 증적이 남아 있다. Stage7과Task#2는 아직 완료하지 않았다.
