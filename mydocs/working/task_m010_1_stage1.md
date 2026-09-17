# Task #1 Stage 1 — 실제 rhwp 뷰어와 개발 검증 기반

GitHub Issue: [#1](https://github.com/postmelee/rhwp-slack/issues/1)

구현계획서: [task_m010_1_impl.md](../plans/task_m010_1_impl.md)

Stage: 1 / 작성일: 2026-09-15 / 상태: 구현·로컬 검증 완료, Stage 2 진입 승인 대기

## 단계 목적

실제 `@rhwp/core@0.8.6`으로 HWP5/HWPX를 읽는 뷰어와 개발·검증 기반을 만든다. Slack 기본 iframe과 같은 opaque origin에서 worker, 폰트, SVG, 페이지 이동과 확대가 동작하는지 확인한다.

## 산출물

| 파일 | 변경 요약 |
| --- | --- |
| `package.json`, lockfile, `.nvmrc`, TS/Vite 설정 | Node 24.21.0·npm 11.19.0 및 승인된 의존성 고정, 브라우저·worker·Node·테스트 타입 검사 분리 |
| `src/viewer/main.ts`, HTML, CSS | 한국어 읽기 UI, 1-based 페이지·50~200% 확대, 파일 선택·닫기·로딩·오류 |
| `src/viewer/engine.ts`, `engine.worker.ts` | 실제 WASM, Blob worker, 작업 timeout·종료, 최대 3페이지/16 MiB SVG 캐시, 문서 교체 |
| `src/viewer/fonts.ts`, `sanitize-svg.ts` | Noto 표시 폰트, DOMPurify와 CSS/URL 정책 |
| `src/shared/` | 20 MiB·200페이지·입력·오류 계약 |
| `scripts/prepare-assets.mjs` | 496 font face·WASM·라이선스, 자산 SHA-256 manifest |
| `scripts/serve-viewer.mjs`, `run-tests.mjs` | loopback 개발/iframe 서버, 테스트 0개이면 실패 |
| `scripts/create-fixtures.mjs`, `tests/fixtures/` | 직접 작성한 두 페이지 HWP/HWPX, 출처·해시·독립 기대 내용, 엔진 한계 재현 옵션 |
| `tests/unit/`, `tests/viewer/`, Playwright 설정 | 실제 파일·sandbox·확대·오류·교체·취소·보안·상한 검사 |
| `.github/workflows/ci.yml` | Linux 검사 정의, Actions SHA 고정, 합성 테스트 화면 증거 보관 |
| `README.md`, `docs/dependencies.md` | 실행법·지원 상태·출처·알려진 엔진 한계 |

## 본문 변경 정도 / 본문 무손실 여부

- 신규 앱 코드이며 기존 rhwp 엔진 저장소와 그 작업 파일은 변경하지 않았다.
- 승인된 계획의 문서 위치를 유지했다. 기존 수행계획·오늘할일의 상태만 갱신한다.
- 실제 v0.8.6 소스의 `EmbeddedTextMeasurer`와 배포 WASM glue를 확인하여 계획의 OffscreenCanvas 측정 callback 가정을 정정했다. main-thread fallback이나 DOM 흉내 없이 실제 worker로 실행한다. Noto는 화면 표시용 대체 글꼴이며 내장 측정값과 동일하다는 주장은 하지 않는다.
- 고유 origin의 sandbox는 폼 제출을 차단한다. 실제 테스트 실패를 근거로 페이지 입력을 form submit에서 Enter keydown으로 바꿨다. sandbox 권한을 완화하지 않았다.
- 처음 작성한 합성 입력의 글꼴 크기 단위(1/100 pt)를 바로잡았다. 이미 승인된 baseline을 완화한 변경은 아니다. 실제 glyph 높이와 스크린샷으로 작은 글자가 숨는 문제를 확인·수정했다.

## 검증 결과

환경: macOS arm64, Node **24.21.0**, npm **11.19.0**, Playwright **1.63.0**, Chromium **153.0.8010.12**. 시작 commit `88a485a`, 검증한 제품 소스는 이 보고서와 함께 커밋한다.

실행 명령:

```sh
npm ci --ignore-scripts --no-audit --no-fund
npm run typecheck
npm test
npm exec playwright install chromium
npm run test:viewer
git diff --check
```

결과:

- **PASS** 설치: lockfile 기준 30개 package 설치.
- **PASS** TypeScript: viewer·worker·Node·브라우저 테스트 4개 설정.
- **PASS** Node 테스트: `tests 4 / pass 4 / fail 0`.
- **PASS** production·development Vite build. production에는 파일 선택과 개발 테스트 API가 없다. Stage 3 연결 전까지 안내 화면이다.
- **PASS** Playwright: `10 passed (7.5s)`. 스킵 또는 expected failure로 처리한 수용 테스트는 없다.
- **PASS** HWP/HWPX × 일반 페이지/opaque iframe 4개 조합에서 실제 두 페이지 렌더, glyph 내용과 글자 크기, 50~200% 선택 UI의 150% 크기 동작, 페이지 처음·마지막·범위 밖 입력, 표·내장 PNG, 닫기 후 worker 해제.
- **PASS** 손상된 CFB 입력 후 정상 파일 재시도, 로딩 중 문서 교체·취소, 외부 요청 부재.
- **PASS** 실제로 200번 쪽 나누기를 넣어 만든 201페이지 문서의 파싱 후 거절.
- **PASS** 악성 SVG의 script·foreignObject·외부 이미지·CSS import/escaped URL 차단과 내부 clip path·PNG 보존.
- **PASS** worker가 동기 무한 루프에 들어가는 테스트에서 500ms 시험 deadline으로 종료, UI 응답 유지. 제품 기본 deadline은 30초다.
- **PASS** 공백 오류 검사. CI workflow를 작성했으나 원격 push를 하지 않아 GitHub Linux 실행 결과는 아직 없다.

### 화면 확인

최종 HWP/HWPX iframe 화면의 1·2페이지를 직접 확인했다. 첫 페이지의 제목·본문·2×2 표와 셀 내용, 둘째 페이지의 제목·본문·초록색 이미지와 설명 글을 확인했다. 화면 폭 확대와 스크롤을 지원한다. PNG·텍스트·페이지 수만으로 한컴 조판 일치를 선언하지 않는다.

HWP의 그림 옆 설명은 아래쪽 기준선, HWPX는 위쪽에 나타나는 차이가 있다. 양쪽 이미지·문구는 보이지만 두 형식의 조판이 동일하다고 판정하지 않는다.

아래 파일은 로컬 `test-results/`에 남으며 CI에서는 artifact로 보관한다. 다음 테스트 실행 시 재생성된다.

| 화면 파일 | SHA-256 |
| --- | --- |
| `test-results/viewer-viewer-two-pages-hwp-opaque-iframe-actual-rendering/page-1.png` | `1d928ba479a7edd8803c72a929a9c2edc4e40c05414d3e269077048f5f8ef4f2` |
| `test-results/viewer-viewer-two-pages-hwp-opaque-iframe-actual-rendering/page-2.png` | `916a4770536138025844ce7b8b9222fb961580c8b72618b8c7ceaf884bcd5fe8` |
| `test-results/viewer-viewer-two-pages-hwp-standalone-actual-rendering/page-1.png` | `05c8494cd150a89138d6e11916317309f68a6a7250275efbfeaace88c13b2eae` |
| `test-results/viewer-viewer-two-pages-hwp-standalone-actual-rendering/page-2.png` | `aea0d49a7ff6a00d8c2f23b94f399b80f027e013b3679c72dac97665cbaa9bcf` |
| `test-results/viewer-viewer-two-pages-hwpx-opaque-iframe-actual-rendering/page-1.png` | `e0959de1b101911dc59a43a81e74ab219ed777df031564b60277f131a51fc1c3` |
| `test-results/viewer-viewer-two-pages-hwpx-opaque-iframe-actual-rendering/page-2.png` | `dcc86306418a5f5cafe845fd6561569c81da5148f463f32b160b27d9679d545b` |
| `test-results/viewer-viewer-two-pages-hwpx-standalone-actual-rendering/page-1.png` | `cb7f34665cd7df98b96d1fd69d8feb29e75a4af5fb7ca55b59a9df2184897b50` |
| `test-results/viewer-viewer-two-pages-hwpx-standalone-actual-rendering/page-2.png` | `77a67595b59f13be665c3e1d4f82eb62e48e69e3377c29dd07c552b56b7363fa` |

### 검증 소스 식별

아래 정렬된 `sha256  경로` 목록의 UTF-8 전체 SHA-256: `be141b1df023dce5ef4584a013b3a462cc7c95b1a27b9a57a589ac943343e2ab`. 문서 상태 변경은 이 제품 소스 목록에 포함하지 않는다.

<details>
<summary>제품 소스·설정·테스트 34개 파일의 해시</summary>

```text
443c11892c9dde18fc7bc3c7a261c5f45addfde71324737a13a04ba7e80a7db3  .env.example
ebf5bc783ab919bf88dc5b9cd41ee28e54613a2a8303ce5c1b89fd3fa2eab007  .github/workflows/ci.yml
1e3b05d5c5030b2729fe2dbd5eb91dcb5529f41e96f1f33b77f948186f9b8072  .gitignore
73fb1b615e2043a933be1c0895cde4358036acc28d785692509b822aa53c761f  .nvmrc
791fac9b2c121700e00aea46fcffa2ffb7ff4f980764e000b4474280d78fe96b  package-lock.json
2ee1f784ea3a1cd6438df6914f366c705fe57022ba5f0b5df9969bf880da7f0b  package.json
b81660e5c46e097267612b914433a368a2e23276fac9403b6e269572c1ba116d  playwright.config.ts
81eb9536fd838866738d381d9a2655193d8654e22109700526116f548bb4b986  scripts/create-fixtures.mjs
6cbed578bb27acea0cd6e7d843f79c8cef16e3d0c120e67cc7f003a00183c177  scripts/prepare-assets.mjs
4294e5930a4f1571b73cd6f9ce5166fb61c629454668dc0c932eefbd92e39a24  scripts/run-tests.mjs
89073087662f5d25b4e00e432d20f3851203ac4419b6ca3522e81bd26390bcfa  scripts/serve-viewer.mjs
d9aaa6d894504c66227be7b3df3d2af8e3e59fe6d5cc8b1335db4fd4ff18dddf  src/shared/errors.ts
111d2dcecaa1d35b74a454945ee8cb1cf82e1cba8b69224f6dbc2069fac3ea0c  src/shared/page-number.ts
8f2a18cb79716a3bafff0a228816b4097e6fd5b53facafb747bbb5fdf675a609  src/viewer/engine.ts
5d6358f42f75a3f0b3de4c60ccf1dc859f0833f02d1f17fa7d4f2a491fbe2b70  src/viewer/engine.worker.ts
0fc292ee6783b71700d1f13cef8af34431ab36ac9106fc8837d15120576bf923  src/viewer/env.d.ts
c579b233f0abba3a1037c4043b77f24589f668db6489292a3a884f683b7aa9af  src/viewer/fonts.ts
54163531107124d53c4a627442244d8ddd88a80365a979a56ca940ee5f00ac41  src/viewer/index.html
23680700f6d5dfe6e2db0557ad1130f0bb3849baf0dccfa900864b5db178c1fe  src/viewer/main.ts
1fafcab7cc85853dff51b17507707f503f1e744ab29a1128760b6c00e3625249  src/viewer/sanitize-svg.ts
2894105ec0967f1f07ab41949875e000b7ad9eb4dc6b811bef9dd34445d4c68e  src/viewer/testing.ts
28575d90b10b096c7a7155d881ba074e63923f92835cec3a90ed4cc61239469f  src/viewer/viewer.css
4fb2a2e1bfb04510d491213de977259bf52e5bd50ada22b2e23593581b646def  tests/fixtures/manifest.json
176179dea7ddccc397b0497a980e8a2ea1dd2dfe576f5fbee8b8cdf3f995325c  tests/fixtures/viewer-two-pages.hwp
4dc519ebd92336f65336618f5a58399d94c8f76e70404339ee0ef4dc3cff70c0  tests/fixtures/viewer-two-pages.hwpx
b848a7f485cb9d4e63392250b95035bb15522c5f64c1dc464ec414108418bf6c  tests/unit/contracts.test.ts
11c45306a6b77a6c7537ead7ef3ed3a6c3a259b9213e288bf3a3a18751ba68e6  tests/viewer/limits.spec.ts
2c6f8b9ef84eb6c73d7d6260be7672b8755dada71d0150f24be03bb5f1b98440  tests/viewer/security.spec.ts
4312d68ceed7c8a0f9dd7b5538ddf67476e46683b98e1c43be020aafeb9ff8a4  tests/viewer/viewer.spec.ts
c3a48ae3af2d6c083bcee8358c3ed42ee223ed5814cd5925bf61aaaacef62fa8  tsconfig.json
962c4c4de0cb417674644224728c8e451ef4692f551a746c86d8cc9d6524da62  tsconfig.server.json
edba3411df23f2695d9a72c9dab4d0b80577f913dadcfe51850fa5ffc8faf4e2  tsconfig.tests.json
1b96121031c910aadad88fb1166955cf05349f70a9062df1e938549461cad0be  tsconfig.worker.json
4b227e6673442a802bfcffe1ca823fa9ef01a139d9fc19be2e054b5415f08f34  vite.config.ts
```

</details>

## 잔여 위험

1. **확인된 엔진 누락**: 그림만 있는 문단에 inline PNG를 넣은 합성 문서를 rhwp 0.8.6으로 HWPX 저장·재개방하면 page 2의 SVG image가 0개다. 같은 HWP는 1개다. sanitizer 이전 엔진 결과로 재현했다. 정상 수용 fixture에는 설명 글을 넣었으나 이 실패를 엔진 수정 완료로 취급하지 않는다.

   ```sh
   node scripts/create-fixtures.mjs --image-only
   # HWP: expectedImagesOnPage2=1, actualImagesOnPage2=1
   # HWPX: expectedImagesOnPage2=1, actualImagesOnPage2=0
   ```

   이 진단은 정상 fixture를 바꾸지 않고 임시 디렉터리에 재현 문서를 만든다. upstream 보고·수정은 별도 범위이며 이번 단계에서 원격 issue/comment를 보내지 않았다.
2. **미검증**: 실제 Slack Work Objects, 사용자 접근 권한, Linux CI 실행, 모바일·Slack Connect·배포형 앱. Stage 1 로컬 결과를 실제 Slack 지원 완료로 승격하지 않는다.
3. **시각 충실도**: 한컴 생성 원본/독립 정답지는 없다. 대체 폰트, 위 설명 글 기준선 차이, 이미지 전용 문단 누락을 포함하여 원본 일치 보장은 하지 않는다.
4. **자원**: 입력 byte·페이지·worker deadline·SVG 캐시는 제한하지만 압축 해제 메모리에 대한 하드 cap은 없다. 폰트 약 10 MiB와 WASM 약 10 MiB가 필요하다.

## 다음 단계 영향

- Stage 2는 `/rhwp open`, `/rhwp help`, 메시지 바로가기와 Slack 서명·채널 멤버십·파일 접근 확인을 구현한다.
- viewer는 아직 문서 세션을 받지 않는다. Stage 3에서 인증된 bytes를 `Engine.open()`에 연결한다. 개발 파일 입력을 production에서 활성화하는 방법으로 대체하지 않는다.
- iframe에 `allow-forms`를 추가할 필요가 없다. Origin null의 정적 자산 CORS와 Blob worker를 유지하고 production CSP에는 실제 Slack 조상을 적용한다.
- 엔진의 실제 콜백/측정 경로와 알려진 이미지 한계를 후속 변환 기능 설계에도 전달한다.

## 승인 요청

- Stage 1 앱 구현·로컬 검증 결과와 위 엔진 한계를 검토한 뒤 Stage 2 진입을 승인한다.
- 전체 Task #1 완료 또는 실제 Slack 수용 완료를 요청하는 보고가 아니다.
