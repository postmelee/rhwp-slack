# Task #4 Stage 18 — 인증 확인과 중립적 정책 안내

GitHub Issue: [#4](https://github.com/postmelee/rhwp-slack/issues/4)
구현계획서: [계획](../plans/task_m010_4_impl.md)
Stage: 18

## 단계 목적

사용자 요청에 따라 권한·인증 제약을 다시 확인하고 REVIEW 및 초안 표현을 제거하여 같은 Pages 확인용 branch에 배포한다.

## 산출물

| 파일 | 변경 요약 |
|---|---|
| site/privacy/index.html, site/privacy/en/index.html | 실제 TTL·로그 보관 설정과 Cloudflare 공식 보관 안내 반영 |
| site/terms/index.html, site/terms/en/index.html | 초안·내부 심사 메모 제거, 중립적인 서비스 이용 조건 |
| site/policy-review/index.html, site/site.css | REVIEW 및 강조 상자 제거, 정책 안내와 문서 링크 |
| tests/unit/public-site.test.mjs | 중립적 본문·보관 설정 회귀 검사 |

## 본문 변경 정도 / 본문 무손실 여부

앞선 Stage 15–17 기록은 역사적 증거로 보존한다. 공개 페이지의 초안·검토 메모는 이번 사용자 지시로 제거했다. 사람 번역이 완료되었다는 주장은 추가하지 않았다. 문서 임시 처리·Slack 저장·별도 이용 기록·앱 제거와 기존 기록 삭제의 차이는 유지했다.

## 검증 결과

`node --test tests/unit/public-site.test.mjs tests/unit/pages-headers.test.mjs`: 4/4 통과.

- Cloudflare 기존 OAuth RUM 조회는 다시 403. 권한을 확대하지 않고 사용자가 로그인한 공식 대시보드에서 rhwp-slack.pages.dev 분석 사이트와 Pages 관리 연결을 확인했다.
- GCP 로컬 CLI와 캐시 자격증명은 없었다. 기존 인증 브라우저 세션으로 rhwp-slack-postmelee 설정을 확인했다.
- Firestore (default) TTL: records / expiresAt / 제공 중, offset 0초. 물리적 삭제는 비동기이므로 즉시 삭제를 약속하지 않는다.
- Cloud Logging: _Default 30일, _Required 400일. 현재 라우터는 두 버킷에 대한 활성 기본 sink만 표시한다.
- 분석 원시 beacon의 비표본 보관 7일과 최근 6개월 조회는 [Cloudflare 공식 FAQ](https://developers.cloudflare.com/web-analytics/faq/)에 근거한다. 6개월을 모든 원시 데이터의 삭제 보장으로 표현하지 않는다.
- 증거 스크린샷은 저장소 밖 policy-review-evidence의 firestore-ttl.jpg, log-retention.jpg, cloudflare-site.jpg에 보관한다. 비밀값이나 사용 문서는 커밋하지 않는다.
- Cloudflare/GCP 설정, 권한, 자격증명은 변경하지 않았다.

## 잔여 위험

영문은 AI가 작성했으며 사람 번역/검수 요건은 미완료다. 문의 메일의 고정 보관 기간은 근거가 없어 만들지 않았다. 실제 Slack 문서 처리 E2E는 변경 범위 밖이다.

## 다음 단계 영향

기존 preview branch policy-review-20261118을 갱신한다. 운영 canonical 및 editor/static/Google 자산을 보존하고 실제 URL 본문과 모바일 화면을 검증한다. 결과는 아래에 추가한다.

## 승인 요청

사용자가 인증 재시도 후 중립적 페이지 배포를 이미 지시했으므로 해당 범위는 계속 진행한다. Slack 재제출·I have fixed it·메일·runtime 배포는 포함하지 않는다.

## 배포 후 확인

- 배포: ba2318aa-ac16-4c0a-9f5d-ae6a36e4bcb4, 소스 eea49b4, preview branch policy-review-20261118.
- [정책 안내](https://policy-review-20261118.rhwp-slack.pages.dev/policy-review/)에서 한영 개인정보·이용약관에 접근할 수 있다. 배포 고유 URL은 https://ba2318aa.rhwp-slack.pages.dev/ 이다.
- 10개 URL HTTP 200, Cloudflare 삽입 beacon 블록 제외 본문이 export 파일과 동일. 5개 정책 페이지의 REVIEW·검토·초안·Draft 표현 없음. 약관 실제 본문 확인.
- canonical e40449f8 및 분석 설정 유지. 기존 editor/static/locale-init/Google 파일 178개 asset ID 동일.
- 인앱 브라우저 데스크톱 정책 안내와 모바일 영문 개인정보·약관 확인. 모바일 두 페이지 clientWidth=scrollWidth=390, 가로 넘침 없음.
- 증거: workspace의 policy-neutral-desktop.jpg, privacy-neutral-mobile.jpg 및 policy-review-evidence/neutral-verification.json.
- 기존 e3018368 고유 주소는 이전 배포이므로 새 고정 별칭을 사용한다.
- PR #74는 draft로 유지한다. 사용자 확인과 사람 번역 요건 완료 후 운영 게시·Slack URL 변경·재제출을 별도로 진행해야 한다.
