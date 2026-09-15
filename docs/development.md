# Slack 개발 서버 설정

## 현재 범위

Stage 4는 실제 Bolt HTTP receiver, `/rhwp` 명령·메시지 파일 선택, 파일 접근 확인·다운로드까지 구현합니다. **Slack 안에서 Studio를 여는 세션과 PDF 업로드는 Stage 5**입니다. 현재 명령은 문서 준비 결과와 아직 제공하지 않는 연결을 안내하며 동작하지 않는 링크를 만들지 않습니다.

로컬 편집기는 별도로 `npm run dev`를 사용합니다. [일반 편집 화면](http://127.0.0.1:4173/editor/)과 [테스트 파일 선택 화면](http://127.0.0.1:4173/editor/?devtools=1)은 기존 경로를 유지합니다. Slack 요청 서버에는 개발 문서 API나 원본 다운로드 HTTP 경로를 노출하지 않습니다.

## 설정 준비

1. Node 24.21.0/npm 11.19.0에서 `npm ci`를 실행합니다.
2. `slack/manifest.json`의 `https://example.invalid/slack/events` 세 곳을 운영자가 준비한 동일한 HTTPS 수신 주소로 바꿉니다. 예제 주소는 사용할 수 없습니다.
3. 테스트 워크스페이스에 manifest로 앱을 만들고 설치합니다. 전체 조직 설치는 이 버전에서 지원하지 않습니다.
4. 앱의 Signing Secret, Bot User OAuth Token, App ID, Team ID를 로컬 `.env`에 입력합니다. `.env.example`을 복사해 사용하며 비밀값을 Git·이슈·채팅에 기록하지 않습니다.
5. `SLACK_WORKSPACE_HOST`에는 URL이 아닌 `my-workspace.slack.com` 형태의 hostname, `SLACK_CHANNEL_IDS`에는 허용할 일반 채널 ID를 쉼표로 입력합니다.
6. 허용 채널에 bot을 초대하고 요청자도 해당 채널에 참여하게 합니다. 공개·비공개 채널 모두 이 조건이 필요합니다.

앱 등록·설치·HTTPS 연결은 실제 Slack 관리 작업입니다. 이 저장소의 로컬 테스트나 manifest 생성만으로 설치가 완료되지 않습니다.

## 실행

```sh
cp .env.example .env
# 로컬 편집기에서 .env 값을 입력한 다음:
npm run start:slack
```

서버는 기본 `127.0.0.1:3000`에서 실행하며 `PORT`로 포트를 바꿀 수 있습니다. 시작 시 `auth.test`로 토큰의 workspace·bot 정보를 확인합니다. `.env` 설정 또는 실제 workspace가 맞지 않으면 서버를 열지 않습니다.

- `POST /slack/events`: 명령, 메시지 바로가기, 모달 제출, 파일 삭제·공유 해제 이벤트.
- `GET /healthz`: 프로세스 상태. 문서나 설정 값을 반환하지 않습니다.
- 앱 등록 주소는 HTTPS로 이 서버에 전달해야 합니다. 이 단계에 외부 배포·터널 생성은 포함하지 않습니다.

## 명령과 파일 선택

| 입력 | 현재 처리 | 최종 연결 |
| --- | --- | --- |
| `/rhwp open <파일 링크>` | 원본 접근 확인·다운로드 | Studio 편집으로 직접 열기 |
| `/rhwp edit <파일 링크>` | open과 동일 | Studio 편집으로 직접 열기 |
| `/rhwp pdf <파일 링크>` | PDF 열람용 원본 준비 | Slack에 공유한 PDF로 보기 |
| `/rhwp help` | 사용법과 미제공 기능 안내 | 동일 |
| 메시지 메뉴 → 한글 문서 열기 | HWP/HWPX가 여러 개면 선택 창 | 선택한 원본을 Studio로 열기 |

링크는 설정된 workspace의 `https://workspace.slack.com/files/USER/FILE_ID/파일명` 형식입니다. Slack의 `<url|이름>` 표기와 한글 파일명 인코딩을 처리합니다. 메시지 permalink·다른 workspace·임의 외부 URL은 지원하지 않습니다. `/rhwp thumbnail`과 `/rhwp png`는 미제공 안내를 반환하며 페이지 PNG/ZIP 요구는 후속 task에 유지합니다.

파일 선택 창은 서명된 원본 메시지의 후보만 제시합니다. 선택을 제출하면 그 파일의 실제 공유·권한을 다시 확인합니다. 선택 ID는 사용자·workspace·원래 채널·후보에 결속되어 5분 뒤 만료되며 성공 제출 후 재사용되지 않습니다. 취소된 선택은 만료 시 정리합니다. 한 메시지의 후보가 100개를 넘으면 파일 링크 하나를 지정하도록 안내합니다.

## 접근 판정

1. Bolt가 raw body 서명과 시각을 검증합니다. 동일 workspace의 설정된 일반 채널만 처리합니다.
2. `conversations.info`에서 요청 채널·bot 참여·일반 채널 여부와 외부/조직 공유·공유 전환 여부를 확인합니다.
3. `conversations.members`의 페이지를 모두 확인합니다. 요청자가 보여도 후속 페이지가 불완전하거나 cursor가 반복되면 거절합니다.
4. `files.info`가 반환한 hosted 파일의 ID, 20 MiB 이하 크기, HWP/HWPX 이름, 제한 공유 여부, 같은 team의 현재 채널 공유 기록을 확인합니다.
5. 허용된 인증 URL에서 다운로드하고 signature·실제 byte 크기를 검사합니다. 다운로드가 끝난 뒤 권한과 파일 메타데이터를 다시 확인합니다.

`is_restricted_sharing_enabled: false`, `is_external: false` 및 현재 채널의 `shares` 항목을 명시적으로 요구합니다. 제한 공유 필드가 없는 응답을 일반 공유로 추정하지 않습니다. 채널의 필수 공유 상태 필드나 멤버 목록 cursor가 누락되어도 실패합니다. **실제 workspace가 이 증거를 제공하지 않으면 해당 경로는 미지원**입니다. 실제 API 응답과 대조하기 전 이 정책이 모든 일반 문서에서 작동한다고 주장하지 않습니다.

DM/MPDM, Slack Connect, 조직 공유, 제한된 사용자 공유, remote file은 지원하지 않습니다. 준비 상태의 `ready`는 원본 byte 준비 완료이며 파서·조판·PDF 성공을 의미하지 않습니다. 페이지 수와 실제 파싱은 Studio/PDF 연결 경로에서 추가로 검사해야 합니다.

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

읽기 요청의 429/5xx만 제한적으로 재시도합니다. 429는 Retry-After를 따르되 30초 전체 제한을 넘기지 않습니다. 메시지와 모달 쓰기는 응답이 불확실할 때 자동 재시도하지 않습니다. 알림 실패가 이미 완료한 다운로드를 반복하게 만들지 않습니다. bot이 채널에 없거나 Slack이 알림을 거절하면 최종 ephemeral 알림은 전달되지 않을 수 있습니다.

`files.slack.com/files-pri/TEAM-FILE/` 경로만 인증 다운로드에 사용합니다. 리다이렉트는 수동으로 최대 2번 검사하며 같은 host·문서 경계 밖으로 토큰을 전달하지 않습니다. 다른 CDN 경로를 실제로 확인하기 전 허용 목록을 넓히지 않습니다.

raw payload, response_url, 토큰·서명, Slack의 원문 오류를 로그에 기록하지 않습니다. `response_url`을 호출하지 않으며 알림과 모달은 고정 Slack API 주소를 사용합니다. 현재 원본은 디스크에 기록하지 않고 프로세스 메모리에만 보관합니다. 만료 자료는 접근 시 또는 1분 주기로 정리합니다. 파일 삭제·공유 해제 이벤트는 같은 workspace의 관련 작업과 보관 byte를 만료시킵니다. 재시작을 넘는 중복 방지·복구나 OS 메모리 하드 상한은 제공하지 않습니다.

## 검증

```sh
npm run typecheck
npm test
npm run test:slack
npm run test:security
npm run build
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
