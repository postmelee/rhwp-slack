# Task #2 Stage 6 — 편집 초기화 제한과 Slack 재진입

- 호스트 초기화 전체에120초 한도를 적용했다. Slack 접근 확인, 편집기 준비, 원본 가져오기, 문서 열기 상태를 구분한다. SDK의 개별60초 요청/10초 handshake 한도도 유지한다.
- 실패·시간초과 시 fetch를 취소하고 기존 iframe을 정리한다. 늦게 resolve된 SDK는 destroy하며, 오류 이후 편집 완료/저장 버튼이 나타나지 않는다. 소비된 티켓을 다시 사용하지 않고 Slack 원본 스레드의 편집 카드를 다시 클릭하도록 안내한다.
- 티켓 없이 `/editor/`를 직접 열면 빈 Studio를 시작하지 않고 안내만 표시한다. 기존 `/documents/:id`의302도 이 안내에 도착한다. 문서 존재·내용을 공개하거나 외부 OAuth로 권한을 넓히지 않는다. 같은 경로 개선이므로 editor-routes의 인증/redirect 코드는 변경할 필요가 없었다.
- 정상 초기화는 deadline을 해제하여 진행 중인 편집 세션을 나중에 취소하지 않는다. 개발용 로컬입력은 계속 동작한다.

## 검증

- typecheck, unit9/9 통과. 끝나지 않는 초기화·늦은SDK정리·성공 후 타이머 해제를 검사했다.
- production/dev 빌드와 전체 viewer: 정상21개 통과, 기존 엔진0.8.6의 mixed-format undo expected failure1개 유지(러너 표기22passed). 기대값을 바꾸지 않았다.
- 신규 실제 브라우저 검사: 직접열기에는iframe없음, iframe응답지연에120초후오류와안내/늦은응답차단, 원본가져오기503후iframe정리. 기존 실제Studio편집/저장/저장중추가입력/상태복구 검사도 통과했다.
- 실제 HWP/HWPX 스트림·부분 PNG 재시도2/2 통과. Stage7에서 Cloud 배포본 및Slack 내부 수용을 확인한다.
