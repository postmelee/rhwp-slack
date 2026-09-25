# Task #21 Stage 2 — 공개 주소·소개·운영 검증

공개 주소는 https://rhwp-slack.pages.dev/ 이며 편집기는 `/editor/`이다. 내부 rhwp-slack-editor.pages.dev는 보존했다. Pages deployment a3386ba0, static namespace fb123639846d0d2a6359dcfcd15f5ebef5a628a16271afdcee5d5f057f637c05. Cloud Run 배포 소스·이미지는 #20 Stage 2와 동일하다.

- 홈페이지/guide/privacy/support/editor 200, 없는 경로 및 .env 404.
- 새 Pages origin의 API preflight 204, 이전 beta Pages와 임의 origin 403; worker 공개 접근 403.
- 홈페이지 로컬 데스크톱 1280×900·모바일 390×844 네 페이지의 가로 넘침 없음. 실제 Chrome 공개 페이지 표시 확인.
- Slack 소개·승인 로고·공개/지원/개인정보 주소·Free/Korean/File Management·직접 설치 URL 저장. 전화번호는 사용자가 UI에 입력했으며 저장소에 남기지 않는다.
- 새 origin에서 두 페이지 합성 HWPX를 열어 `Public origin verified ` 편집 후 원래 스레드에 편집본3·PDF·PNG2장 생성. thread 1789884873.358349, reply 1789887949.964739. 원본·산출 bytes는 커밋하지 않는다.
- 기존 내부 앱의 revision/traffic 불변. 실제 두 workspace 전체 흐름은 #16 Stage 5의 증거를 따른다.

Marketplace 제출과 약관 동의는 수행하지 않았다. 활성 설치/사용자 요건, 심사용 이미지와 실제 제거·재설치·다른 사용자 수용은 #4 후속이다. 두 앱을 같은 채널에서 활성화한 경우 불필요한 메시지 특정 실패 안내가 발생한 관찰은 #25로 분리했다.
