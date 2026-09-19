# #8 Stage 2 — 버전별 프로그램 자산 캐시

GitHub Issue: [#8](https://github.com/postmelee/rhwp-slack/issues/8)
구현계획서: [task_m010_8_impl.md](../plans/task_m010_8_impl.md)
Stage: 2

## 단계 목적

문서/인증 응답을 캐시하지 않고 프로그램 재전송을 줄인다.

## 산출물

- `scripts/static-version.mjs`, `build-static.mjs`: 고정 upstream/package-lock/편집기/빌드 입력의 SHA-256 namespace. JS/WASM/CSS/font를 버전 디렉터리에 배치하며 manifest에 포함된 프로그램만 제공한다. 빌드 시 Brotli/gzip 생성.
- `src/server/static-assets.ts`, `editor-routes.ts`: 버전 경로만 immutable, 기존 `/editor/`·`/studio/`는 no-cache 재검증. representation별 ETag, Vary, 304, HEAD 지원. 없는/구버전 경로는 no-store 404이고 최신 파일로 대체하지 않는다.
- Vite·개발 fixture server·Dockerfile: 동일 manifest/프로그램 버전 사용.
- `tests/security/static-assets.test.ts`, `tests/viewer/cache.spec.ts`: 실제 HTTP 응답 및 같은 context 새 편집기의 자산 재사용/문서 미복구 확인.

## 본문 변경 정도 / 본문 무손실 여부

Studio 기능과 변환 출력은 변경하지 않았다. 문서 내용, 세션, 티켓, 저장 응답은 계속 no-store이다. manifest는 공개 프로그램만 포함한다.

## 검증 결과

- `npm run build && npm run build:dev` 통과. 개발 Studio 재빌드 후 압축 산출물이 지워지는 문제를 발견해 manifest/압축을 함께 다시 생성하도록 수정했다.
- `npm run typecheck` 통과.
- `node --import tsx --test tests/security/static-assets.test.ts tests/security/editor.test.ts`: 6/6 통과.
- `npx playwright test tests/viewer/startup.spec.ts tests/viewer/studio.spec.ts tests/viewer/cache.spec.ts`: 13건 통과 (기존 upstream 혼합서식 undo 1건은 expected failure 정책 그대로).
- 실제 새 편집 창에서 WASM/JS/woff2의 두 번째 ResourceTiming transferSize=0 확인. 새 문서는 0페이지이며 이전 파일을 복구하지 않는다.
- manifest만의 구버전 이름으로 최신 자산을 제공하는 fallback 없음. 권한 회수/만료/잘못된 origin/API no-store 유지.

## 잔여 위험

브라우저 캐시는 사용자의 환경에 따라 제거될 수 있다. 구버전 페이지가 열려 있는 동안 재배포되어 아직 받지 못한 자산이 사라지면 다시 Slack에서 편집기를 열어야 한다. 현재 배포에서는 운영 데이터를 영구 보관하는 자산 서버를 추가하지 않는다.

## 다음 단계 영향

Stage 3에서 메타데이터 조회의 중복 다운로드 제거와 초기화 병렬화를 적용한다. A/B/C 실제 네트워크 비교는 최종 프로그램 기준으로 진행한다.

## 승인 요청

기존 #8 진행 승인 범위로 Stage 3를 계속한다. 운영 배포는 아직 변경하지 않았다.
