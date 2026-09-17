# Task #1 Stage 2 — Studio 전체 편집기 임베드

GitHub Issue: [#1](https://github.com/postmelee/rhwp-slack/issues/1)
구현계획서: [task_m010_1_impl.md](../plans/task_m010_1_impl.md)
Stage: 2

## 단계 목적

사용자의 “변경해줘” 지시에 따라 별도 SVG 뷰어를 자체 호스팅 rhwp-studio 전체 편집 UI로 교체하고, 이전 문서 복구·자동 저장·최근 문서·영속 문서 이력을 비활성화한다. 계획 변경 커밋은 `2b806cd4c506473d08900c8077b0ac8b772d45a1`이며 이 보고서와 같은 Stage 2 커밋이 구현 검증 대상이다.

## 산출물

| 파일 | 변경 요약 |
|---|---|
| `studio/upstream.json` | 0.8.6 commit·archive SHA-256·추출 경로 고정 |
| `scripts/prepare-studio.mjs`, `scripts/build-studio.mjs` | 검증된 원본 추출·별도 lock 설치·라이선스와 로컬 폰트 포함 |
| `studio/vite.config.ts` | 자체 호스팅, embed 강제, URL 문서 로드 차단, 설정 잠금, PWA 제외 |
| `studio/adapters/persistence.ts` | 문서 DB를 열지 않는 adapter, 저장 요청은 성공으로 가장하지 않음 |
| `src/viewer/` | 공식 SDK의 얇은 호스트, 개발 전용 파일 연결, 입력/페이지 제한 |
| `scripts/serve-viewer.mjs` | 두 정적 경로·로컬 CSP·same-origin 중첩 iframe |
| `tests/viewer/studio.spec.ts`, `tests/unit/persistence.test.ts` | 실제 편집과 데이터 비영속성, upstream 결함 재현 |
| package/lock·설정·README·dependencies | 기존 worker·DOMPurify·Fontsource 경로 제거, 실행법과 한계 갱신 |

SDK와 엔진은 모두 0.8.6이다. 원본 rhwp 작업 트리와 Rust/WASM은 수정하지 않았다. 이전 Stage 1의 source/보고서는 Git 이력에 보존했다.

## 본문 변경 정도 / 본문 무손실 여부

코드 작업에 해당한다. Studio 메뉴·툴바·키보드 입력·서식·표 편집·메모리 undo/redo·dirty 상태를 재사용한다. 문서 복구 저장소와 비교용 영속 이력은 별도 계층으로 차단했다. 복구/자동 저장 옵션은 화면에서도 꺼진 상태로 잠근다. 과거 사용자가 보유한 문서 DB를 읽거나 삭제하지 않는다.

원본의 로컬 문서 열기·새 문서·로컬 저장·인쇄·문서 비교·문서 이력 명령은 embed에서 숨긴다. 이 명령들은 Slack 호스트의 문서 식별·저장 흐름과 충돌한다. 따라서 모든 브라우저 기능을 지원한다는 의미는 아니다. 내보내기는 테스트 SDK에서 검증했으며 Slack 저장 성공은 아직 구현하지 않았다. export 후에도 dirty가 유지되는 것을 확인했다.

## 검증 결과

환경: macOS arm64, Node 24.21.0, npm 11.19.0, Playwright 1.63.0 Chromium. upstream commit `f1f9c6ae58344ee9368996d3543f76b9345cf227`.

실행 명령:

```sh
npm ci --ignore-scripts
npm run prepare:studio
npm run typecheck
npm test
npm run build
npm exec playwright install chromium
npm run test:viewer
git diff --check
```

최종 테스트 증거 저장 방식 변경 뒤 `npm run typecheck`, `npx playwright test`를 다시 실행했다. 로그는 `.cache/validation/`에 있다.

- 의존성 설치·source archive 검증·타입 검사·production/dev 빌드·diff 검사: OK.
- 단위 테스트: **5개 통과**.
- 브라우저: **정상 시나리오 8개 통과, 알려진 upstream 실패 1개 재현**. Playwright의 마지막 `9 passed`에는 `test.fail`로 명시한 실패가 포함된다. 전체 기능 9개가 정상이라는 뜻이 아니다.
- HWP/HWPX 각 2페이지를 실제 Studio에서 로드, 텍스트 변경, undo/redo, HWP/HWPX export 후 재열기로 변경 보존 확인. 두 형식 모두 테스트 중 외부 origin 요청 없음.
- 실제 키보드 입력, 단일 서식 선택의 굵게 적용·취소, 표 생성·취소 동작 확인. Canvas2D 화면에서 한글·표·그림 확인. 모든 폰트/대화상자/플러그인 조합 검증은 아님.
- 기존 IndexedDB draft를 합성 fixture로 심고 과거 설정을 자동 저장 true로 둔 상태에서도 문서 자동 복원 없음. 실제 설정 UI 잠금과 설정 강제 변경 뒤 편집·11분 시간 진행·재열기를 거쳐 Studio의 document DB open 호출 0회. 새 Recent/History DB와 service worker 없음. 기존 draft는 읽거나 지우지 않음.
- 실제 allow-scripts + allow-same-origin 중첩 iframe에서 SDK 연결·문서 표시. production에는 파일 연결·테스트 SDK가 노출되지 않음. direct Studio의 chrome=full·외부 url 매개변수도 호스트 정책을 우회하지 못함.
- signature/20 MiB/손상 ZIP/201페이지 거절 및 손상 파일 이후 정상 문서 재열기 확인.

### 알려진 실패 B-004 — 혼합 서식 전체 선택의 실행 취소

재현: 합성 HWP 열기 → 첫 문단에 `Keyboard edit ` 입력 → 전체 선택 → 굵게 버튼 → undo. 독립적인 기대값은 “undo는 변경 전 각 글자의 서식과 배치를 복원한다”이다.

결과: 첫 페이지 SVG의 굵게 glyph 8개가 0개로 바뀌고 제목 크기·표 세로 위치가 변경된다. 표 상단 y는 약 198.40에서 177.07로 이동했다. 동일 첫 페이지의 before/after SVG와 화면을 직접 확인했다. 테스트의 전체 SVG 일치 기대값을 바꾸거나 baseline을 갱신하지 않았다. known-failure 지정은 최종 비교 직전에만 적용하므로 준비·편집 단계의 다른 실패는 그대로 테스트 실패가 된다.

Slack policy plugin을 제거하고 동일 고정 source/core로 만든 대조 빌드에서도 `geometryEqual=false`, `boldBefore=8`, `boldAfter=0`을 확인했다. 대조 명령은 `node .cache/validation/upstream-control.mjs`, 결과는 `.cache/validation/upstream-control.json`이다. 이 변경의 persistence overlay가 원인은 아니다. engine/Studio의 세부 원인 수정은 이번 범위 밖이며 B-004로 보존한다.

### 검증 source 및 증거 해시

소스·테스트·설정 파일 목록은 `.cache/validation/source-manifest.json`에 기록했다. manifest SHA-256: `62a59924fe8cbb7278d284be617e3fccfc1294074e2d0b4e672eaf9a8fcb2edc`.

- `test-results/studio-hwp.png`: `45defeb00d12bf53f6fa2110896f0260c04158b950be2d7ab67706ef316df588`
- `test-results/studio-hwpx.png`: `1f242b245ea9c8c6e161cd98ee15acac65b361b64097b7e30871894bf36b1b16`
- `test-results/studio-known-upstream-mixe-3d988-formatting-and-SVG-geometry/after-undo.png`: `1033743f2b0c4bfe59e18189d6260b5caa06556f6754c432675c7cf6c79c3252`
- `test-results/studio-known-upstream-mixe-3d988-formatting-and-SVG-geometry/after-undo.svg`: `186d0939237929e0bcfff4a117499fdbd2e5c5245af0cb0c00703e3b914ad9ff`
- `test-results/studio-known-upstream-mixe-3d988-formatting-and-SVG-geometry/before.png`: `119d046e45cf860a97be2ed5b0542030df17fe765580eb9af9e706ddf4c1df45`
- `test-results/studio-known-upstream-mixe-3d988-formatting-and-SVG-geometry/before.svg`: `e98c7dd7d26d239bb9fe8fca36cbd47d77f6f957ab933518920c59a367d368ab`

## 잔여 위험

- B-004 혼합 서식 undo 결함을 해결하지 않았다. 일반 텍스트 undo/redo 통과를 모든 서식 복원 보장으로 확대하지 않는다.
- Slack 실제 웹·데스크톱, 인증·문서 접근 정책·편집본 Slack 저장, OS 클립보드/다운로드/인쇄, Linux 빌드는 미검증이다.
- SDK 60초 제한은 응답 대기 제한이다. 동기 WASM 무한 실행을 중단하는 별도 worker의 보장을 제공하지 않는다. 파싱 메모리의 하드 상한도 없다.
- 원본 한컴 출력 정답지와의 일치는 검증하지 않았다. Stage 1의 HWPX 그림 전용 문단/설명 위치 관련 한계도 남아 있다.
- 빌드의 CanvasKit fs/path 브라우저 외부화 및 큰 청크 경고가 존재한다. 기본 Canvas2D 경로는 통과했으며 CanvasKit 전체 호환성을 주장하지 않는다.

## 다음 단계 영향

Stage 3은 `/rhwp open/help`, 파일 선택, Slack 서명·사용자/채널/파일 권한 검사를 구현한다. Stage 4는 Work Objects·인증 session·명시적 편집본 Slack 저장을 연결하고 실제 업로드 성공 뒤에만 `notifySaved()`를 호출한다. PDF·썸네일·전체/지정 PNG·ZIP은 후속 task다.

## 승인 요청

현재 승인된 Studio 교체 구현을 로컬 커밋으로 마친다. Stage 3 진입은 사용자 승인 후 진행한다. 이번 단계에서는 원격 push·PR·Slack 메시지 전송·배포를 수행하지 않았다.
