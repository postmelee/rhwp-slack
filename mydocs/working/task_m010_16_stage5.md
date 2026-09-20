# Task #16 Stage 5 — 두 워크스페이스 수용과 검증 경계

같은 rhwp beta 앱 A0C329NJ85C를 alhanguel(T0B3KRJ67LG)과 rhwphq(T0BQ8NK3KTM)에 각각 설치했다. 설치별 토큰의 auth.test team/bot 일치, 채널 참여와 독립 설정을 확인했다. 두 번째 비공개 rhwp-slack-test에는 원래 내부 앱을 유지하고 합성 검증 스레드만 사용했다. 기존 사용자의 작성 중 메시지는 전송·수정하지 않았다.

| 항목 | 첫 workspace | 두 번째 workspace |
|---|---|---|
| 원본 | 합성 2페이지 HWP | 합성 2페이지 HWPX |
| 자동 감지 | PDF·PNG 2장 | PDF·PNG 2장 |
| 실제 사용자 인증 | Slack OpenID | Slack OpenID |
| 편집 | External beta verified save | Second workspace verified |
| 저장 | 원본 스레드 HWP/PDF/PNG | 원본 스레드 HWPX/PDF/PNG |
| 재열기 | 문구·표·2페이지 보존 | 문구·표·2페이지 보존 |

두 번째 검증 스레드: https://rhwphq.slack.com/archives/C0C1X3ENGD8/p1789884873358349
성공 편집본: viewer-two-pages_편집본_2.hwpx, 카드 b5121560-cde1-47ba-9022-edb85f1dbdc2. 화면에서 실제 저장 문구와 표를 확인했다. 원래 내부 앱도 같은 채널에 활성화되어 합성 파일에 별도 댓글을 게시했다. 이를 베타 중복 게시로 세지 않는다.

## 검증 제한

두 workspace의 같은 운영자 계정으로 검증했으며 별도 동료 사용자의 새 베타 수용은 미검증이다. 설치 삭제/재설치·접근 회수와 교차 workspace 공격은 자동 보안 테스트 증거이며 실제 사용자/운영 앱 제거를 수행하지 않았다. 로그인 만료 복구는 #23, 공개 홈페이지와 주소 전환은 #21, 장기 비용 관찰은 #3, Marketplace는 #4에서 이어간다.

Slack tooltip이 소문자로 표시한 workspace ID로 수동 URL을 열면 400이었으며 저장된 실제 대문자 ID로는 정상 인증됐다. 서비스의 ID 검증을 완화하지 않았다. 실제 링크 생성 함수는 원래 teamId를 유지한다. 별도 스레드 업로드 시 메시지를 특정하지 못했다는 ephemeral 안내가 다수 보인 현상은 후속 조사 대상으로 기록한다. 원본 미리보기와 편집/저장은 성공했다.
