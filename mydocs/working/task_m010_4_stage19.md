# Task #4 Stage 19 — 공개 Pages 이관 재현

[이슈 #4](https://github.com/postmelee/rhwp-slack/issues/4) · [구현 계획](../plans/task_m010_4_impl.md)

## 범위와 변경

공개 안내의 실제 운영 주소를 소스와 README에 반영했다. 홈·가이드·지원·한영 개인정보·한영 약관·라이선스·리뷰 페이지는 기존 공개 본문과 자산을 재사용한다. 새 사이트는 canonical, 검색 제외 및 sitemap을 포함한 독립 산출물로 내보낸다. 이전 주소는 운영에서 확인한 23개 경로만 301로 보낸다. README는 설치·사용과 지원 안내에 집중하고 고정 빌드 입력 및 배포 절차는 개발 문서로 이동했다.

## 검증

- `node --test tests/unit/public-site.test.mjs tests/unit/pages-headers.test.mjs` 5개 통과. 설치 origin, 경로 범위, 검색 설정, Google 확인 파일 보존과 편집기 포함 export를 확인했다.
- 복사한 운영 아카이브와 새 공개 export의 파일 목록 및 Cloudflare asset ID를 canonical 배포와 대조했다. rhwp-bot 27개, rhwp-slack 204개 일치.
- 재배포 순서는 새 공개 사이트, 기존 편집기 프로젝트 순이다. 적용 후 canonical, HTTP 본문 및 리디렉션을 다시 확인한다.
- 직전 운영 및 롤백 대상은 rhwp-bot `64175388-870e-48d4-bf7a-b80cf74e6d26`, rhwp-slack `043bd547-d4d5-4219-9ced-243207d304c0`다.

## 남은 확인

CI 및 운영 도메인 확인은 병합·배포 시 수행한다. 실제 Slack 문서의 편집·저장과 embed 파일럿 검증은 별도 작업이다. 이번 배포는 사용자 승인 범위 내 Pages 및 README에 한정하며 이슈 #4는 유지한다.
