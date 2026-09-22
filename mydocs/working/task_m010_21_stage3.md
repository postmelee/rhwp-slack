# Task #21 Stage 3 — 실제 화면과 Marketplace 소개 자료

## 변경

홈페이지 합성 카드를 승인된 국립국어원 업무계획 문서의 실제 Slack 스레드 캡처로 교체했다. 작은 화면을 위한 원본 이미지 확대 링크와 대체 텍스트를 제공한다. 과거 합성 카드 전용 CSS를 제거했다. `scripts/public-site.mjs`는 홈페이지 JPEG 한 장만 allowlist로 추가하며 원본 문서, 변환 산출물, 제출용·이름 검증용 이미지는 배포하지 않는다.

`docs/marketplace.md`에 짧은/긴 소개, 제출 이미지 3장·브라우저 편집 보조 1장과 재현 순서를 추가했다. 사용자는 이 문서의 실제 공개 소개 활용을 명시했다. 일반 사용자 파일의 포괄적 공개 허용으로 확대하지 않는다.

## 확인

- `node --test tests/unit/public-site.test.mjs`: 1/1 통과. opt-in, 파일 allowlist, HTML 링크, 설치 API 주소, 보안 헤더 확인.
- `node scripts/export-pages.mjs https://rhwp-beta-ingress-aaj47f2u5q-uc.a.run.app --public-site`: 69 files; 기존 프로그램 version `fb123639846d0d2a6359dcfcd15f5ebef5a628a16271afdcee5d5f057f637c05` 유지.
- Chrome 1280×900, 390×844 직접 판독: 이미지 정상 표시, 본문·CTA 겹침 없음, 모바일 가로 넘침 없음(390/390). 실제 캡처 속 글자는 작은 화면에서 축소되므로 확대 링크를 제공한다.
- Marketplace JPEG 4장: 각각 1600×1000, 2 MB 미만. 이미지 규격·Slack 문맥 공식 지침 재확인(2026-09-22).
- `git diff --check`: 통과.

## 범위와 한계

홈페이지/문서/exporter 목록만 변경했다. 엔진·API·변환·세션 로직은 수정하지 않았다. 이전 실제 Slack 재현에서 rhwp 이름, 35페이지 PDF/3 PNG/완료 반응/브라우저 열기를 확인했다. 이번 홈페이지 변경으로 편집 저장·철회 수용을 새로 완료했다고 주장하지 않는다. 배포·설정 저장 결과는 후속 기록에 연결한다.

## 공개 배포 확인 — 2026-09-22

- 검토·배포 source: `9815658c2c8cb669a63e5447c9e820b494d7aa9a`. PR #27의 push/PR 두 실행에서 viewer와 container 모두 통과했다([push](https://github.com/postmelee/rhwp-slack/actions/runs/35681230258), [PR](https://github.com/postmelee/rhwp-slack/actions/runs/35681411536)).
- Cloudflare Pages `rhwp-slack`, production `devel`: [0d4c8640](https://0d4c8640.rhwp-slack.pages.dev). 공개 주소 https://rhwp-slack.pages.dev/ 에 실제 이미지를 반영했다.
- Chrome에서 실제 이미지 로드(775×575)와 공개 페이지 직접 확인. curl 기준 홈·사용 안내·개인정보·지원·editor·JPEG 200, `/.env`와 없는 경로 404. JPEG SHA-256은 승인된 로컬 파일과 일치한다. Python urllib의 기본 요청에서는 403이 나왔지만 Chrome과 curl에서는 정상 응답을 확인했다.
- `/install`은 Slack `/oauth/v2/authorize`로 302, state와 state cookie 존재만 확인하고 값은 기록하지 않았다. 실제 신규 설치를 다시 수행한 검증은 아니다.
- 직전 배포 `17a7e1a3`와 `/editor/` 및 version `fb123639…`의 editor JS 바이트 동일. exporter에서도 같은 프로그램 버전 유지. 서버/API 설정 변경 없음.
- 복구 필요 시 직전 production 배포 `17a7e1a3-8fa6-4070-a301-4e9ee24f94cf`로 되돌릴 수 있다.

## Slack 소개 설정 — 남은 확인

공개 앱 `A0C329NJ85C`에서 이름 rhwp, 짧은 소개, 공개 홈페이지·개인정보·지원 주소와 직접 설치 URL을 재확인했다. 긴 소개와 지원 이메일은 새 문구로 입력했으나 Save Changes가 비활성화되어 저장을 확인하지 못했다. 파일 선택 도구의 완료 응답 뒤에도 기존 2장만 보여, 준비한 이미지 3장의 저장 완료로 판정하지 않는다. 사용자에게 실제 키 입력 후 저장을 요청했다. #21은 이 설정 저장과 재조회가 끝날 때까지 열어 둔다. Marketplace 최종 제출은 #4이며 이번 배포 범위에 포함하지 않는다.
