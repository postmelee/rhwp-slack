# 의존성과 테스트 문서 출처

## 고정 버전

| 구성 | 버전 | 라이선스 / 용도 |
| --- | --- | --- |
| Node.js / npm | 24.21.0 / 11.19.0 | 개발·검증 runtime |
| @rhwp/core | 0.8.6 | MIT / HWP·HWPX 파싱, SVG |
| DOMPurify | 3.4.15 | Apache-2.0 선택 / SVG 정리 |
| @fontsource/noto-sans-kr | 5.3.0 | OFL-1.1 / 고딕 표시 |
| @fontsource/noto-serif-kr | 5.3.0 | OFL-1.1 / 명조 표시 |
| Vite | 8.3.0 | MIT / UI·worker 빌드 |
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

400·700 weight의 모든 unicode-range를 Fontsource CSS에서 읽어 496개 WOFF2 face를 복사합니다. 파일을 선택적으로 누락하지 않습니다. 최초 표시 전에 폰트를 준비하며 한 페이지 생명주기에서 재사용합니다. 엔진이 반환한 폰트 family는 명조/고딕에 따라 Noto로 매핑합니다. 글꼴 대체가 engine의 조판 위치까지 바꾸는 것은 아닙니다.

`npm run prepare:assets`는 WASM·폰트·런타임 라이선스와 파일별 SHA-256을 `public/vendor/manifest.json`에 만듭니다. 빌드 산출물에도 이 파일과 고지가 포함됩니다. 생성 자산과 `node_modules`는 커밋하지 않습니다. Vite가 기본 WASM URL을 분석하면서 개발 worker assets에 같은 WASM을 추가로 내보낼 수 있으나 앱은 명시한 `vendor/rhwp_bg.wasm`을 요청합니다.

## 문서 fixture

`scripts/create-fixtures.mjs`의 텍스트·2×2 표·초록색 PNG는 이 프로젝트를 위해 직접 작성했습니다. 빈 HWP 구조는 MIT rhwp의 `createBlankDocument`로 생성하고 정상 HWP5/HWPX로 저장합니다. 기대 문구, 두 페이지, 표의 4개 셀과 이미지·설명 글은 렌더 출력에서 추출해 결정하지 않았습니다.

`tests/fixtures/manifest.json`은 SHA-256·출처·예상 내용을 기록합니다. 이 fixture의 신규 작성 내용은 MIT 조건으로 프로젝트 테스트에 사용할 수 있습니다. 샘플은 합성 통합 검증용이며 한컴 생성 문서 또는 독립 한컴 출력 정답지가 아닙니다.

개발 중 fixture의 글자 크기 인자가 1/100 pt임을 확인해 20pt를 2000으로 바로잡았습니다. 텍스트가 개별 SVG glyph에 저장되는 관계로 텍스트 검사는 glyph 순서로 비교하고, 화면 크기·스크린샷은 별도로 확인합니다. 공백 정규화는 시각 검증을 대체하지 않습니다.

`--image-only`는 알려진 HWPX inline 그림 누락을 재현합니다. normal fixture는 설명 글을 포함하지만 엔진이 그림만 있는 문단까지 지원한다고 주장하지 않습니다. README의 한계와 Stage 1 보고서에 해당 실패를 별도로 기록합니다.
