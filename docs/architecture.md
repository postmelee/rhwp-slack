# Slack 문서 편집·저장 구조

## 실행 경계

Slack → 서명 검증된 Bolt → 채널·사용자·파일 권한 확인 → 메모리 원본 준비 → Work Object 카드로 이어집니다. 카드 열기는 사용자 권한을 다시 확인한 뒤 `entity.presentDetails`에만 편집 ticket을 제공합니다. 채널에 게시하는 metadata에는 인증 URL이나 ticket을 넣지 않습니다.

Studio는 자체 호스팅 SDK iframe입니다. 호스트가 인증 API에서 받은 bytes를 SDK에 전달합니다. Slack bot token은 브라우저에 전달하지 않습니다. 문서 복구·최근 문서·자동 저장·영속 이력은 사용하지 않으며 현재 undo/redo와 dirty 상태를 유지합니다. 초기화 전체는120초로 제한하며 실패 시 iframe을 정리하고 Slack 편집 카드에서 다시 열도록 안내합니다. 티켓 없는 외부 직접 열기는 빈 편집기를 시작하지 않습니다.

별도 PDF 보기 화면이나 편집/보기 전환은 없습니다. PDF는 앱이 Slack에 업로드·공유한 파일의 permalink로 연결합니다. 브라우저로 열리는 URL action 대신 같은 메시지의 mrkdwn 파일 링크를 사용합니다. PDF 링크는 같은 메시지 상단에 두고, 페이지 PNG는 공식 `chat.update.file_ids`로 같은 댓글에 추가합니다. 세로 이미지 블록 대신 Slack 기본 갤러리를 사용하며 Work Object는 편집 진입용 카드로 둡니다. 카드와 갤러리의 펼침·배치는 Slack 클라이언트가 결정합니다.

## 자동 업로드·멘션

`files:read`의 `file_shared` 이벤트와 `files.info.shares`에서 해당 채널의 원본 메시지를 식별합니다. 파일 소유자와 공유자는 다를 수 있으므로 `share_user_id`가 bot인 Work Object 재공유는 제외합니다. 사람의 공유 위치가 여러 개면 추측하지 않고 원본 메시지 메뉴로 안내합니다.

`app_mentions:read`는 멘션된 이벤트만 받습니다. 같은 메시지의 첨부 또는 최근 관찰한 같은 스레드의 파일 ID로 처리합니다. 파일 ID 관찰 기록과 중복 요청은 team/channel/parent/file에 결속하고 최대 1,000개·24시간으로 제한합니다. 일반 메시지 본문이나 `conversations.history`/`replies`를 조회·보관하지 않습니다. 앱이 관찰하지 못한 스레드는 원본 메시지 바로가기를 사용합니다.

## 영속 상태와 채널 정책

로컬 단일 서버 모드의 `STATE_DB_PATH` SQLite WAL DB는 workspace별 카드 ID·원본/수정본 파일 ID·메시지/스레드·업로드 단계·저장 영수증·관찰 기록·이벤트 중복 식별·반응 상태·채널 정책을 저장합니다. 원본/변환 bytes, 편집 ticket/token, 인증 다운로드·업로드 URL은 저장하지 않습니다. 운영 DB와 WAL 파일은 Git에 포함하지 않으며 접근 권한을 제한합니다. 카드 수는 최대 1,000개이고 무제한 보관 서비스가 아닙니다.

`SLACK_CHANNEL_IDS`는 최초 DB 생성 시 자동 감지 채널로 초기화합니다. 이후 DB 정책이 우선합니다. `SLACK_ADMIN_USER_IDS`의 관리자만 App Home 또는 `/rhwp settings`에서 자동 감지·멘션 요청·사용 안 함을 변경합니다. 설정 시에도 관리자와 bot의 채널 참여를 확인합니다. 일반 사용자는 관리자일 필요 없이 활성 채널에서 문서를 처리할 수 있습니다.

재시작 시 진행 중 준비/변환을 복구하되 이미 게시한 메시지나 완료한 PDF를 새로 만들지 않습니다. 기존 DB 카드의 기록된 origin만 주소 변경 후에도 인정합니다. 과거 서버가 DB 없이 만든 카드는 자동 이전되지 않습니다. 로컬 모드의 편집 세션은 재시작 시 만료되므로 Slack 카드에서 다시 열어야 합니다.

## HTTP API

| 경로 | 입력·인증 | 결과 |
| --- | --- | --- |
| POST `/api/editor/exchange` | JSON ticket, APP_ORIGIN과 일치하는 Origin | 메모리 bearer token |
| GET `/api/editor/document` | Authorization Bearer | 파일명·형식 |
| GET `/api/editor/source` | Authorization Bearer | 권한 확인 후 원본 bytes |
| POST `/api/editor/save` | Bearer, Origin, octet-stream, X-Save-Request-Id(UUID v4), X-Document-Format | 새 파일 저장 영수증과 PDF 상태 |
| GET `/api/editor/saves/:requestId` | 동일 세션 Bearer | 그 저장 요청의 결과 |

POST는 정확한 Origin을 요구합니다. GET은 bearer로 인증하고 Origin이 있으면 일치 여부를 검사합니다. query token·cookie·CORS 우회 경로를 제공하지 않습니다. 모든 API는 no-store/no-referrer를 적용합니다. production 정적 자산은 문서를 포함하지 않으며 CSP frame-ancestors는 자체 host와 Slack 조상을 허용합니다. 중첩 Studio SDK를 위해 Slack embeds의 allow-same-origin 설정이 필요합니다.

## ticket·세션·접근

- ticket은 무작위 256비트, 60초, 일회용입니다. 발급 시 확인한 team/user/channel/card에 결속합니다. 교환할 때 다시 권한을 확인하며 ticket은 원문 대신 SHA-256 key로 보관합니다.
- 호스트는 fragment를 iframe 생성 전에 URL에서 제거하고 token은 변수에만 보관합니다. 교환 후 세션은 10분 idle·최대 60분이며 지속적으로 사용할 때도 최대 수명을 연장하지 않습니다.
- 읽기·저장·결과 조회 시 채널 공유 상태, 요청자 멤버십, 원본 파일 공유를 다시 확인합니다. 파일 삭제·공유 해제 이벤트는 보관 원본과 해당 ticket·세션을 무효화합니다. HTTP body 수신 뒤에도 session을 다시 확인합니다.
- 준비 원본의 byte TTL은 15분입니다. 만료 후 처음 열기/재읽기는 저장된 카드의 권한을 재검사하고 원본을 다시 내려받습니다. 저장된 SHA-256과 다르면 거절합니다. 이미 연 Studio는 원본 bytes를 다시 읽지 않고도 세션이 유효한 동안 새 편집본을 저장할 수 있습니다.
- 앱은 단일 workspace와 명시적 허용 채널을 사용합니다. DM·Connect·조직/제한 공유는 미지원이며 누락된 권한 증거를 허용으로 추정하지 않습니다.

## 저장과 중복 처리

1. 호스트는 export 전후 `documentEpoch`, `changeSeq`, `documentSha256`가 같은지 확인합니다. 중간 변경이 있으면 새 저장을 요청하도록 안내합니다.
2. 동일 export에 UUID를 부여합니다. 서버는 team·user·channel·부모 카드·UUID·format/bytes hash를 결속하고 동시 요청은 동일 작업을 기다립니다. 같은 UUID에 다른 내용은 충돌 오류입니다.
3. 20 MiB·signature·형식을 검사하고 Slack 자격 증명 없는 별도 Node 프로세스에서 파싱합니다. 200페이지 상한과 30초 종료 제한을 적용합니다. 파서 실패 시 Slack 업로드를 시작하지 않습니다.
4. 업로드 URL은 HTTPS `files.slack.com/upload/v1/`만 허용합니다. 이 주소에는 bot token을 보내지 않고 redirect를 거부합니다. 최종 공유 직전에 접근 권한을 다시 확인합니다.
5. `completeUploadExternal`은 채널 없이 파일 ID마다 한 번만 시도해 비공개 업로드를 완료합니다. 그 파일 ID를 Work Object의 `slack_file`에 넣어 스레드 카드 한 개를 게시합니다. 실제 team·채널·부모·메시지 ts의 파일 공유 증거가 있어야 저장 성공입니다. 게시 응답 유실은 같은 파일의 share로 복구하고 새 카드를 자동 게시하지 않습니다.
6. 공유 완료가 확인된 HWP/HWPX 영수증은 PDF와 독립적입니다. 수정본 카드에는 독립 file ID·검증된 bytes·부모 카드·수정본 번호를 결속합니다. 제목으로 다시 열 때 해당 수정본과 최초 원본의 접근 권한을 재확인합니다. 동일 export bytes의 PDF와 첫 3페이지 PNG를 공유 변환 큐로 보낸 뒤 비공개 업로드합니다. PDF는 Work Object 참조, PNG는 `chat.update.file_ids`로 같은 메시지에 공유합니다. 추가 요청은 4~10페이지 중 없는 범위를 만들며 PDF를 다시 만들지 않습니다. 중간 페이지의 업로드가 실패하면 그 뒤 페이지의 공유를 보류해 재시도 후에도 첨부 순서를 지킵니다. 원본은 수정하지 않습니다.
7. 호스트는 저장 성공 후 Studio 내부의 `notifySavedIfUnchanged`를 호출합니다. Studio가 현재 revision을 동기 비교한 뒤, await 없이 clean 처리에 진입합니다. 업로드 중 추가 편집이 있으면 clean 처리하지 않습니다. PDF 실패도 성공한 HWP/HWPX 저장을 되돌리지 않습니다.

재시도 기록은 SQLite에 보관합니다. 새 세션에서도 같은 사용자·채널·부모 카드·UUID·내용의 성공 영수증을 재사용합니다. 게시 응답이 불확실하면 같은 파일의 공유 증거를 조회합니다. 모든 장애 지점의 exactly-once를 보장하지 않으며 업로드 전 bytes와 미저장 편집은 복구하지 않습니다. 동시 편집 병합이나 원본 덮어쓰기 기능은 제공하지 않습니다. 세션 만료는 이미 브라우저에 전달된 bytes를 회수하지 않으며 후속 서버 접근을 차단합니다.

## 자원과 검증 경계

준비 원본과 수정본 캐시는 합계 200 MiB, 다운로드 2개·대기 20개, PDF는 실행 포함 대기 4개·실행 1개, 저장은 동시 2개로 제한합니다. PDF 출력은 50 MiB, 페이지 PNG는 각각 5 MiB·800×1200, 한 요청 합계 25 MiB·최대 10페이지 이내입니다. PNG는 PDF와 같은 print DOM/폰트로 생성합니다. PDF/저장 큐에서 보유한 bytes와 파서·Chromium 메모리는 원본 보관량 외에 추가됩니다. Stage 6 Compose는 메모리 4 GiB·CPU 2개·PID 256개·read-only·non-root 제한을 적용합니다. PDF parser/Chromium 환경에서는 Slack 및 임의 호스트 비밀 환경변수를 제거합니다. Chromium 내부 sandbox·worker별 강한 격리·운영 egress 정책은 별도 잔여 항목입니다.

검증은 실제 Bolt HTTP·production 서버·Studio·격리 파서·실제 PDF 변환을 실행하되 Slack API/파일 전송은 합성 응답으로 대체합니다. 따라서 앱 설정 수용, 실제 파일 권한 필드, Slack iframe, PDF 기본 보기, 토큰 권한은 실제 워크스페이스에서 별도 검증해야 합니다. 전체 C 방식 출시 완료로 간주하지 않습니다.

## Cloud Run 모드

Cloud Run은 ingress와 worker를 분리하고 Firestore에 연결 메타데이터·해시 티켓/세션을, Cloud Tasks에 작업 ID를 저장한다. 문서 bytes는 요청 간에 캐시하지 않고 처리할 때 Slack에서 다시 다운로드한다. 세션과 문서 연결은 인스턴스 교체 뒤에도 유효 기간 안에서 유지되며 접근 권한을 다시 검사한다. 로컬 모드의 SQLite·프로세스 내부 큐·15분 bytes 캐시와 구별한다. 상세한 IAM·자원 상한·이전·비용 검증은 [Cloud Run 운영](cloud-run.md)을 따른다.


Cloud worker는 같은 파서·print DOM에서 PDF를 먼저 생성하고 페이지별 PNG를 이어서 생성합니다. PDF 게시와 PNG 업로드는 독립 실행하며 최종 상태 변경 전에 양쪽 작업을 모두 기다립니다. 완료된 PDF는 이미지 생성 실패로 실패 상태로 바뀌지 않으며, 재시도에서는 완료 파일ID를 재사용합니다. PNG 업로드 동시 수는1~2로 제한하고 카드 쓰기는 직렬화합니다. 이 스트리밍·영속 작업 복구 경로는 Cloud Run용이며 로컬 단일 서버의 큐 정책과 구별합니다.


변환 환경은 서버 인스턴스 내에서 재사용합니다. 컴파일된 WASM과 고정 자산만 child에 보관하고 문서별 thread·WASM 메모리·browser context는 종료합니다. 실행 포함 대기 요청은 4개, 실제 변환은 1개입니다. 성공 20회·직전 측정 child RSS 768MiB 초과·자산 버전 변경 시 다음 작업 전에 교체하며 idle 5분 또는 오류/취소/제한시간 초과 시 폐기합니다. 메모리 수치는 browser 전체를 포함하지 않으며 컨테이너 4GiB 제한과 함께 사용합니다. Cloud Run이 idle CPU를 멈추면 idle timer 실행도 지연될 수 있습니다. 재사용은 계속 살아 있는 인스턴스에 한정되며 새 인스턴스/배포에서는 다시 준비합니다.
