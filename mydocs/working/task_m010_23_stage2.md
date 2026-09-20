# Task #23 Stage 2 — 실제 Slack 재인증·저장 복구

2026-09-20 공개 Pages /editor/에서 합성 문서에 `Reconnect preserved `를 입력한 뒤 10분 넘게 API 요청 없이 기다렸다. 서버 세션 정책을 변경하거나 쿠키/스토리지를 조작하지 않았다.

07:17 UTC 이후 저장 시 실제 `session_expired` 안내·동일 요청 재시도·다시 로그인·다운로드 버튼을 확인했다. 다시 로그인 버튼이 연 별도 창에서 실제 Slack OIDC 왕복 후 원래 편집창에 “다시 연결했습니다”가 표시됐고 미저장 상태가 유지됐다. 동일 저장 요청 버튼을 누른 후 저장 완료·clean 상태를 확인했다. 같은 iframe/bytes/request ID 보존과 다른 사용자·위조·취소 경계는 Stage 1의 자동 테스트 증거를 따른다. 실제 브라우저에서 메모리나 토큰을 추출해 비교하지 않았다.

검증 runtime: 9607091 / image sha256:8d033521e12cbcdd7b21ce0bc3785ff5c299c28bf20bc2af1db9c425da409ced. Pages 프로그램 fb123639846d0d2a6359dcfcd15f5ebef5a628a16271afdcee5d5f057f637c05. Chrome·rhwphq 합성 문서로 검증했으며 Safari/모바일 및 실제 다른 사용자의 로그인·회수는 후속 수용이다.

원본 thread 1789884873.358349의 reply 1789888696.014969에 편집본4(HWPX F0C2YQ4Q37V), PDF F0C3043CSGM, PNG F0C34TZRGEN/F0C34U08M6W가 생성됐다. Slack 웹을 다시 열어 확인했으며 편집창도 “편집본과 PDF를 Slack에 저장했습니다”·clean으로 표시됐다. 기존 내부 앱도 같은 채널에 활성화돼 별도 반응한 것은 공개 앱의 중복 저장으로 계산하지 않는다.
