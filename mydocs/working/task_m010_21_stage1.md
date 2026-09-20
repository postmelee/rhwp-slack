# Task #21 Stage 1 — 공개 홈페이지와 Pages 내보내기

홈페이지·사용안내·개인정보·지원 HTML과 CSS, 사용자 승인 로고를 site/에 추가했다. 공개 연락처는 승인된 Taegyu Lee / meleeisdeveloping@gmail.com이다. 합성 예시만 사용하며 실제 채널·사용자 문서를 게시하지 않는다.

Pages exporter의 --public-site 옵션은 명시한 6개 정적 파일만 추가한다. 기존 내부 배포 기본값은 홈페이지 없음·noindex를 유지한다. API는 배포자가 지정하는 정확한 HTTPS origin만 사용하며 URL 인자로 바꾸지 않는다. 명시적404를 유지하고 editor/API/static 경로는 검색 수집을 허용하지 않는다.

검증: 타입 검사 통과, 단위10개 통과, 실제 pinned Studio 빌드 성공. 공개/기본 export 차이, secret/원본 파일 제외, 내부 링크 대상 존재, 잘못된 API origin 거부를 검사했다. 1280×900과390×844에서4페이지 가로 넘침 없음·설치 대상 검증, 데스크톱·모바일 홈페이지를 직접 시각 확인했다. 증적 /private/tmp/rhwp-site-review/desktop.png, mobile.png.

배포 전이다. 후보 주소 rhwp-slack.pages.dev는 생성 시 가용성을 확인한다. 기존 rhwp-slack-editor Pages/API/Slack 앱을 덮어쓰지 않는다. 사이트의 세션 만료 안내는 현재 기능 상태에 맞췄으며 #23 수용 후 갱신한다.
