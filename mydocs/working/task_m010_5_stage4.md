# Task #5 Stage 4 — 실제 채널 공유 해제 수용

계획: [task_m010_5_impl.md](../plans/task_m010_5_impl.md). 사용자 순차 진행 승인에 따라 PR #32 배포본을 실제 Slack에서 검증했다. 합성 문서만 사용했다.

## 절차와 결과

1. Alhanguel test의 합성 원본 `F0C2P0E6AA3`를 rhwp-slack에도 공유했다. Slack files.info에서 두 public 채널 shares를 확인했다.
2. rhwp-slack 원본 메시지 `1790076335.964549`에 자동 댓글 `1790076342.168209`, PDF·2페이지 PNG가 생성됐다. 새 브라우저 편집 세션에서 원본 2페이지 열림을 확인했다.
3. 방금 만든 rhwp-slack 공유 메시지만 제거했다. 원본 파일 전체를 삭제하지 않았다. files.info에서 test 공유만 남고, 서버 inputs에서 실제 file_unshared 이벤트를 확인했다.
4. rhwp-slack 카드만 removed=true, 해당 카드 revocation=2를 확인했다(이벤트 2건). test 원본 카드에는 removed가 없고 revocation도 생성되지 않았다.
5. 공유 해제 전에 열어 둔 rhwp-slack 세션으로 합성 문구를 입력하고 저장하면 거절됐다. 해당 세션 lastUsed는 1790076411136, 세션 epoch=0이며 카드 epoch가 증가했다. 안내는 현재 공통 session_expired 메시지이며 다시 로그인/다운로드를 제공했다.
6. test 원본을 새 창에서 다시 열어 2페이지 확인, 기존 `viewer-two-pages_편집본_3.hwp`도 다시 열어 추가 한글 문구와 2페이지를 확인했다. 같은 루트의 다른 채널 원본/수정본 연결은 유지됐다.

## 증거와 한계

- 안전한 서버 요약 `/private/tmp/task5-unshare-summary.json`, 스크린샷 `rhwp-slack-screenshots-20260922/task5-channel-unshare-denied.png`, `task5-kept-child-editor.png`.
- test의 이전 세션은 마지막 API 사용 후 10분이 넘어 별도 만료됐다. 이를 공유 해제 회귀로 분류하지 않으며 기존 세션 유지의 실제 UI 증거로 사용하지 않는다. 새 세션·카드 상태와 자동 회귀의 정상 채널 세션 보존으로 구분한다.
- 실제 두 public 채널을 사용했다. private 채널·중복/역순/누락·공유 복구·수정본 철회 조합은 기존 [Stage 2](task_m010_5_stage2.md)의 자동 회귀 결과다.
- 다른 사람의 채널 탈퇴/권한 회수 수동 검증은 Marketplace #4에 남는다. 앱 제거·재설치는 [#4 Stage 4](task_m010_4_stage4.md)에서 이미 완료했다.

#5의 실제 file_unshared 수용과 자동 회귀 기준을 충족했다. 최초 동료 오류의 원인이라고 단정하지 않는다. 기록 PR 검토·병합 후 #5를 닫을 수 있다.
