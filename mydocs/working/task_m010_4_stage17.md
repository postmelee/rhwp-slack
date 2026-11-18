# Task #4 Stage 17 — 사용자 검토용 미리보기 (2026-11-18)

## 배포와 실제 URL

- Cloudflare Pages preview: [변경 검토](https://e3018368.rhwp-slack.pages.dev/policy-review/)
- 배포 ID: e3018368-3533-4db3-8a82-30fce6dc7993, branch policy-review-20261118, 소스 64c99b3.
- 고정 별칭: https://policy-review-20261118.rhwp-slack.pages.dev/policy-review/ .
- 국문 개인정보 `/privacy/`, 영문 `/privacy/en/`, 국문 약관 `/terms/`, 영문 `/terms/en/` 모두 실제 해당 제목과 본문을 반환한다. 약관은 editor fallback이 아니다.
- `/`, 위 5개 검토/정책 URL, `/support/`, `/editor/`, `/googlea2d4f48bbe57cea0.html`, `/site.css` 총 10개 HTTP 200. Cloudflare가 삽입하는 analytics 블록만 제외하면 배포 준비 파일과 바이트 동일. 모두 noindex 응답 헤더 확인.

## 보존과 안전한 범위

- 원래 canonical production e40449f8-44ee-48db-88fe-724a9be81805 유지, analytics build 설정 유지.
- 운영 manifest와 preview manifest에서 editor/static/locale-init/Google 178개 asset ID 일치. 준비 시 전체 기존 served file 200개와 보존본의 해시도 대조했다.
- Cloud Run·worker·CORS·인증·Slack 양식·재제출·I have fixed it·메일 발송은 실행하지 않았다.
- Wrangler의 dirty 경고는 미커밋 소스가 아닌 로컬 검증 자료 `.local/`에 의한 것이었다. 자료는 작업 저장소 밖으로 이동했다. 사이트 소스는 커밋 64c99b3와 일치하며 이후 커밋은 보고서만 포함한다.

## 화면 검증

- 인앱 브라우저에서 데스크톱 변경 검토 페이지와 모바일 390×844 영문 개인정보·약관을 직접 확인했다. 초안·시행 전·AI 번역 및 사람 번역/검수 미완료 표시가 보인다.
- 모바일 영문 개인정보·약관의 document clientWidth와 scrollWidth 모두 390px로 가로 넘침 없음. 임시 viewport를 복원하고 검토 페이지를 사용자용 탭으로 남겼다.
- 스크린샷은 작업 workspace의 policy-review-desktop.jpg / privacy-mobile.jpg에 보관한다.

## 확인 한계

- Cloudflare RUM 상세 설정 조회는 HTTP 403. 프로젝트 analytics 연결 및 실제 HTML 삽입은 확인했지만 세부 분석 규칙/보관 기간은 확정하지 않는다.
- GCP TTL·로그 보관 설정 조회를 시도했으나 활성 gcloud 계정의 캐시 access token이 없어 현재 설정을 조회하지 못했다. 기존 토큰이나 권한을 변경하지 않았다.
- 공개 정책 전용 테스트만 실행했다. preview 도메인에서 실제 Slack 편집·저장 E2E는 미검증이며 운영 CORS를 확장하지 않는다.
