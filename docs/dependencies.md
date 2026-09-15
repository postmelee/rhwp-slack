# 의존성과 테스트 문서 출처

## 고정 버전

| 구성 | 버전 | 라이선스 / 용도 |
| --- | --- | --- |
| Node.js / npm | 24.21.0 / 11.19.0 | 개발·검증 runtime |
| @rhwp/core | 0.8.6 | MIT / HWP·HWPX 파싱, SVG |
| @rhwp/editor / rhwp-studio | 0.8.6 | MIT / 공식 iframe SDK와 전체 편집 UI |
| Vite | 8.3.0 | MIT / 호스트·Studio 빌드 |
| TypeScript / @types/node | 5.9.3 / 24.13.4 | Apache-2.0 / MIT, 타입 검사 |
| tsx | 4.23.13 | MIT / Node 테스트 실행 |
| @playwright/test | 1.63.0 | Apache-2.0 / Chromium 테스트 |

`package.json`은 정확한 버전, `package-lock.json`은 전이 의존성과 배포 integrity를 고정합니다. Node 설치 아카이브는 공식 `SHASUMS256.txt`와 대조했습니다. GitHub Actions도 공식 태그의 commit SHA로 고정했습니다.

## rhwp 원본

- [v0.8.6 소스](https://github.com/edwardkim/rhwp/tree/v0.8.6), commit `f1f9c6ae58344ee9368996d3543f76b9345cf227`.
- npm integrity: `sha512-ZMO2QMHbR4v7t86feMWiRJ4QozjjqHDGv4PyzTT4LyMuX1LeUpmQaOHrGLQpbYMJV0IWCYjVRewKqkXx+w16XQ==`.
- WASM 원본 크기: 9,936,164 bytes. 엔진 소스·배포 바이너리는 수정하지 않습니다.
- [실제 측정 구현](https://github.com/edwardkim/rhwp/blob/v0.8.6/src/renderer/layout/text_measurement.rs)은 내장 메트릭을 사용합니다. npm README의 `globalThis.measureTextWidth` 예제는 이 버전 SVG 조판의 실제 콜백 계약이 아닙니다. 불필요한 콜백이나 window/canvas 흉내를 추가하지 않았습니다.

## 폰트와 자산

Studio upstream의 `assets/fonts`를 그대로 자체 호스팅하고 폰트 family를 앱에서 재매핑하지 않습니다. 외부 CDN 폰트는 빌드 설정과 CSP로 차단합니다. upstream의 `LICENSE`, `THIRD_PARTY_LICENSES.md` 및 폰트 고지를 배포 자산에 포함합니다.

`studio/upstream.json`이 commit과 선택 경로의 `git archive` SHA-256을 고정합니다. `prepare:studio`는 archive 해시를 확인하고 매번 원본 파일을 추출합니다. 원본 checkout은 수정하지 않으며 `studio/vite.config.ts`의 명시적 build overlay만 적용합니다. 수정 대상 앵커가 달라지면 빌드가 실패합니다. source archive SHA-256: `1e6b1533ba77078fa134112487f18872d9bc30382838ff558532643e3c37ee0e`.

Studio 전이 의존성은 고정 archive 안의 `rhwp-studio/package-lock.json`으로 설치합니다. 앱 SDK/core는 앱의 lockfile을 사용합니다. PWA 플러그인을 활성화하지 않으며 샘플 문서는 배포하지 않습니다. CanvasKit은 upstream 선택 경로로 포함되지만 기본 검증 renderer는 SDK 기본 Canvas2D입니다. CanvasKit의 Node `fs/path` 외부화 경고와 큰 청크 경고는 빌드 시 표시됩니다.

SDK integrity: `sha512-Hc/rHrQrgZqJ2OSWNsPd/8tKyfnLer8M9r+U81yphJ7O8LaXLuv5A2yUub2fhFnfaYyfl76LfOIMsfcD0/dXgA==`.

## 문서 fixture

`scripts/create-fixtures.mjs`의 텍스트·2×2 표·초록색 PNG는 이 프로젝트를 위해 직접 작성했습니다. 빈 HWP 구조는 MIT rhwp의 `createBlankDocument`로 생성하고 정상 HWP5/HWPX로 저장합니다. 기대 문구, 두 페이지, 표의 4개 셀과 이미지·설명 글은 렌더 출력에서 추출해 결정하지 않았습니다.

`tests/fixtures/manifest.json`은 SHA-256·출처·예상 내용을 기록합니다. 이 fixture의 신규 작성 내용은 MIT 조건으로 프로젝트 테스트에 사용할 수 있습니다. 샘플은 합성 통합 검증용이며 한컴 생성 문서 또는 독립 한컴 출력 정답지가 아닙니다.

개발 중 fixture의 글자 크기 인자가 1/100 pt임을 확인해 20pt를 2000으로 바로잡았습니다. 텍스트가 개별 SVG glyph에 저장되는 관계로 텍스트 검사는 glyph 순서로 비교하고, 화면 크기·스크린샷은 별도로 확인합니다. 공백 정규화는 시각 검증을 대체하지 않습니다.

`--image-only`는 알려진 HWPX inline 그림 누락을 재현합니다. normal fixture는 설명 글을 포함하지만 엔진이 그림만 있는 문단까지 지원한다고 주장하지 않습니다. README의 한계와 Stage 1 보고서에 해당 실패를 별도로 기록합니다.

## PDF 변환과 열람

고정 rhwp core의 `renderPageSvgWithProfile(page, 'print')`와 Studio의 `print-pages.ts`를 재사용해 페이지 크기 및 SVG ID를 분리하고 Chromium의 PDF 출력으로 저장합니다. native `rhwp export-pdf`/hwp2pdf CLI를 호출하는 구현은 아닙니다. 폰트 공급 목록은 같은 Studio의 생성된 `FONT_RULE_CANVAS2D_WEBFONT_RULES` 중 로컬 항목만 사용합니다. 브라우저 컨텍스트의 외부 네트워크는 차단하며 사용자 SVG는 DOM으로 파싱하고 실행 요소를 제거합니다.

Stage 3.1에서 별도 PDF.js 열람 화면과 직접 의존성·배포 자산을 제거했습니다. PDF 열람은 후속 Slack 연동의 PDF 첨부 미리보기로 제공하며 서버 변환 구현은 유지합니다. 변환 runtime은 개발 의존성인 Playwright/tsx도 필요합니다. Linux 배포 이미지 의존성 분류는 Stage 6에서 확정합니다.

Chromium PDF의 생성 시각은 달라질 수 있어 산출물 byte 재현성을 주장하지 않습니다. 원본 font가 로컬 공급 목록에 없으면 대체 font를 사용하므로 한컴 출력과의 동일성은 별도 검증 대상입니다.
