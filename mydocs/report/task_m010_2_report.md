# Task #2 최종 보고서 — 동일 사양의 문서 준비·복구 개선

GitHub Issue: [#2](https://github.com/postmelee/rhwp-slack/issues/2) · 마일스톤 M010

## 작업 요약

- 7단계로 계측·복구·빌드 준비·PDF 우선·업로드 병렬 비교·편집 진입·전후 수용을 수행했다.
- ingress 1CPU/1GiB/min1/max1, worker 2CPU/4GiB/min0/max1, 큐 동시 1 및 기존 예산·권한·rhwp 0.8.6을 유지한다.
- 같은 파일의 PDF/PNG를 유지하면서 짧은 문서의 준비 시간을 줄였다. 기준 측정에서 실패한 69페이지 문서는 개선 후 해당 6회 모두 첫 시도에 완료했다.
- 실행 소스는 b079981, release image index digest는 `f47bbd2111af14c4076c4637b2a55e3668072381ec16348e3de5c53c9027f664`이다. 이후 보고서 커밋은 실행 코드를 바꾸지 않는다.

## 변경 파일 목록과 영향 범위

| 경로 | 변경 요약 | 영향 범위 |
|---|---|---|
| src/server/cloud/telemetry.ts, application.ts, tasks.ts, receiver.ts | 제한된 계측·3회/15분 재시도·deadline 확인·작업 소유권 검사·PDF 우선·완료 영수증 재사용 | Cloud Run 작업 처리 |
| src/conversion/, scripts/build-conversion.mjs, build-host.mjs, Dockerfile | 변환 코드·같은 글꼴 사전 빌드, 글꼴 허용 목록, 크기가 제한된 스트림 | 로컬/Cloud 실제 변환 |
| src/server/concurrency.ts, config.ts, document-message.ts, documents.ts | 최대 2개 업로드, 카드 기록 직렬화·복구 UI | Cloud 갤러리와 공통 카드 |
| src/editor/main.ts, startup.ts, index.html, style.css | 초기화 120초 제한, 실패 iframe 정리, 티켓 없는 외부 열기 안내 | Studio 호스트 |
| scripts/benchmark-conversion.mjs, tests/, docs/ | 재현 계측·회귀 검사·운영 설명 | 검증·운영 |

엔진 조판 소스는 변경하지 않았다. 문서 원본·산출물·자격 증명을 Git에 넣지 않았다.

## 문서 위치 검증

| 파일 | 계획된 위치 | 실제 위치 | 결과 | 근거 |
|---|---|---|---|---|
| cloud-run.md, architecture.md | docs/ | docs/ | OK | 기존 제품 문서에 운영 계약 추가 |
| 계획·7단계 보고·최종 보고 | mydocs/plans, working, report | 동일 | OK | 수행계획서 위치 판단 유지 |
| benchmark-conversion.mjs | scripts/ | scripts/ | OK | 비밀값 없는 재현 명령 |
| 문서/원시 측정/배포 영수증 | ignored .cache/validation/ | 동일 | OK | private 검증 자료로 보관 |

## 변경 전·후 정량 비교

### 로컬 — 변환만, 입력별 3회 중앙값

| 입력 | 변경 전 | 변경 후 |
|---|---:|---:|
| 2페이지 HWP | 5,549ms | 589ms |
| 2페이지 HWPX | 5,179ms | 594ms |
| 69페이지 HWP | 13,595ms | 8,924ms |

각각 9/9 성공. macOS ARM/Node24.15.0, 매회 새 child/browser. baseline 일부는 typecheck와 겹쳤으므로 미세 차이의 근거로 쓰지 않는다.

### Cloud Run — 제출부터 완료 관찰, 각 cold/warm 3회 중앙값

| 입력 | 변경 전 cold / warm | 변경 후 순차 cold / warm | 성공 |
|---|---:|---:|---|
| 2페이지 HWP | 71,544 / 65,430ms | 36,972 / 37,379ms | 각각6/6 |
| 2페이지 HWPX | 72,824 / 63,919ms | 38,168 / 36,127ms | 각각6/6 |
| 69페이지 HWP | 기존 60초 변환 제한으로 미완료 | 70,405 / 75,020ms | 0/6 → 6/6 |

이미 Slack에 공유한 동일 원본을 Mac에서 제출하고 3초 간격으로 관찰했다. 현지 권한 확인·DB 왕복·관찰 오차가 포함되므로 실제 사용자의 업로드 대기와 구분한다. baseline 7bf0ce9와 후보 b079981은 같은 worker 2CPU/4GiB/동시 1을 사용했다. 원본 운영 이미지 자체와 계측 baseline도 구분한다. 각 9개 cold/warm 쌍에서 새 인스턴스 시작과 같은 runtime 재사용을 확인했다. 범위와 전 표본은 [Stage7](../working/task_m010_2_stage7.md)에 있다.

후보 worker의 preview 실행 자체 중앙값은 짧은 문서 약 15~17초, 69페이지 약 53초이다. 69페이지는 PDF 사용 가능 후 전체 이미지 준비까지 중앙값 9,116ms가 남아 PDF 우선 경로가 동작했다. 변환 콜백은 업로드를 포함하므로 중첩 단계 시간을 더하지 않는다.

### 업로드1개/2개 비교

같은 이미지·사양에서 업로드 동시 수만 바꿔 각각 18회 측정했고 두 경우 모두 첫 시도에 성공했다.

| 입력 | 동시1 cold / warm | 동시2 cold / warm |
|---|---:|---:|
| 2페이지 HWP | 36,972 / 37,379ms | 36,637 / 34,258ms |
| 2페이지 HWPX | 38,168 / 36,127ms | 38,908 / 31,969ms |
| 69페이지 HWP | 70,405 / 75,020ms | 82,299 / 80,683ms |

PDF 준비→전체 준비 간격도 일관되게 줄지 않아 **운영은 동시1을 유지**한다. 동시2는 구현과 회귀 검사를 갖춘 선택 설정으로 남긴다. 69페이지는 업로드 이전 DOM 부착 시간도 달라졌으므로 전체 차이를 병렬화의 인과적 회귀로 단정하지 않는다.

### 메모리·출력

- 네이티브 Linux 2CPU/4GiB smoke의 cgroup peak: 서버 PDF 2,157,334,528→559,517,696bytes, Studio 브라우저 포함 2,907,877,376→1,067,655,168bytes. 전체 검사 최대치이며 새 회귀 검사가 추가되어 집합이 완전히 같지는 않다. Cloud 69페이지 peak로 해석하지 않는다.
- Cloud Monitoring 단일 표본 최대는 동시1 3,425,550,336bytes(30표본), 동시2 2,563,547,136bytes(22표본)였다. 순간 peak가 아니며 Cloud cgroup peak는 미지원이다. 이 표본으로 모든 문서의 4GiB 안전성을 보장하지 않는다.
- 전체 73페이지 PDF를 96dpi로 렌더링해 모든 픽셀이 동일함을 확인했다. Slack PNG 7개도 바이트가 동일하다. 표지·목차·표·끝 페이지와 HWP/HWPX 그림·표를 직접 대조해 글꼴·줄바꿈·표선 변경을 발견하지 않았다. 변경 전 출력과의 동등성 검증이며 한컴 정답지 적합성 검증은 아니다.

## 검증 결과

| 수용 기준 | 결과 |
|---|---|
| 같은 입력·조건 반복 | OK — 로컬/Cloud 각 3회, 실패와 시간 편차를 포함 |
| 긴 문서 재시도 감소·PDF 우선 | OK — baseline 6/6 실패 → 순차 후보 6/6 첫 시도 성공, PDF 먼저 공유 |
| 재시도·최종 실패·부분 성공·수동 복구 | OK — Slack 80개 회귀, 3회/15분 상한, 종료된 worker의 deadline 수습, 이전 소유자의 늦은 갱신 차단 |
| 중복·순서·권한 회수·응답 유실 | OK — Slack 80/security 28, 최대 2개·직렬 쓰기·완료 영수증 재사용 |
| 편집 초기화·늦은 SDK 응답 | OK — unit 9, viewer 21 + 기존 expected failure 1 |
| 실제 변환·출력 동등성 | OK — conversion 2, PDF 73페이지·PNG 7개 대조 |
| 네이티브 Linux | OK — [CI35339089528](https://github.com/postmelee/rhwp-slack/actions/runs/35339089528), viewer/container, OOM kill 0 |
| 실제 Slack PDF·갤러리 | OK — 후보 69페이지 PDF와 PNG를 Slack 내부 뷰어에서 열기 |
| 실제 Studio·같은 스레드 저장 | OK — 운영 전환 후 Slack 내부 Studio에서 합성 문서 수정·저장, 같은 부모 스레드에 편집본 PDF/PNG ready, dirty 해제와 실제 화면 확인 |
| 고정 사양·운영 반영 | OK — worker 00007-jbt·ingress 00011-l6z 각각 100%, 같은 사양·예산·IAM, 업로드 동시1, 공개 editor 200·무인증 source 403·무서명 Slack 401·무인증 worker 403 |

### 운영 배포와 증적

- 배포 시각: 2026-09-18 21:33 KST. 기존 Slack 주소·허용 채널·namespace를 유지했다.
- Cloud Run의 실제 Linux AMD64 image digest는 `322103757f4d16c44e08384fd1d41a9acff36985fe8caad03590275add40a79b`이다. 위 index digest의 플랫폼 manifest와 일치한다.
- [운영 수용 댓글](https://rhwphq.slack.com/archives/C0C1X3ENGD8/p1789734864007979?thread_ts=1789654893.253979&cid=C0C1X3ENGD8)에서 Slack 내부 Studio와 같은 스레드 저장을 확인했다. 편집본 카드 `a144a94f-b76d-459d-8e2f-b0fcca247c79`의 PDF·PNG가 준비됐다.
- 완료된 검증 worker와 임시 ingress tag를 제거했고 운영 서비스·이전 리비전은 유지했다. 원시 JSON·배포·정리 영수증은 ignored `.cache/validation/`에 보관한다.
- 단계별 오류/시간, cold/warm 범위, 메모리 한계와 복구 절차는 [Stage 7](../working/task_m010_2_stage7.md)에 기록했다.

### 단계별 검증 결과

- [Stage 1](../working/task_m010_2_stage1.md): 허용 목록 계측·기준 측정.
- [Stage 2](../working/task_m010_2_stage2.md): 유한 재시도·실패 복구.
- [Stage 3](../working/task_m010_2_stage3.md): 고정 코드/글꼴 빌드·출력 대조.
- [Stage 4](../working/task_m010_2_stage4.md): PDF 우선·완료 영수증·부분 이미지.
- [Stage 5](../working/task_m010_2_stage5.md): 최대 2개 업로드·쓰기와 표시 순서.
- [Stage 6](../working/task_m010_2_stage6.md): 초기화 상한·외부 진입 안내.
- [Stage 7](../working/task_m010_2_stage7.md): 로컬/Linux/Cloud/Slack·반영 증적.

## 잔여 위험과 후속 작업

### 잔여 위험

- 긴 문서는 DOM 부착·글꼴 준비가 여전히 큰 비중을 차지한다. 조건별 3회 표본으로 모든 문서·동시 사용자·최대 200페이지 성능을 보장하지 않는다.
- 기존 viewer의 혼합 형식 undo 1건은 expected failure로 남아 있다. 엔진 수정으로 숨기지 않았다.
- 다른 사용자의 로그인은 이번 검증에서 대행하지 않았다. 사용자가 알려 준 기존 동료의 성공과 이번 계정의 수용 결과를 구분한다.
- Cloud/Slack 장애·강제 종료에서 완전한 exactly-once는 보장하지 않는다. 확인된 파일 영수증과 소유권 검사·유한 재시도로 중복과 무한 대기를 줄인다.
- 복구 리비전 ingress 00009-btj / worker 00006-m9v를 보존했다. 진행 중 큐를 확인하고 두 서비스의 트래픽을 되돌리며 같은 Firestore namespace를 유지한다. 이전 코드의 재시도 UI 차이는 남으므로 미완료 작업을 점검한다. 오래된 SQLite로 돌아가 최신 문서 연결을 잃지 않는다.

### 후속 작업 후보

기존 #3(한 달 비용·다중 사용자), #4(Marketplace), #5(채널별 공유 해제), #6(단독 PNG/ZIP)의 범위를 유지한다. 이번 성과를 외부 배포 승인이나 무료 운영 보장으로 확대하지 않는다.

## 작업지시자 승인 요청

동일 스레드의 계속 진행과 원격 push/Linux CI 승인에 따라 기존 범위의 검증·보고·PR을 이어갔다. 새 사양·예산·권한은 추가하지 않았다.
