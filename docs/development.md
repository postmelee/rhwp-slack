# Slack 개발 서버 설정

## 현재 범위

현재 앱은 실제 Bolt HTTP receiver, 명령·파일 선택, Work Object 카드, 일회성 편집 세션, PDF 공유와 편집본 새 파일 저장 adapter를 제공합니다. 실제 테스트 앱 설치·비공개 채널의 명령·업로드·인증 다운로드·웹 Studio 편집과 저장을 확인했습니다. 데스크톱 Studio 열기와 PDF 첨부의 기본 뷰어 표시도 확인했습니다. 직접 입력/저장은 사용자가 정상 동작을 확인했습니다. 실제 권한 회수 등 미실행 시나리오는 별도 검증 대상이며 로컬 자동 검사는 합성 Slack API를 사용합니다.

`npm run dev`는 로컬 편집 시험용입니다. 기본 `/editor/`에는 테스트 입력이 없고 `?devtools=1`에서만 표시합니다. 기본 Slack 서버는 같은 origin에 production `/editor/`, `/studio/`와 인증 API를 제공합니다. 운영 C처럼 `EDITOR_ORIGIN`을 설정하면 프로그램만 Pages로 분리합니다. [정적 호스팅 설정](static-hosting.md)을 참고하세요. `/api/dev/documents`는 Slack 서버에서 열리지 않습니다.

## 설정 준비

1. Node 24.21.0/npm 11.19.0에서 `npm ci`를 실행합니다.
2. `slack/manifest.json`의 `https://example.invalid/slack/events` 세 곳을 운영자가 준비한 동일한 HTTPS 수신 주소로 바꿉니다. 예제 주소는 사용할 수 없습니다.
3. 테스트 워크스페이스에 manifest로 앱을 만들고 설치합니다. 전체 조직 설치는 이 버전에서 지원하지 않습니다.
4. 앱의 Signing Secret, Bot User OAuth Token, App ID, Team ID를 로컬 `.env`에 입력합니다. `.env.example`을 복사해 사용하며 비밀값을 Git·이슈·채팅에 기록하지 않습니다.
5. `SLACK_WORKSPACE_HOST`에는 URL이 아닌 `my-workspace.slack.com` 형태의 hostname, `SLACK_CHANNEL_IDS`에는 최초 활성화할 일반 채널 ID를 쉼표로 입력합니다. 기존 DB가 있으면 저장된 채널 설정이 우선합니다.
6. `APP_ORIGIN`에 편집기·Studio·수신기를 함께 서비스할 HTTPS origin을 입력합니다. 경로·query 없이 `https://editor.example.com` 형태로 설정합니다. Origin은 요청 Host header에서 추정하지 않습니다.
7. 앱 설정의 **Work Object Previews**에서 Work Objects와 file entity를 활성화하고, embeds 도메인 허용 목록에 편집기 origin의 hostname을 등록합니다. `EDITOR_ORIGIN`을 설정했다면 그 hostname을, 기본 구성에서는 `APP_ORIGIN`의 hostname을 사용합니다. SDK의 같은 origin 통신을 위해 **allow-same-origin**을 활성화합니다. 이 설정은 앱 관리 화면에서 확인해야 하며 manifest만으로 활성화했다고 간주하지 않습니다.
8. manifest에는 `file_shared`, `app_mention`, `app_home_opened`, `entity_details_requested`, `file_deleted`, `file_unshared` 이벤트가 있습니다. `app_mentions:read` 또는 상태 반응용 `reactions:write`를 추가한 기존 앱은 해당 권한 승인과 재설치가 필요합니다. `channels:history`/`groups:history` 권한은 사용하지 않습니다.
9. 허용 채널에 bot을 초대하고 요청자도 해당 채널에 참여하게 합니다. 공개·비공개 채널 모두 이 조건이 필요합니다.

앱 등록·설치·HTTPS 연결은 실제 Slack 관리 작업입니다. 이 저장소의 로컬 테스트나 manifest 생성만으로 설치가 완료되지 않습니다.

## 실행

```sh
cp .env.example .env
# 로컬 편집기에서 .env 값을 입력한 다음:
npm exec playwright install chromium
npm run build
npm run start:slack
```

서버는 기본 `127.0.0.1:3000`에서 실행하며 `PORT`로 포트를 바꿀 수 있습니다. 시작 시 `auth.test`로 토큰의 workspace·bot 정보를 확인합니다. `.env` 설정 또는 실제 workspace가 맞지 않으면 서버를 열지 않습니다.

- `POST /slack/events`: 명령, 메시지 바로가기, 모달 제출, Work Object 열기, 파일 공유·멘션·삭제·공유 해제 이벤트.
- `/editor/`, `/studio/`: 자체 호스팅 production 편집 자산.
- `/api/editor/*`: ticket 교환·인증 원본 읽기·편집본 저장·결과 조회. [API 경계](architecture.md)를 참고하세요.
- `GET /healthz`: 프로세스 상태. 문서나 설정 값을 반환하지 않습니다.
- 앱 등록 주소는 HTTPS로 이 서버에 전달해야 합니다. Stage 6에서는 사용자 승인으로 임시 Cloudflare 터널을 연결했습니다.

## 명령과 파일 선택

| 입력 | 처리 | 연결 |
| --- | --- | --- |
| `/rhwp open <파일 링크>` | 접근 확인·Work Object 생성 | Studio 편집으로 직접 열기 |
| `/rhwp edit <파일 링크>` | open과 동일 | Studio 편집으로 직접 열기 |
| `/rhwp pdf <파일 링크>` | 접근 확인·PDF 변환·공유 | Slack에 공유한 PDF로 보기 |
| `/rhwp help` | 사용법과 미제공 기능 안내 | 동일 |
| `/rhwp settings` | 지정 관리자만 채널과 동작 모드 설정 | Slack 설정 창 |
| HWP/HWPX 업로드 | 파일 공유 이벤트로 원본 메시지 식별 | 원본 스레드에 미리보기 댓글 한 개 |
| `@rhwp` + 첨부 / 관찰한 스레드 | 첨부 또는 같은 스레드의 관찰 파일 사용 | 자동 업로드 요청과 같은 댓글 재사용 |
| 메시지 메뉴 → 한글 문서 열기 | HWP/HWPX가 여러 개면 선택 창 | 선택한 원본을 Studio로 열기 |

링크는 설정된 workspace의 `https://workspace.slack.com/files/USER/FILE_ID/파일명` 형식입니다. Slack의 `<url|이름>` 표기와 한글 파일명 인코딩을 처리합니다. 메시지 permalink·다른 workspace·임의 외부 URL은 지원하지 않습니다. `/rhwp thumbnail`과 `/rhwp png`는 미제공 안내를 반환하며 페이지 PNG/ZIP 요구는 후속 task에 유지합니다.

Slack이 명령에 붙여 넣은 파일 URL을 제목 링크로 치환하면 URL 대신 제목만 전달해 명령이 실패할 수 있습니다. 붙여넣기 직후 실행 취소(Cmd+Z/Ctrl+Z)를 한 번 눌러 URL을 복원하거나 메시지 메뉴의 **한글 문서 열기**를 사용하세요.

파일 선택 창은 서명된 원본 메시지의 후보만 제시합니다. 선택을 제출하면 그 파일의 실제 공유·권한을 다시 확인합니다. 선택 ID는 사용자·workspace·원래 채널·후보에 결속되어 5분 뒤 만료되며 성공 제출 후 재사용되지 않습니다. 취소된 선택은 만료 시 정리합니다. 한 메시지의 후보가 100개를 넘으면 파일 링크 하나를 지정하도록 안내합니다.

## 접근 판정

1. Bolt가 raw body 서명과 시각을 검증합니다. 동일 workspace의 설정된 일반 채널만 처리합니다.
2. `conversations.info`에서 요청 채널·bot 참여·일반 채널 여부와 외부/조직 공유·공유 전환 여부를 확인합니다.
3. `conversations.members`의 페이지를 모두 확인합니다. 요청자가 보여도 후속 페이지가 불완전하거나 cursor가 반복되면 거절합니다.
4. `files.info`가 반환한 hosted 파일의 ID, 20 MiB 이하 크기, HWP/HWPX 이름, 제한 공유 여부, 같은 team의 현재 채널 공유 기록을 확인합니다.
5. 허용된 인증 URL에서 다운로드하고 signature·실제 byte 크기를 검사합니다. 다운로드가 끝난 뒤 권한과 파일 메타데이터를 다시 확인합니다.

`is_external: false`와 현재 채널·team의 `shares` 기록을 요구합니다. 제한 공유 플래그가 있으면 명시적 false만 허용합니다. [Slack 일반 업로드 응답 예제](https://docs.slack.dev/messaging/working-with-files/)와 실제 비공개 테스트 파일은 이 플래그를 생략합니다. 이 형태는 `file_access: visible`, 같은 `user_team`, `has_more_shares: false`, 유효한 `channels`·`groups`·빈 `ims`, 해당 종류의 목록에 요청 채널 존재를 추가로 요구합니다. 플래그 생략만으로 허용하지 않으며 명시적 제한·불완전 공유·멤버 목록은 거절합니다. 이는 채널 공유와 멤버십을 조합한 앱 정책이며 사용자별 Slack 권한 API와 동등하다고 주장하지 않습니다.

DM/MPDM, Slack Connect, 조직 공유, 제한된 사용자 공유, remote file은 지원하지 않습니다. 준비 상태의 `ready`는 원본 byte 준비 완료이며 파서·조판·PDF 성공을 의미하지 않습니다. 페이지 수와 실제 파싱은 Studio/PDF에서 검사하며, 편집본 업로드 전에도 격리된 파서로 검사합니다.

## 요청 수명과 실패 처리

| 항목 | 제한 |
| --- | --- |
| 명령 접수 | 권한 조회·다운로드 전에 ack, 3초 이내 목표 |
| 다운로드 | 30초, 20 MiB, 실제 크기와 metadata 크기 일치 |
| Slack API | 호출 전체 30초·각 전송 10초, 읽기만 최대 2회 추가 재시도 |
| 준비 작업 | 전체 120초, 동시 2개, 대기열 20개 |
| 원본 보관 | 15분, 총 200 MiB (진행 중 작업당 입력 최대 크기 예약) |
| 작업 metadata | 24시간, 최대 1,000개 |
| 중복 식별 | 24시간, 각 저장소 최대 10,000개 |
| 모달 선택 | 5분, 최대 1,000개 |
| 편집 ticket | 60초, 한 번만 교환, 최대 1,000개 |
| 편집 세션 | 10분 idle·최대 60분, 최대 1,000개 |
| 저장 입력·파싱 | 20 MiB·200페이지, 수신 30초·격리 파서 30초, 동시 저장 2개 |
| 저장 요청 기록 | 60분, 최대 1,000개; team·user·channel·부모 카드·요청 ID·내용 hash로 결속 |
| PDF 작업 | 실행 1개·실행 포함 최대 4개, 변환 60초·PDF 50 MiB, PNG 각각 5 MiB·합계 25 MiB·최대 10페이지 |

읽기 요청의 429/5xx만 제한적으로 재시도합니다. 429는 Retry-After를 따르되 30초 전체 제한을 넘기지 않습니다. 메시지와 모달 쓰기는 응답이 불확실할 때 자동 재시도하지 않습니다. 알림 실패가 이미 완료한 다운로드를 반복하게 만들지 않습니다. bot이 채널에 없거나 Slack이 알림을 거절하면 최종 ephemeral 알림은 전달되지 않을 수 있습니다.

`files.slack.com/files-pri/TEAM-FILE/` 경로만 인증 다운로드에 사용합니다. 리다이렉트는 수동으로 최대 2번 검사하며 같은 host·문서 경계 밖으로 토큰을 전달하지 않습니다. 다른 CDN 경로를 실제로 확인하기 전 허용 목록을 넓히지 않습니다.

raw payload, response_url, 토큰·서명, Slack의 원문 오류를 로그에 기록하지 않습니다. `response_url`을 호출하지 않으며 알림과 모달은 고정 Slack API 주소를 사용합니다. 원본과 편집본 입력은 디스크에 기록하지 않고 프로세스 메모리와 파이프로 전달합니다. 만료 자료는 접근 시 또는 1분 주기로 정리합니다. 파일 삭제·공유 해제 이벤트는 같은 workspace의 관련 작업·보관 byte·편집 ticket·세션을 만료시킵니다. SQLite의 중복 식별·연결 정보로 재시작 복구를 수행합니다. 프로세스 자체의 OS 메모리 하드 상한은 제공하지 않습니다.

## 편집본 저장과 PDF

- 명령 실행은 지정 채널에, 메시지 메뉴 실행은 원본 메시지의 스레드에 카드와 파일을 공유합니다. 기존 스레드에서는 부모 thread_ts를 유지합니다. 클릭 payload의 임의 thread_ts로 저장 위치를 바꾸지 않습니다.
- 카드의 **문서 제목** 또는 **사이드 패널에서 열기**는 PDF를 기다리지 않고 Studio를 엽니다. 일반 action 버튼의 trigger는 실제 Slack에서 entity.presentDetails가 invalid_trigger_id로 거절하므로 별도 문서 열기 버튼은 제공하지 않습니다. PDF와 첫 3페이지 PNG를 비공개 업로드합니다. PDF는 카드 metadata, PNG는 `chat.update.file_ids`로 같은 메시지에 공유합니다. 추가 페이지는 최대 10까지 같은 댓글의 갤러리에 붙입니다. **PDF로 보기**는 그 메시지 상단의 실제 Slack 파일 링크이며, URL action 버튼을 사용하지 않습니다.
- 편집본 저장은 새 HWP/HWPX를 만듭니다. 이름은 `원본명_편집본_1.hwp`처럼 번호를 붙이며 형식은 `.hwp` 또는 `.hwpx`이며 원본 파일·원본 PDF는 바꾸지 않습니다. 저장 성공 뒤 같은 편집본 bytes로 PDF·PNG를 생성해 해당 수정본 카드에 갱신합니다. 수정본 제목을 누르면 그 수정본을 Studio에서 다시 편집합니다.
- 업로드 완료 호출은 파일 ID마다 한 번만 수행합니다. 비공개 업로드 완료와 카드에 대한 실제 공유를 구분합니다. 응답이 불확실하면 동일 파일의 공유 상태로 확인하며, 클라이언트의 **같은 저장 요청 다시 확인**은 같은 ID·bytes를 재전송합니다. 불확실한 파일을 두고 새 사본을 자동 생성하지 않습니다.
- PDF 실패는 HWP/HWPX 저장 성공을 취소하지 않습니다. 저장 중 추가 편집은 Studio dirty 상태와 저장 패널에 남습니다. PDF 전용 재시도 버튼은 아직 없으며 저장된 파일에 `/rhwp pdf <파일 링크>`를 사용할 수 있습니다.
- 재시작 시 편집 세션은 만료되므로 Slack 카드에서 다시 엽니다. 카드·저장 영수증과 업로드 단계는 DB에 유지합니다. 원본 캐시 만료 후에는 권한 재확인과 인증 다운로드로 같은 카드를 복구합니다. 미저장 편집 bytes는 복구하지 않으며 모든 장애 지점에서 정확히 한 번의 저장을 보장하지 않습니다.

## 검증

```sh
npm run typecheck
npm test
npm run test:slack
npm run test:security
npm run test:viewer
git diff --check
```

테스트는 합성 자격 증명과 API 응답을 사용하며 실제 Slack에 메시지·파일을 전송하지 않습니다. 실제 Bolt HTTP 수신기에 유효·변조·만료 서명, 외부 team/app/channel, 명령과 모달 제출을 보내 검증합니다. HWP 테스트 원본은 이 저장소가 만든 fixture입니다. 실제 Slack 앱 설치·manifest 수용·웹/데스크톱의 PDF 미리보기와 Studio iframe은 별도 검증 항목입니다.

## 공식 근거

- [Bolt의 빠른 요청 확인](https://docs.slack.dev/tools/bolt-js/concepts/acknowledge/): ack와 오래 걸리는 작업을 분리합니다.
- [Slack 파일 객체](https://docs.slack.dev/reference/objects/file-object/): 인증 다운로드, 공유와 제한 접근 필드를 확인합니다.
- [conversations.info](https://docs.slack.dev/reference/methods/conversations.info/), [files.info](https://docs.slack.dev/reference/methods/files.info/): 채널과 파일의 현재 상태를 조회합니다.
- [메시지 바로가기 payload](https://docs.slack.dev/reference/interaction-payloads/shortcuts-interaction-payload/): 선택할 메시지와 호출 사용자를 식별합니다.
- [file_unshared](https://docs.slack.dev/reference/events/file_unshared/): 공유 해제 시 보관 자료를 무효화합니다.
- [App manifest](https://docs.slack.dev/reference/app-manifest/): 명령·메뉴·scope·수신 주소를 설정합니다.

- [Work Objects 구현](https://docs.slack.dev/messaging/work-objects-implementation/), [embeds](https://docs.slack.dev/messaging/work-objects-embeds/): 카드 metadata, 사용자별 preview_url, domain·sandbox·CSP 설정.
- [entity_details_requested](https://docs.slack.dev/reference/events/entity_details_requested/), [entity.presentDetails](https://docs.slack.dev/reference/methods/entity.presentDetails/): 실제 event.user/channel/trigger_id 계약.
- [업로드 URL 발급](https://docs.slack.dev/reference/methods/files.getUploadURLExternal/), [업로드 완료](https://docs.slack.dev/reference/methods/files.completeUploadExternal/): 파일 ID별 업로드와 공유 완료.

## 처음 Slack 앱을 등록하는 순서

설치된 Slack 클라이언트와 이 서비스의 개발용 Slack 앱은 다릅니다. 개발용 앱은 `/rhwp` 명령·파일 권한·버튼·서명 키를 등록하는 설정입니다. [공식 앱 설정 안내](https://docs.slack.dev/app-management/quickstart-app-settings/)와 [manifest 안내](https://docs.slack.dev/app-manifests/)를 참고합니다.

### 1. 주소 없이 앱부터 만들기

```sh
mkdir -p .cache/slack
node scripts/slack-manifest.mjs --bootstrap > .cache/slack/bootstrap-manifest.json
```

[Slack 앱 관리](https://api.slack.com/apps) → Create New App → From a manifest에서 테스트할 workspace를 선택하고 생성한 JSON을 붙여 넣습니다. 초기 JSON에는 bot·필요 scope만 있고 아직 검증할 수 없는 request URL은 없습니다. 회사 workspace가 앱 설치를 제한하면 관리자 승인이 필요합니다.

OAuth & Permissions → Install to Workspace로 설치한 뒤 아래 값을 로컬 `.env`에 입력합니다. 비밀값을 채팅·스크린샷·Git에 남기지 않습니다. Client Secret과 App-Level Token(xapp)은 사용하지 않습니다.

| .env 항목 | 확인 위치 |
| --- | --- |
| SLACK_APP_ID | Basic Information의 App ID (`A…`) |
| SLACK_SIGNING_SECRET | Basic Information의 Signing Secret |
| SLACK_BOT_TOKEN | OAuth & Permissions의 Bot User OAuth Token (`xoxb-…`) |
| SLACK_TEAM_ID | 브라우저 Slack 주소 `app.slack.com/client/T…/C…`의 `T…` |
| SLACK_WORKSPACE_HOST | workspace의 `이름.slack.com` hostname |
| SLACK_CHANNEL_IDS | 테스트 채널 상세 정보의 채널 ID (`C…` 또는 `G…`) |
| APP_ORIGIN | 다음 단계의 `https://…` 주소, 경로 제외 |

테스트 채널에 앱 `@rhwp`와 본인이 참여합니다. 첫 검증에는 저장소의 합성 fixture를 사용합니다.

### 2. 로컬 서버용 HTTPS 주소 마련

Slack은 `127.0.0.1`에 접근할 수 없으므로 인터넷에서 접근 가능한 HTTPS 주소가 필요합니다. 자체 서버가 없으면 [Cloudflare Quick Tunnel](https://developers.cloudflare.com/cloudflare-one/networks/connectors/cloudflare-tunnel/do-more-with-tunnels/trycloudflare/)을 사용할 수 있습니다. 계정·도메인 구매 없이 임시 주소를 발급하는 개발 시험용 기능입니다.

macOS에서 별도 터미널에 다음을 실행하고 유지합니다.

```sh
brew install cloudflared
cloudflared tunnel --url http://127.0.0.1:3000
```

출력의 `https://…trycloudflare.com`을 APP_ORIGIN에 입력합니다. 로컬 3000번 서버가 인터넷에 노출되고 트래픽이 터널 제공자를 경유합니다. **개발 전용 4173 서버를 공개하지 않습니다.** 서버가 아직 꺼져 있으면 터널은 502를 반환하며 서버 실행 후 다시 확인합니다. 임시 주소가 바뀌면 APP_ORIGIN·Slack request URL·embed 도메인을 함께 갱신해야 합니다.

### 3. 서버 실행 후 명령·이벤트 연결

```sh
npm run build
npm run preflight:slack
npm run start:slack
```

사전검사는 auth.test와 자산 확인만 수행하며 메시지·파일을 보내지 않습니다. 서버와 터널을 유지한 채 별도 터미널에서 연결용 JSON을 생성합니다.

```sh
node scripts/slack-manifest.mjs --origin https://YOUR-HOST.trycloudflare.com > .cache/slack/connected-manifest.json
```

앱 설정의 App Manifest에 이 JSON을 적용하고 Event Subscriptions의 request URL이 Verified인지 확인합니다. 모든 수신 주소는 `https://YOUR-HOST/slack/events`입니다. 필요하면 앱을 재설치합니다.

Work Object Previews에서 file entity·embeds를 활성화하고 허용 도메인에 `YOUR-HOST.trycloudflare.com`을 등록하며 `allow-same-origin`을 켭니다. 메뉴가 없으면 app 유형/관리자 정책을 확인해야 합니다. [Slack embeds 조건](https://docs.slack.dev/messaging/work-objects-embeds/)을 따릅니다.

### 4. 실제 수용 확인

1. 테스트 채널에서 `/rhwp help`로 명령 응답을 확인합니다.
2. `tests/fixtures/viewer-two-pages.hwp` 또는 `.hwpx`를 올리고 메시지 메뉴의 한글 문서 열기를 실행합니다.
3. 문서 열기에서 Studio가 Slack 내부에 표시되는지, PDF로 보기에서 PDF가 열리는지 웹·데스크톱 각각 확인합니다.
4. 두 번 저장 후 같은 스레드에 수정본 카드 두 개만 생기는지 확인합니다. 각 카드의 수정 내용·PNG·PDF를 확인하고 수정본 제목으로 다시 편집합니다. 원본은 불변이어야 합니다.
5. 저장 중 추가 입력·실패 후 재확인·채널 탈퇴/공유 해제·ticket 만료를 확인합니다.

실행 실적은 [Stage 6 보고서](../mydocs/working/task_m010_1_stage6.md)에 기록합니다. 현재 비공개 채널의 명령·웹 편집/저장·데스크톱 Studio 열기·PDF 첨부 미리보기는 확인했습니다. 실제 탈퇴/공유 해제 및 저장 장애 주입 등은 자동 검사와 구분해 수용 대기로 남깁니다.

PDF 링크는 Slack mrkdwn 파일 링크로 구현합니다. 실제 Slack 웹에서 같은 탭의 미디어 뷰어, macOS 데스크톱에서 Slack PDF 뷰어로 두 페이지가 열리는 것을 확인했습니다. Work Object의 URL action은 외부 브라우저로 이동하므로 제거했습니다. PDF 링크를 같은 메시지 상단에 표시하고 PNG는 Slack 기본 이미지 갤러리를 사용합니다. [Slack Work Objects 파일 자동 공유](https://docs.slack.dev/messaging/work-objects-implementation/#automatic-file-shares)를 사용합니다.

## Linux 컨테이너 실행

```sh
docker build --target release -t rhwp-slack:local .
# .env와 HTTPS 주소를 준비한 후:
docker compose up -d
docker compose ps
```

Dockerfile은 Node 24.21.0/npm 11.19.0 이미지의 digest를 고정합니다. `.dockerignore` 허용 목록만 빌드에 사용하므로 로컬 .env·.git·.cache·개인 문서를 전달하지 않습니다. Studio는 고정 commit을 fetch한 뒤 지정 경로의 archive SHA-256을 검사합니다.

Compose는 재시작 정책 `unless-stopped`, `/app/data`의 영속 `rhwp-state` volume, node 사용자, 읽기 전용 root, 임시 /tmp, 4 GiB 메모리·2 CPU·256 PID, capability 제거와 no-new-privileges를 적용합니다. host의 `127.0.0.1:3000`에만 포트를 공개하며 TLS는 터널 또는 운영 reverse proxy가 담당합니다. 컨테이너 내부 HOST는 0.0.0.0, 로컬 일반 실행 기본값은 127.0.0.1입니다.

```sh
docker build --target smoke -t rhwp-slack:smoke .
docker run --rm --init --network none --read-only \
  --tmpfs /tmp:rw,nosuid,nodev,size=512m,mode=1777 \
  --shm-size=256m --memory=4g --cpus=2 --pids-limit=256 \
  --cap-drop=ALL --security-opt=no-new-privileges rhwp-slack:smoke
```

smoke target만 합성 fixture·테스트를 포함합니다. 실제 runtime 계층에서 non-root·read-only, 권한/저장 검사와 production HTTP·Studio·PDF 변환을 실행합니다. 외부 네트워크 없이 Slack API를 합성 응답으로 대체합니다. release에는 테스트 파일·개발 호스트 번들이 없습니다. HEALTHCHECK는 /healthz를 확인하며 Slack/PDF 서비스의 지속적인 가용성을 보증하지 않습니다.

컨테이너 격리와 Chromium 내부 sandbox는 다릅니다. 현재 Playwright 기본 launch의 Chromium 내부 sandbox는 켜지지 않습니다. 앱이 만든 로컬 print 문서만 렌더링하고 외부 요청을 차단하지만 완전한 비신뢰 파일 격리로 간주하지 않습니다. 운영 배포 전 별도 worker 경계·egress 정책·Chromium sandbox 지원을 검토해야 합니다. privileged나 SYS_ADMIN 추가 우회는 사용하지 않습니다.

전체 smoke는 서버와 사용자의 Studio 브라우저까지 같은 컨테이너에서 실행합니다. 서버 단독 검사는 같은 4g 제한에서 이미지 뒤에 `node scripts/container-smoke.mjs --server-only`를 붙입니다. Linux ARM64의 2 GiB 서버 단독 검사는 실제 PDF 변환 중 OOM으로 실패했고, 4 GiB에서 합성 HWP/HWPX가 통과했습니다(당시 cgroup peak 2,259,009,536 bytes). 이는 합성 입력의 실측이며 20 MiB·200페이지 최대 입력의 자원 보장은 아닙니다.

### 편집본을 모으는 스레드

Slack 클라이언트는 이미지·PDF·편집 카드를 같은 댓글 안의 첨부 묶음으로 표시할 수 있습니다. 기본 갤러리에서는 일부 썸네일과 `+N`이 보이고 이미지를 누르면 Slack 미디어 뷰어에서 넘겨 볼 수 있습니다. 편집 패널 등 다른 위치에서는 목록이나 격자로 표시될 수 있으며 펼침 상태·가로 스크롤 여부를 앱에서 강제하지 않습니다.

명령어로 만든 최상위 문서 카드는 자신의 메시지를 부모로 삼아 이후 수정본 카드를 답글로 추가합니다. 최초 PDF·PNG는 원본 카드에, 수정본 PDF·PNG는 해당 수정본 카드에 갱신하며 별도 댓글을 생성하지 않습니다. 기존 스레드에서 만든 카드는 그 스레드의 부모를 유지합니다. 클라이언트가 전달한 임의의 스레드 대신 서버가 게시한 카드의 대화를 사용하며, 부모를 확인하지 못하면 채널 최상위로 대체 업로드하지 않습니다. 서버 갱신 후에는 새 명령으로 만든 카드에서 확인하세요. 이전에 최상위로 게시한 테스트 파일은 자동 이동하지 않습니다.

## 자동 미리보기와 갤러리 테스트

1. 최신 manifest의 `file_shared`·`app_mention` 구독과 `app_mentions:read` 설치를 확인하고 서버를 다시 실행합니다.
2. `node scripts/create-preview-fixture.mjs`로 `.cache/test-documents/`에 12페이지 합성 HWP/HWPX를 만듭니다. 생성물은 Git에 포함하지 않습니다.
3. 허용 채널에 파일을 업로드합니다. 원본 메시지 스레드에 댓글이 한 개 생기고 PDF 링크·첫 3페이지 이미지·편집 카드가 준비되는지 확인합니다.
4. **추가 페이지 보기**를 눌러 같은 댓글에 1~10페이지가 순서대로 붙는지 확인합니다. 전체 12페이지는 **PDF로 보기**로 확인합니다.
5. 편집 카드 제목으로 Slack 내부 Studio를 열고 편집본을 저장합니다. 원본 스레드에 수정본 댓글 한 개가 추가되고, 그 댓글의 PDF·PNG가 준비되어야 합니다.
6. 파일과 `@rhwp`를 함께 보내거나 이미 감지한 스레드에서 멘션해도 미리보기 댓글이 중복되지 않는지 확인합니다. 서버가 관찰하지 못한 이전 스레드는 원본 메시지 메뉴로 요청합니다.

일반 채널 history 권한은 필요하지 않습니다. 업로드 자동 감지는 `files:read`, 멘션 수신은 `app_mentions:read`를 사용하며, 파일 다운로드·변환 전에 기존 채널 참여/공유 검사를 수행합니다. 원본 메시지에 여러 사람의 공유 기록이 있으면 위치를 추측하지 않고 메시지 메뉴를 안내합니다. 이미 준비된 원본 bytes는 15분 뒤 만료되며, 같은 카드를 열거나 확장할 때 권한을 재확인하고 다시 다운로드합니다.

## 내부 워크스페이스 운영

1. `.env`의 `STATE_DB_PATH`를 영속 디스크에 두고 `SLACK_ADMIN_USER_IDS`에 승인된 관리자의 Slack 사용자 ID를 넣습니다. 관리자가 없어도 최초 활성 채널의 문서 사용은 가능하지만 설정 변경은 불가합니다.
2. 최신 manifest의 Home 탭·`app_home_opened`·`reactions:write`를 앱에 적용하고 필요한 권한을 승인하여 재설치합니다. 이후 `SLACK_REACTIONS_ENABLED=true`로 켭니다.
3. 신규 채널에 rhwp를 초대한 뒤 관리자가 rhwp Home 또는 `/rhwp settings`에서 채널과 모드를 선택합니다. 자동 감지는 업로드만으로 실행하며, 멘션 요청 모드는 첨부와 `@rhwp` 또는 메시지 메뉴/명령으로 실행합니다. 사용 안 함은 해당 채널의 문서 접근을 차단합니다.
4. 채널에 참여한 동료가 합성 HWP/HWPX를 올려 ⏳→✅, 스레드 댓글, PDF/갤러리/Studio와 편집본 저장을 확인합니다. 관리자 권한은 일반 문서 사용에 필요하지 않습니다.
5. 새 카드 생성 후 서버를 재시작하고 같은 카드에서 다시 여는지 확인합니다. DB 도입 전에 메모리에만 있던 카드는 새로 만들어야 합니다.

### 고정 HTTPS로 이전

현재 로컬 Mac과 Quick Tunnel은 컴퓨터·서버·터널이 실행 중일 때만 접근할 수 있습니다. 운영에는 고정 도메인의 HTTPS reverse proxy 또는 named tunnel과 계속 실행되는 서버가 필요합니다. GitHub Pages만으로는 이벤트 수신·인증·PDF 변환·DB를 실행할 수 없습니다.

운영자가 호스트를 정하면 production 서버와 영속 DB를 배치하고 `APP_ORIGIN`, Slack의 모든 request URL, Work Object embed 도메인을 같은 주소로 갱신합니다. 서버만 이동할 때도 기존 DB를 함께 이전해야 합니다. DB의 카드 origin 기록은 알려진 과거 카드 연결을 식별하는 용도이며 오래된 호스트 자체를 계속 운영한다는 의미는 아닙니다.

백업은 SQLite backup API 또는 서버를 정상 종료한 뒤 DB와 남아 있는 `-wal`/`-shm` 파일을 한 묶음으로 보관합니다. 실행 중 DB 본체만 복사하지 않습니다. Compose의 `down -v`는 영속 volume을 삭제하므로 운영 자료가 있는 환경에서 사용하지 않습니다.

이번 범위는 단일 workspace입니다. 다른 workspace 설치용 OAuth·테넌트별 자격 증명 관리·Marketplace 심사 및 배포형 embeds 이용 승인은 별도입니다.

### Cloud Run 검증·시험 운영 환경

로컬 운영을 유지한 채 별도 Cloud Run 환경에서 검증할 수 있다. Firestore 메타데이터, Cloud Tasks, Secret Manager 설정과 이전 조건은 [Cloud Run 운영](cloud-run.md)을 따른다. 현재 워크스페이스는 2026-09-17 고정 Cloud Run 주소로 전환했다. 검증 namespace와 운영 namespace/큐를 구분하고, 상세 수용 결과·잔여 항목은 [Stage 12](../mydocs/working/task_m010_1_stage12.md)를 따른다.
