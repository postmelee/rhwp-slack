# Task #1 Stage 4 — Slack 명령과 문서 접근 권한

GitHub Issue: [#1](https://github.com/postmelee/rhwp-slack/issues/1)
구현계획서: [task_m010_1_impl.md](../plans/task_m010_1_impl.md)
Stage: 4

## 단계 목적

사용자가 “확인했어. 이제 다음을 진행해줘.”로 Stage 3.1을 확인하고 Stage 4 진입을 승인했다. `3bb493f`를 기준으로 `/rhwp` 수신·메시지 파일 선택·권한·다운로드를 구현했다. 실제 Studio 세션·PDF 첨부 연결은 승인된 Stage 5 범위로 유지한다.

## 산출물

| 파일 | 변경 요약 |
| --- | --- |
| `src/server/config.ts`, `main.ts`, `receiver.ts` | 단일 workspace 설정, 시작 시 auth.test, 공식 Bolt 5.1.0 ExpressReceiver, raw body 서명 검증, 빠른 ack |
| `commands.ts`, `shortcuts.ts`, `replays.ts` | open/edit/pdf/help, 한글 파일 링크, 다중 파일 모달, 사용자·후보 결속 및 재전송 방지 |
| `access.ts`, `download.ts`, `slack-api.ts` | 채널·멤버십·공유 증거 검사, 재시도·deadline, 인증 URL과 실제 bytes 검사 |
| `jobs.ts`, `errors.ts` | 비동기 준비·중복·취소·15분 보관·메모리 예약·안전한 오류 메시지 |
| `slack/manifest.json`, `.env.example` | 앱 등록 템플릿·scope·메뉴·명령·개발 서버 환경 설정 |
| `tests/slack/`, `tests/security/` | 실제 Bolt HTTP와 합성 Slack API, 명령·모달·권한·전송 실패 검증 |
| package·lock·tsconfig·CI·scripts | Bolt 버전 고정, 서버 타입 검사, Slack/security 테스트 실행 및 CI 연결 |
| `docs/development.md`, README·dependencies·계획·orders | 설치·실행·현재 범위·공식 근거·다음 단계 인계 |

## 본문 변경 정도 / 본문 무손실 여부

코드 작업이다. rhwp 엔진·Studio UI·PDF 변환 구현은 변경하지 않았다. 기존 “문서 열기”→Studio, “PDF로 보기”→Slack PDF의 계약을 유지한다. `/rhwp edit`는 open과 같은 모드로 정규화한다. PNG·ZIP은 미제공 안내를 반환하고 후속 요구를 보존한다.

서버의 ready는 원본 byte 준비 완료다. 현재 명령은 준비 결과와 아직 연결되지 않은 편집기/PDF 미리보기를 명확히 안내한다. 동작하지 않는 링크나 저장 완료 상태를 만들지 않는다. 실제 원본/PDF 전송 HTTP API는 이 서버에 없으며 Studio 전달 및 PDF 업로드는 Stage 5에서 구현한다.

## 검증 결과

환경: macOS arm64, Node 24.21.0/npm 11.19.0, @slack/bolt 5.1.0. 원본 rhwp/Studio 0.8.6 고정 유지.

실행 명령:

```sh
npm run typecheck
npm test
npm run test:slack
npm run test:security
npm run build
git diff --check
```

결과:

- 타입·production 빌드·diff 검사 통과.
- 기존 단위 7개, Slack 12개, 보안 13개: **총 32개 통과**, 실패·skip 없음.
- 실제 Bolt HTTP receiver에 유효·변조·만료·누락 서명을 보내 invalid 요청의 API 접근 부재를 확인했다. 다른 team/app/허용 밖 채널도 문서 준비를 시작하지 않는다.
- 느린 다운로드를 대기시켜도 먼저 ack하며 반복 slash command는 한 번만 다운로드한다. 잘못된 앱 ID가 3초 미응답으로 남던 초기 구현을 수정했고 해당 실패 경로도 2.5초 이내 응답하도록 검증했다.
- 메시지 다중 후보→모달→선택 제출의 실제 HTTP 흐름을 검증했다. 다른 사용자 제출·후보 밖 파일·만료·재사용을 거절하며 모달 중복 요청은 한 번만 연다.
- 공개·비공개 채널의 명시적인 같은 team 공유 증거, 멤버 목록의 후속 페이지를 확인한다. 공유 전환·외부 workspace·제한 공유·필드 누락·cursor 반복·조회 실패는 거절한다.
- 실제 합성 HWP bytes 다운로드, 인증 header, redirect 수동 검사, 잘못된 host·team 경로, 크기 위장·초과·불일치, signature 오류, 취소를 검사했다. 파일 내용이 준비된 뒤 권한이 취소되면 bytes와 ready 결과를 폐기한다.
- 읽기 429 재시도와 Retry-After, 쓰기 자동 재시도 금지, 원문 오류 비노출을 확인했다. response_url은 사용하지 않는다.
- 작업 중복·TTL·큐 상한·메모리 예약·deadline·이벤트 무효화·과거 이벤트 재전송을 검사했다. 알림 실패 시 이미 완료한 다운로드를 반복하지 않는다.
- 프론트엔드 변경이 없어 이번 단계에서는 브라우저 회귀를 재실행하지 않았다. 이전 Stage 3.1의 정상 12개와 B-004 known-failure 1개 결과는 그 소스에 대한 기록으로 보존한다. Stage 4의 32개 통과 수에 포함하지 않는다.

로그: `.cache/validation/stage4-checks.log`, `stage4-build.log`.
소스 manifest: `.cache/validation/stage4-source-manifest.json`, SHA-256 `e29dc963d0a6873ba734b609b4265770b106e5e96a7cba828f84ef5f192a9b61`.
이번 보고서와 묶어 커밋한 코드가 검증 대상이다. 빌드 경고는 기존 CanvasKit Node 모듈 외부화 및 큰 청크 안내이며 빌드는 성공했다.

## 잔여 위험

- 실제 Slack workspace 자격 증명·HTTPS 수신 주소는 없으며 외부 메시지 전송·앱 설치·manifest API 수용 검증은 수행하지 않았다. 테스트 응답은 합성이고 실제 Slack 권한 보장을 대신하지 않는다.
- 파일의 `is_restricted_sharing_enabled: false`와 채널 공유 상태 필수 필드를 실제 API가 제공하지 않으면 거절한다. 실제 workspace에서 이 응답 계약을 대조해야 한다. 검증 없이 조건을 느슨하게 만들지 않는다.
- 현재 다운로드 허용 경로는 `files.slack.com/files-pri/TEAM-FILE/`다. 다른 CDN 경로는 미지원으로 남겼다.
- 원본은 메모리에 15분 보관하며 재시작 시 사라진다. exactly-once·영구 복구·OS 하드 메모리 상한은 보장하지 않는다. bot이 채널에 없거나 Slack이 알림을 거절하면 최종 ephemeral 응답이 전달되지 않을 수 있다.
- 클라이언트 세션·실제 문서 접근마다의 권한 재검사·원본 스레드에 편집본 저장·PDF 공유·웹/데스크톱 미리보기는 Stage 5에서 연결해야 한다.
- 실제 렌더링/페이지 수는 Studio·PDF 경계에서 검사한다. 이번 원본 준비 결과를 문서 파서의 성공으로 승격하지 않는다. 기존 엔진 B-003/B-004는 유지한다.

## 다음 단계 영향

Stage 5는 준비된 원본에서 Work Object 카드·일회성 ticket·짧은 bearer session을 만들고, 카드 클릭과 원본 전송 시 권한을 다시 확인한다. 실제 Studio 직접 열기와 PDF 업로드·공유 뒤 “PDF로 보기”를 연결한다. 준비 작업의 mode·actor·source·contentHash와 서버 내부 Job ID를 사용할 수 있지만 클라이언트 공개 전 별도 접근 검증이 필수다.

선택한 원본 메시지/스레드 결속, 편집본 업로드 및 저장 중 추가 편집의 revision 판정, 새 PDF 생성 실패와 이미 성공한 HWP 저장의 분리도 Stage 5에서 완료한다. Stage 6은 Linux 실행 및 실제 Slack 수용 검증이다.

## 승인 요청

Stage 4 구현·검증을 완료했다. 다음 Stage 5의 실제 Slack 편집·PDF 공유·편집본 저장 연결은 이 결과 확인 후 진행한다. 원격 push·PR·Slack 메시지·배포는 이번 단계에 포함하지 않았다.
