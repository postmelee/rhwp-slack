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
