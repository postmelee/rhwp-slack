# Task #4 Stage 16 — 정책·약관 초안과 내보내기

- 국문 개인정보 처리 안내를 확인된 처리·쿠키·이용 이벤트·분석 설정·만료/삭제 경계에 맞춰 보완했다.
- 한영 개인정보와 별도 한영 약관, 변경 검토 페이지를 추가했다. 아직 시행되지 않는 초안이며 영문은 AI 번역/사람 작업 미완료로 명시했다.
- 모든 공개 안내 footer에서 약관으로 연결한다. explicit allowlist에 새 페이지와 기존 Google 확인 파일을 포함했다. 최신 devel에서 헤더 구현이 pages-headers.mjs로 분리된 것을 확인하고 관련 규칙·테스트를 갱신했다.
- `node --test tests/unit/public-site.test.mjs tests/unit/pages-headers.test.mjs`: 4/4 통과. export 격리, 내부 상대 링크, 언어·본문·초안 표시, 연락처, Google 원문, editor/static 캐시 경계를 확인했다. 테스트 중 변수 중복을 수정한 뒤 재실행했다.
- 운영 API에서 받은 canonical served file map 200개를 보존본과 Cloudflare 자산 해시 방식으로 모두 대조했다. 그 보존본 위에 공개 사이트만 내보냈고 editor/static/locale-init/Google의 178개 파일은 바이트 동일하다. 미리보기는 noindex와 robots Disallow를 사용한다.
- 로컬 Node v24.15.0에서 위 사이트 전용 테스트를 실행했다. 저장소 pin 24.21.0의 전체 런타임/변환 검증이나 실제 Slack E2E를 이 결과로 대신하지 않는다.
