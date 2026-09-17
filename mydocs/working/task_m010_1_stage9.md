# Task #1 Stage 9 — 내부 워크스페이스 운영 연결

- 일자: 2026-09-17
- 이슈/마일스톤/브랜치: #1 / M010 / local/task1
- 기준: Stage 8 c4cc8ae + 본 Stage 9 변경
- 상태: 구현·로컬 검증·추가 공개 채널 실제 수용 완료. 동료 본인 계정 확인 및 고정 호스팅은 후속 항목

## 변경

- Compose에 restart 정책과 SQLite 영속 volume, 일반 사용자 쓰기 권한을 마련했다. Dockerfile 변경의 새 Linux 이미지 실행은 이번 단계에서 미검증이다.
- 이벤트 중복 식별을 재시작 후 유지하고 관찰/스레드 DB의 만료·상한 삭제를 동기화했다.
- 원본 재다운로드 시 기존 카드 SHA-256을 대조한다. 메타데이터가 같아도 본문이 달라지면 거절한다.
- 상태 반응 지연이 다운로드를 막지 않게 분리하고 일시적 실패는 후속 sweep에서 재시도한다. 반응 오류로 변환을 반복하지 않는다.
- README 및 기존 docs/architecture.md·development.md의 수명·설정·운영 설명을 갱신했다.

## 검증

| 검사 | 결과 | 범위 |
| --- | --- | --- |
| npm run typecheck | 통과 | 앱·서버·테스트 |
| npm test | 7 통과 | 기본 단위 |
| npm run test:slack | 50 통과 | 실제 Bolt HTTP + 합성 Slack API, 재시작·권한·모드·반응 |
| npm run test:security | 22 통과 | 서명·접근·세션·업로드·격리 파서 |
| npm run build | 통과 | production Studio/host |
| npm run test:viewer | suite exit 0 | 19개, 알려진 upstream 혼합 서식 undo 예상 실패 1개 포함. 나머지 정상 통과 |
| npm run preflight:slack | 통과 | 실제 auth.test·workspace·production 자산 |
| 로컬 /healthz | ok:true | 새 서버 3000번 |

브라우저 검사는 Stage 8 구현 후 수행했다. 이후 Stage 9 변경은 서버 영속화·원본 무결성·반응 복구이며 최종 Slack/security/typecheck로 검사했다. 새로운 UI 또는 엔진 변경은 없다. 재시작 중 중단된 카드 준비와 기존 PDF 재사용, 다른 합성 사용자 열기, 이벤트 중복 만료, 동일 이름/크기 원본 변조 거절을 포함한다. 이 결과를 실제 동료 계정 검증으로 간주하지 않는다.

## 실제 연결 작업

- Slack manifest에 App Home, app_home_opened, reactions:write를 저장했다. 기존 Work Objects·embed 설정을 보존했다.
- 사용자가 reactions:write 승인을 명시한 뒤 Slack 재설치 허용을 완료했다. 현재 토큰의 auth.test 응답 scope에서 reactions:write를 확인했다.
- 사용자가 지정한 rhwp-전체와 기존 rhwp-slack-test를 최초 활성 채널로 설정했다. 앱의 두 채널 참여를 조회했다. 관리자 지정 없이도 일반 문서 사용은 허용한다.
- 로컬 .env의 DB 경로와 reactions 활성화만 적용하고 production 서버를 새 버전으로 시작했다. .env·DB·token·문서 bytes는 Git에 포함하지 않는다.

## HTTPS 복구와 실제 수용 — 사용자 두 항목 승인 후

- 기존 Cloudflare Quick Tunnel은 프로세스가 살아 있어도 Unauthorized: Tunnel not found를 반복했고 기존 hostname DNS도 사라졌다. 정상 동작하는 주소로 보고하지 않는다. 만료된 프로세스를 종료했다.
- 사용자가 새 임시 HTTPS 연결과 postmelee 관리자 지정을 모두 명시 승인했다. 새 Quick Tunnel https://refers-peripheral-wizard-election.trycloudflare.com 을 생성하고 /healthz의 ok:true를 확인했다. APP_ORIGIN과 Slack slash/event/interactivity URL 및 embed domain_allowlist를 같은 주소로 교체했다.
- 승인된 postmelee 사용자 ID를 SLACK_ADMIN_USER_IDS에 등록했다. 실제 rhwp-전체에서 /rhwp settings 모달을 열어 자동 감지를 저장했다. 서버 재시작 후에도 updatedBy와 auto 정책을 확인했고 App Home의 채널 설정 버튼과 두 채널 현황을 확인했다.
- 고정 도메인/서버 선택은 미정이다. 현재 Mac 프로세스를 외부 상시 운영 서버라고 간주하지 않는다.
- 로그인된 사용자 Chrome에서 tests/fixtures/viewer-two-pages.hwp 합성 파일을 rhwp-전체에 첨부하여 전송했다. 멘션 없이 원본 스레드 댓글 한 개와 ⏳→✅를 실제 UI에서 확인했다. 전체 PDF와 두 장 PNG가 준비됐다.
- PDF로 보기 링크는 Slack 미디어 뷰어에서 합성 문서 두 페이지를 표시했다. 서버를 정상 종료·재시작한 뒤 동일 카드의 사이드 패널에서 Studio 두 페이지를 열었다. 원본 재다운로드와 세션 재발급이 정상 동작했다.
- Studio에 R 글자를 입력해 미저장 상태를 확인하고 저장했다. 변경 없음과 편집본/PDF 저장 완료 안내, 원본과 같은 parentTs의 수정본 카드 한 개를 확인했다. 최초 카드 messageTs와 원본 PDF ID는 재시작 후에도 유지했다.
- 실제 테스트 원본: https://rhwphq.slack.com/archives/C0BR9AD9RDW/p1789607740076459 . 최초 카드: p1789607744315379, 수정본: p1789607913487069. 사용자가 테스트할 수 있게 남겨두었다.
- 다른 합성 사용자 권한 검사는 자동 테스트로 통과했다. 동료 본인 Slack 계정으로 실제 업로드/열기/저장하는 수용 확인은 남았다. 다른 사람으로 가장하거나 임의 DM을 보내지 않았다.
- DB 도입 전 메모리에만 있던 카드는 자동 이전되지 않는다. DB 도입 이후 새 카드부터 복구 대상이다.
- Marketplace/OAuth 및 다른 workspace 배포는 이번 범위 밖이다. 원격 push/PR/이슈 close는 수행하지 않았다.
