# Slack 문서 편집·저장 구조

## 실행 경계

Slack → 서명 검증된 Bolt → 채널·사용자·파일 권한 확인 → 메모리 원본 준비 → Work Object 카드로 이어집니다. 카드 열기는 사용자 권한을 다시 확인한 뒤 `entity.presentDetails`에만 편집 ticket을 제공합니다. 채널에 게시하는 metadata에는 인증 URL이나 ticket을 넣지 않습니다.

Studio는 자체 호스팅 SDK iframe입니다. 호스트가 인증 API에서 받은 bytes를 SDK에 전달합니다. Slack bot token은 브라우저에 전달하지 않습니다. 문서 복구·최근 문서·자동 저장·영속 이력은 사용하지 않으며 현재 undo/redo와 dirty 상태를 유지합니다.

별도 PDF 보기 화면이나 편집/보기 전환은 없습니다. PDF는 앱이 Slack에 업로드·공유한 파일의 permalink로 연결합니다. Work Object의 URL action이 실제 Slack 웹·데스크톱에서 기본 PDF 미리보기를 여는지는 실환경 수용 검사 대상입니다.

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
- 준비 원본의 byte TTL은 15분입니다. 만료 후 처음 열기/재읽기는 `/rhwp open`을 다시 실행해야 합니다. 이미 연 Studio는 원본 bytes를 다시 읽지 않고도 세션이 유효한 동안 새 편집본을 저장할 수 있습니다.
- 앱은 단일 workspace와 명시적 허용 채널을 사용합니다. DM·Connect·조직/제한 공유는 미지원이며 누락된 권한 증거를 허용으로 추정하지 않습니다.

## 저장과 중복 처리

1. 호스트는 export 전후 `documentEpoch`, `changeSeq`, `documentSha256`가 같은지 확인합니다. 중간 변경이 있으면 새 저장을 요청하도록 안내합니다.
2. 동일 export에 UUID를 부여합니다. 서버는 session ID·UUID·format/bytes hash를 결속하고 동시 요청은 동일 작업을 기다립니다. 같은 UUID에 다른 내용은 충돌 오류입니다.
3. 20 MiB·signature·형식을 검사하고 Slack 자격 증명 없는 별도 Node 프로세스에서 파싱합니다. 200페이지 상한과 30초 종료 제한을 적용합니다. 파서 실패 시 Slack 업로드를 시작하지 않습니다.
4. 업로드 URL은 HTTPS `files.slack.com/upload/v1/`만 허용합니다. 이 주소에는 bot token을 보내지 않고 redirect를 거부합니다. 최종 공유 직전에 접근 권한을 다시 확인합니다.
5. `completeUploadExternal`은 발급받은 파일 ID마다 한 번만 시도합니다. 응답이 불확실하면 그 ID의 현재 채널·team·원래 thread 공유 증거를 조회합니다. 증거가 부족하면 불확실 상태를 보존하고 같은 요청을 재확인합니다.
6. 공유 완료가 확인된 HWP/HWPX 영수증은 PDF와 독립적입니다. 원래 채널/스레드에 새 파일을 공유한 뒤 동일 export bytes의 PDF를 직렬 변환 큐로 보냅니다. 원본은 수정하지 않습니다.
7. 호스트는 저장 성공 후 Studio 내부의 `notifySavedIfUnchanged`를 호출합니다. Studio가 현재 revision을 동기 비교한 뒤, await 없이 clean 처리에 진입합니다. 업로드 중 추가 편집이 있으면 clean 처리하지 않습니다. PDF 실패도 성공한 HWP/HWPX 저장을 되돌리지 않습니다.

재시도 기록은 프로세스 메모리에만 있습니다. 응답 손실 시 같은 창의 같은 요청은 중복 공유를 피하지만 재시작·새 세션을 넘는 exactly-once 보장은 없습니다. 동시 편집 병합이나 원본 덮어쓰기 기능은 제공하지 않습니다. 세션 만료는 이미 브라우저에 전달된 bytes를 회수하지 않으며 후속 서버 접근을 차단합니다.

## 자원과 검증 경계

준비 원본은 총 200 MiB, 다운로드 2개·대기 20개, PDF는 실행 포함 대기 4개·실행 1개, 저장은 동시 2개로 제한합니다. PDF/저장 큐에서 보유한 bytes와 파서·Chromium 메모리는 원본 보관량 외에 추가됩니다. 운영체제 수준의 메모리/CPU·네트워크 격리는 Stage 6 배포에서 다룰 항목입니다.

검증은 실제 Bolt HTTP·production 서버·Studio·격리 파서·실제 PDF 변환을 실행하되 Slack API/파일 전송은 합성 응답으로 대체합니다. 따라서 앱 설정 수용, 실제 파일 권한 필드, Slack iframe, PDF 기본 보기, 토큰 권한은 실제 워크스페이스에서 별도 검증해야 합니다. 전체 C 방식 출시 완료로 간주하지 않습니다.
