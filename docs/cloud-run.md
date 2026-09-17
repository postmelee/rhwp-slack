# Cloud Run 운영

단일 Slack 워크스페이스용 Cloud Run 진입점은 `src/server/cloud/main.ts`이다. 로컬 서버 진입점과 SQLite 운영 방식은 그대로 유지된다. Marketplace용 다중 워크스페이스 OAuth는 이 구성에 포함되지 않는다.

## 저장과 작업 경계

- 원본·편집본 HWP/HWPX, PDF, PNG는 Slack에 저장한다. 서버는 권한을 확인하고 처리할 때만 파일을 내려받는다. 문서 bytes를 Firestore·Cloud Tasks·컨테이너 이미지에 저장하지 않는다.
- Firestore는 카드 ID, Slack 파일/스레드 ID, 채널 설정, 업로드 영수증, 중복 처리와 작업 소유권을 기록한다. 문서 연결을 서버 재시작 뒤에도 유지하려면 이 메타데이터가 필요하다.
- 편집 티켓/세션은 무작위 원문 대신 해시로 식별한다. 티켓은 60초·1회, 세션은 유휴 10분·절대 60분이다. 다른 서버 인스턴스도 같은 상태를 확인하며 읽기·저장마다 Slack 접근 권한을 다시 검사한다.
- `expiresAt`은 임시 기록의 논리적 만료 시각이다. 승인된 Firestore TTL 정책을 사용하면 만료된 기록을 물리적으로 정리한다. 활성 문서 연결의 만료 필드는 null이다. TTL 삭제는 즉시 실행되지 않으며 과금 항목일 수 있다.
- ingress는 Slack 서명을 검사하고 작업 ID의 영속 기록과 큐 게시를 마친 뒤 응답한다. worker가 다운로드→변환→업로드→댓글 갱신을 한 HTTP 작업 안에서 완료한다.
- Cloud Tasks 메시지에는 opaque 작업 ID만 넣는다. Google OIDC와 worker 서비스의 IAM 권한을 모두 확인한다. worker를 공개하지 않는다.
- 실패한 작업은 Cloud Tasks의 제한된 재시도 정책을 따른다. 최대 재시도 이후에는 운영자가 원인을 확인해야 한다. Slack API와 Firestore 사이의 완전한 exactly-once를 보장하지 않는다. 저장 UUID·파일 ID·업로드 단계로 중복을 줄이고 결과가 불명확하면 기존 파일을 먼저 조회한다.

## 리소스와 설정

현재 시험 운영 환경은 같은 지역의 Cloud Run 서비스 2개, Firestore Native, Cloud Tasks 큐, Artifact Registry, Secret Manager를 사용한다.

| 항목 | 설정 |
| --- | --- |
| ingress | 요청 기반 CPU, 최소 1, 최대 1, 1 vCPU·1GiB, 동시 요청 4 |
| worker | 요청 기반 CPU, 최소 0, 최대 1, 2 vCPU·4GiB, 동시 요청 1, 요청 제한 900초 |
| 작업 큐 | 동시 작업 1, 초당 1, 최대 5회, 재시도 10~300초, 총 1시간 |
| Firestore | Native Standard, 단일 지역, 환경·workspace별 namespace |
| 비밀값 | Slack bot token·signing secret을 Secret Manager 버전으로 참조 |

필수 환경변수:

- 기존 `SLACK_APP_ID`, `SLACK_TEAM_ID`, `SLACK_WORKSPACE_HOST`, `SLACK_CHANNEL_IDS`, `SLACK_ADMIN_USER_IDS`, `SLACK_REACTIONS_ENABLED`.
- `CLOUD_ROLE=ingress` 또는 `worker`, `GOOGLE_CLOUD_PROJECT`, `CLOUD_ENVIRONMENT`.
- `TASK_QUEUE=projects/PROJECT/locations/REGION/queues/QUEUE`.
- `WORKER_ORIGIN`: 실제 worker의 HTTPS run.app origin.
- `TASK_SERVICE_ACCOUNT`: Cloud Tasks 전용 호출 서비스 계정.
- `APP_ORIGIN`: 사용자가 편집기를 여는 ingress의 HTTPS origin.
- `SLACK_BOT_TOKEN`, `SLACK_SIGNING_SECRET`: Secret Manager 참조. env 파일·Docker build context·Git에 값을 넣지 않는다.

ingress와 worker에는 Firestore 접근·큐 게시·호출 계정 사용 권한, 두 Slack secret 읽기 권한을 부여한다. task caller에는 worker의 `roles/run.invoker`만 부여한다. 검증 Job 계정에는 이 권한이나 Slack 비밀값을 부여하지 않는다.

## 빌드와 검증

```sh
docker build --platform linux/amd64 --target release -t rhwp-slack:cloud .
docker build --platform linux/amd64 --target smoke -t rhwp-slack:smoke .
```

Cloud Run 명령은 `node dist/cloud/main.cjs`로 지정한다. Docker 기본 CMD는 로컬 단일 서버를 위해 유지한다. 빌드에서 서버를 번들링하므로 시작할 때 TypeScript를 변환하지 않는다. Playwright는 변환이 시작될 때 로딩한다. 이미지 빌드에서는 같은 Node 버전·경로·사용자로 `--warm-code`를 실행해 모듈 컴파일 캐시만 미리 생성한다. 이 모드는 비밀값을 읽거나 외부 서비스에 연결하지 않는다. 운영 명령에는 이 옵션을 넣지 않는다.

배포는 이미지 digest를 고정하고 먼저 비공개 환경에서 검증한다. 합성 문서로 서명 거절·실제 OIDC 작업·PDF/PNG·Studio 편집·동일 스레드 저장·티켓 재사용 거절을 확인한다. `smoke` 이미지의 `node scripts/container-smoke.mjs --server-only`는 비밀값 없이 단위/Slack/security 회귀와 HWP/HWPX PDF 변환을 실행한다.

최소 인스턴스 0은 최초 요청에 시작 지연을 추가한다. Slack은 3초 응답을 요구하므로 실제 새 인스턴스에서 측정한다. 정상 가동 중 응답만 측정하고 전환하지 않는다. [Slack 응답 규칙](https://docs.slack.dev/interactivity/handling-user-interaction/), [Cloud Run 시작 최적화](https://docs.cloud.google.com/run/docs/tips/general).

## 비용과 이전

무료 할당량과 프로모션 크레딧은 영구적인 무과금 보장이 아니다. 시험 운영은 ingress 최소 1, worker 최소 0과 최대 인스턴스·큐 상한을 적용한다. 할인 전 Cloud Run 차단 한도와 크레딧 적용 후 프로젝트 전체 예산 알림을 별도로 설정한다. Cloud Run 서비스 지출 한도를 사용할 수 있지만 차단 지연이 있고 다른 서비스·저장 비용까지 차단하지 않는다. [지출 한도 범위](https://docs.cloud.google.com/billing/docs/how-to/budgets-spend-caps).

기존 SQLite는 실행 중 본체만 복사하지 않는다. 일관된 읽기 스냅샷을 만들고 문서 bytes 없는 메타데이터만 검증해 이전한다. 카드 ID·기록된 origin·원본/수정본 연결·채널 정책을 보존하고 진행 중 작업을 먼저 정리한다. 새 환경 수용 전에는 Slack의 요청 URL을 변경하지 않는다. 전환 시 최종 스냅샷과 기존 서버 설정을 보관해 복구할 수 있게 한다.

### 최소 인스턴스 1개를 검토할 때

2026-09-17 검증에서는 ingress를 512MiB로 줄인 리비전이 실제 OOM(521MiB 사용)으로 종료됐다. 19MB 내외 합성 HWP/HWPX 저장과 Studio 열기·편집·저장을 섞은 부하에서 발생했다. 개별 저장 응답이 성공해도 인스턴스 전체의 메모리 안전성을 의미하지 않는다. 현 이미지에서는 1GiB를 유지하고, 추가 축소는 정적 파일 전송·본문 복사·검증 자식 프로세스를 포함한 메모리 분석 후 별도 검증한다.

us-central1 요청 기반 과금, 1 vCPU, 월 730시간의 **유휴 대기만** 계산하면 1GiB는 $13.14, 512MiB는 $9.855다. 요청 처리·worker 변환·네트워크와 다른 서비스 비용은 별도다. 이 결제 계정에서 무료 할당량이 전부 남아 있다면 1GiB 대기의 무료 할당량 적용 후 환산액은 약 $7.92이며, 프로모션 크레딧 적용과는 구분한다. 원화 실제 금액은 원화 SKU 가격을 따른다. [공식 요금](https://cloud.google.com/run/pricing).

따라서 **할인 전 지출 한도 $10**과 **상시 1개·1GiB**는 한 달 지속 운영 목표에 맞지 않는다. 512MiB도 31일이면 대기만 $10.044이고 이번 안정성 검증에 실패했다. 실결제 목표와 할인 전 차단 한도를 구분해 운영자가 결정하기 전에는 상시 대기·지출 한도를 올리지 않는다.

### SQLite 메타데이터 이전

Google Application Default Credentials가 설정된 운영자 환경에서 먼저 dry-run한다. 기본 동작은 읽기·충돌 검사뿐이다.

```sh
node --import tsx scripts/migrate-cloud-state.ts \
  --source /absolute/path/state.sqlite --project PROJECT \
  --environment workspace --team TWORKSPACE
```

진행 중 변환·저장이 없음을 확인하고 기존 서버를 멈춘 뒤 같은 명령에 `--apply`를 붙인다. 원본 DB는 읽기 전용 transaction으로 열어 WAL에 commit된 변경도 포함한다. 카드·채널 설정·기존 스레드 요청 ID와 완료된 저장 영수증만 옮긴다. 진행 중 작업이나 다른 workspace, 대상의 서로 다른 기록을 발견하면 쓰기 전에 거절한다. 중단된 이전은 같은 입력으로 재실행할 수 있다. 출력 digest·건수와 원본 스냅샷은 접근 제한된 운영 증적으로 보관한다.

오래된 카드의 origin은 별칭으로 보존한다. Slack의 Work Objects 허용 도메인에도 이전 origin을 유지하고, 새 편집 세션의 URL은 현재 `APP_ORIGIN`으로 제공한다. 기존 열린 편집 세션은 이전하지 않으며 권한이 유효한 카드에 새 티켓을 발급한다. 이전 카드의 Slack 내부 열기는 별도 실제 수용이 필요하다. 이번 전환에서 과거 카드4개는 후속 확인 시 삭제·공유 해제로 무효화되어 있었으므로 실제 열기 성공으로 판정하지 않았다. 검증 namespace는 운영 namespace와 구분한다.


## 현재 워크스페이스 시험 운영 (2026-09-17 시작)

- 프로젝트 `rhwp-slack-postmelee`, `us-central1`, namespace `workspace-T0BQ8NK3KTM`, 큐 `rhwp-workspace`.
- 고정 진입 주소: https://rhwp-ingress-aaj47f2u5q-uc.a.run.app . Slack 명령·이벤트·상호작용은 `/slack/events`를 사용한다.
- ingress는 승인된 공개 호출을 허용하지만 Slack 서명과 문서 권한·티켓 검사를 유지한다. worker는 task caller 서비스 계정만 호출한다.
- Cloud Run 월 지출 한도: **20,749원**, 할인 전 사용량 기준. 프로젝트 전체 월 예산 알림: **13,833원**, 모든 크레딧 적용 후 기준. 50/80/100% 알림을 설정했다. 결제 통화는 KRW이며 $15/$10의 고정 환율 보장이 아니다.
- 지출 집계·차단 지연 및 Cloud Run 외 서비스 비용 때문에 총 결제액의 절대 상한을 보장하지 않는다. 달력 월 단위이므로 한 달 시험 기간은 두 결제 월에 걸친다.
- 현재 `rhwp-slack-test`, `rhwp-전체` 채널 정책을 이전했다. 채널에 앱을 초대한 뒤 관리자가 `/rhwp settings`에서 자동 감지·멘션 전용·중지를 설정한다. 활성 채널의 일반 구성원도 문서 사용이 가능하지만 별도 동료 계정으로 직접 수용한 것은 아니다.
- 초기(9/20), 7일(9/24), 30일(10/17) 점검을 예약했다. 로컬 Codex 후속 작업의 실행 환경·인증이 필요하며 클라우드 장애 차단 장치를 대신하지 않는다.

### 복구 주의

원본 SQLite의 일관된 스냅샷과 전환 전 Slack manifest를 접근 제한된 운영 경로에 보관했다. 전환 뒤 만들어진 카드·편집본 연결은 Firestore에 있으므로 옛 SQLite 서버만 다시 켜면 최신 연결을 잃는다. 우선 동일 이미지/운영 namespace를 사용하는 Cloud Run 리비전으로 복구한다. 전환 전 DB로 되돌리는 경우 새 기록을 비교·이전하고 중복 worker를 정지한 뒤 Slack 주소를 변경해야 한다. 이전 임시 HTTPS 주소가 다시 동작한다고 가정하지 않는다.

### Marketplace 후속 조건

현재 배포는 한 워크스페이스용이다. 공개 제출 전 OAuth 설치·워크스페이스별 토큰/설정 분리, 제거/권한 철회, 개인정보 처리·보존/삭제·지원 안내, 타 워크스페이스 수용을 준비한다. 공식 2026-09-01 공지에 따르면 2026년 7월부터 최소 **10개 활성 워크스페이스 설치**를 유지해야 한다. [설치 수 요건](https://docs.slack.dev/changelog/2026/09/01/slack-marketplace-install-requirement/).

Slack 내부 Studio에 사용하는 Work Objects embeds는 외부 배포 앱에 대해 초대형 pilot이다. Marketplace 외부 배포에서 같은 편집 UX를 유지하려면 참여 승인을 별도 확보해야 한다. 현재 워크스페이스의 동작 검증을 외부 배포 허가로 간주하지 않는다. [Embeds 조건](https://docs.slack.dev/messaging/work-objects-embeds/), [심사 안내](https://docs.slack.dev/slack-marketplace/slack-marketplace-review-guide/).
