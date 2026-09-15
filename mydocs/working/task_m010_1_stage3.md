# Task #1 Stage 3 — PDF 기본 열람과 Studio 편집 분리

GitHub Issue: [#1](https://github.com/postmelee/rhwp-slack/issues/1)
구현계획서: [task_m010_1_impl.md](../plans/task_m010_1_impl.md)
Stage: 3

## 단계 목적

사용자의 “그렇게 진행하고 싶어” 승인에 따라 PDF를 기본 열람 경로로 만들고 Studio를 편집 전용 화면으로 분리한다. 계획 변경은 `e18601f`로 커밋했고 Stage 1·2의 기록은 보존했다. 이번 보고서와 같은 Stage 3 커밋이 최종 구현 대상이다.

## 산출물

| 파일 | 변경 요약 |
|---|---|
| `src/viewer/` | PDF 전용 화면, PDF.js 페이지 표시·이전/다음·다운로드·별도 편집 진입 |
| `src/editor/` | 원본 Studio 호스트 이전, 40px 상단 파일명·dirty 상태, 접힌 개발 도구 |
| `studio/vite.config.ts` | Studio dirty 상태를 동일 origin 호스트에 전달; 기존 복구 금지 유지 |
| `src/conversion/` | core print SVG→Chromium PDF, 별도 파서·Chromium 수명 감독 |
| `src/server/dev-documents.mjs` | 개발 전용 Origin 검사·ticket·원본/PDF 메모리 보관·TTL·동시성 |
| `scripts/build-host.mjs`, `scripts/serve-viewer.mjs` | viewer/editor 독립 빌드·정적 경로·PDF.js 자산과 로컬 개발 API |
| `tests/viewer/pdf.spec.ts`, `tests/unit/dev-documents.test.mjs` | PDF→같은 문서 편집·작은 화면·dirty·실패·만료·동시성·deadline |
| README·dependencies·계획·orders | PDF 우선 진입과 후속 Slack 단계 정리 |

의존성은 기존 core/Studio/SDK 0.8.6을 유지하고 PDF.js `pdfjs-dist@6.3.289`를 고정 추가했다. PDF.js worker·CMap·기본 폰트·WASM·LICENSE를 자체 호스팅한다. 브라우저 내장 PDF 플러그인이 없는 headless 검증에서도 실제 PDF를 그린다.

## 본문 변경 정도 / 본문 무손실 여부

코드 작업이다. 기존 Studio의 메뉴·편집 기능을 재작성하지 않고 호스트 위치를 `/editor/`로 옮겼다. 파일명·페이지 수·개발 파일 선택이 한 상자에 있던 화면을 파일명/미저장 상태 한 줄과 접힌 개발 도구로 분리했다. 페이지 수는 Studio 하단 표시를 유지한다.

PDF의 “문서 편집”은 같은 원본 ticket을 새 화면으로 전달하고 fragment를 즉시 지운다. 편집해도 원본 PDF는 바뀌지 않는다. Slack 저장은 아직 연결하지 않았으며 버튼은 숨겼다. 저장 성공을 흉내 내거나 `notifySaved`를 호출하지 않는다. 향후 새 편집본 업로드 성공 후 그 revision의 PDF를 새로 만든다.

현재 PDF.js 화면은 웹/로컬 검증용이다. Slack 연동에서는 생성 PDF 첨부의 Slack 자체 미리보기를 기본 열람으로 사용하고 별도 Studio 편집 진입을 제공한다. 이 단계가 Slack 실제 연결 완료라는 의미는 아니다.

## 검증 결과

환경: macOS arm64, Node 24.21.0/npm 11.19.0, Playwright 1.63.0/Chromium 153. rhwp upstream `f1f9c6ae58344ee9368996d3543f76b9345cf227`.

```sh
npm run typecheck
npm test
npm run test:viewer
git diff --check
pdfinfo test-results/preview-hwp.pdf
pdfinfo test-results/preview-hwpx.pdf
pdftoppm -r 96 -png test-results/preview-hwp.pdf .cache/validation/final-hwp
pdftoppm -r 96 -png test-results/preview-hwpx.pdf .cache/validation/final-hwpx
pdftotext test-results/preview-hwp.pdf .cache/validation/final-hwp.txt
pdftotext test-results/preview-hwpx.pdf .cache/validation/final-hwpx.txt
```

- 타입·production/dev 빌드·diff 검사 통과. 단위 **7개 통과**.
- 브라우저 **정상 12개 통과 + 기존 known-failure 1개 재현**. Playwright의 `13 passed` 합계는 알려진 실패를 포함하므로 전체 기능 정상 13개로 해석하지 않는다.
- HWP/HWPX 각각 실제 2페이지 PDF 생성. PDF 1.4, A4, JavaScript 없음, 143,282 bytes. PDF.js 페이지 1·2의 한글 텍스트를 확인했고 같은 ticket의 원본을 Studio에서 열어 본문·페이지 수를 확인했다.
- PDF.js 화면과 Poppler 출력 4페이지를 직접 확인했다. 첫 페이지의 제목·소개·2×2 표, 둘째 페이지의 제목·본문·초록색 이미지가 표시된다. HWP와 HWPX의 그림 옆 설명 세로 위치 차이는 기존 한계로 남았다. 이는 한컴 출력과의 일치 판정이 아니다.
- 미저장 편집 뒤에도 같은 원본 PDF bytes 유지. export를 저장 완료로 인정하지 않는 Stage 2 계약도 유지.
- 669×863 및 400×800 화면에서 상단 40px, 긴 파일명 말줄임·전체 title, 가로 넘침 없음. Studio 원본의 문서 확대/스크롤은 유지한다.
- 외부 origin/다른 source의 dirty 메시지는 무시. production에 개발 파일 입력·변환 API 없음. 다른 Origin의 POST 403, 동시 변환 429, ticket 만료 404.
- PDF 변환 실패 시 이전 PDF·편집 진입을 해제하고 오류 안내. 손상/크기/201페이지 검사 및 기존 문서 기록 비영속성 회귀 테스트 통과.
- 변환 감독은 파서와 Chromium 각각의 프로세스 그룹을 소유한다. 초기 deadline 거절 테스트 및 정상 변환 cleanup을 실행했다. OS 강제 메모리 상한·Windows 자식 프로세스 정리는 미검증이다.

로그: `.cache/validation/stage3-typecheck.log`, `stage3-unit.log`, `stage3-final.log`.
소스 manifest: `.cache/validation/stage3-source-manifest.json`, SHA-256 `0d499fb096e0d277ae37640795cc37362a2e3d6a421424bdfefe4db50c3e093f`.

증거:

- `test-results/preview-hwp.pdf`: `16f7612b8f825277232809965fb31ace179b71ee98143f6f6a228cb48faefa19`
- `test-results/preview-hwpx.pdf`: `7325a86ff73743242c5e9291cec056107ebdb404f05de656e6cf13b0b7c38d06`
- `test-results/pdf-reader-hwp-1.png`: `4e5a8e4c1735115e5fefcb7c1d0ea6edd94f407191ed7bd0e6d7d32f620bdf45`
- `test-results/pdf-reader-hwp-2.png`: `0ffe7ebea497be896dc5e710f1f913829bb0493609c964576cd332ead07bac97`
- `test-results/editor-compact-hwp.png`: `7a421ef50593af21c8dda2b807bd0aab51292bf2c8dbeef76576c69d62f7fc02`
- `test-results/editor-long-name.png`: `7b2bf7ffc0325ac9b7a5f6a4586eed69ec88e7bb2083742e21a528fb82b17a2d`

## 잔여 위험

- 실제 Slack 인증·명령·네이티브 PDF 미리보기·편집본 업로드·저장 뒤 PDF 재생성은 다음 단계다. 현재 dev ticket은 Slack 접근 권한을 대신하지 않는다.
- 개발 API는 localhost 전용이다. 20 MiB 입력·200페이지·50 MiB PDF·단일 변환·60초 deadline, 총 200 MiB 보관을 적용한다. 15분 이후 접근을 거절하며 만료 자료는 1분 이내 정리한다. 변환 중 OS 메모리의 하드 상한과 Linux 배포는 미검증이다.
- PDF 변환은 native hwp2pdf CLI가 아니라 rhwp print SVG와 Chromium의 PDF 출력이다. 출력 생성 시각 때문에 byte 재현성을 보장하지 않는다. 로컬 폰트 대체·원본 엔진의 이미지/조판 한계가 출력에 반영될 수 있다.
- PDF.js 화면은 기본 페이지 열람을 제공하며 전체 텍스트 선택·검색·주석 UI는 아직 없다. PDF 받기로 외부 PDF 프로그램에서 사용할 수 있다.
- B-004: 혼합 서식 전체 선택의 굵게 변경 후 undo 시 서식·배치 미복원. 기존 기대값과 재현 테스트를 보존했고 엔진을 수정하지 않았다.

## 다음 단계 영향

Stage 4에서 `/rhwp open`/`pdf`→PDF, `/rhwp edit`→Studio와 Slack 파일/사용자/채널 접근 판정을 연결한다. Stage 5에서 PDF 첨부와 Work Objects 편집 진입, 새 파일 저장, revision별 PDF 재생성을 연결한다. PDF 재생성 실패를 원본 업로드 실패로 혼동하거나 이미 성공한 HWP를 중복 업로드하지 않도록 분리한다. Stage 6은 Linux·실제 Slack 통합 검증이다.

## 승인 요청

현재 승인된 PDF 기본 열람·Studio 편집 분리의 로컬 구현을 마친다. Stage 4의 Slack 명령·권한 연동 진입 승인을 요청한다. 원격 push·PR·Slack 메시지·배포는 이번 단계에서 수행하지 않았다.


---

## Stage 3.1 — Studio 직접 열기와 Slack PDF 열람 경로 정리

### 단계 목적 및 승인

사용자의 “그렇게 수정해줘”로 승인된 후속 변경이다. 계획 커밋 `e36983c`를 기준으로 구현했다. 위 Stage 3의 PDF.js 검증 기록은 당시 결과로 보존하며 현재 제품 동작은 이 절과 README를 따른다.

### 산출물

| 파일 | 변경 요약 |
| --- | --- |
| `src/editor/` | 별도 상단 메뉴 제거, Studio 전체 화면, 파일명·미저장 탭 제목, 로딩·오류·접근성 상태 |
| `src/viewer/` | PDF.js 전용 화면 제거; 개발 선언은 editor로 이동 |
| `scripts/build-host.mjs`, `vite.config.ts`, `tsconfig.json` | editor 전용 빌드, 이전 viewer 산출물 정리, PDF 변환용 print helper 유지 |
| `scripts/serve-viewer.mjs` | `/viewer/`→`/editor/` 이동, query/fragment 보존, 폐기된 PDF 자산 미제공 |
| package·lock | pdfjs-dist 및 전이 canvas 의존성 제거 |
| `tests/viewer/` | 직접 편집·전체 화면·개발 입력 분리, PDF API·동일 원본·오류 회귀 검증 |
| README·dependencies·AGENTS·계획·orders | 문서 열기→Studio, PDF로 보기→Slack PDF 첨부 계약 및 구현 상태 정리 |

### 본문 변경 정도 / 본문 무손실 여부

코드 작업이다. rhwp 엔진과 Studio overlay·PDF 변환 구현을 변경하지 않았다. 기존 메뉴·툴바·undo/redo·export·복구 금지를 유지했다. 편집 진입은 PDF 생성을 기다리지 않는다. 파일명과 미저장 별표는 탭 제목에 표시하고 실제 미저장 상태를 저장 완료로 바꾸지 않는다. 개발 파일 선택은 `?devtools=1`에서만 표시되고 로드 완료 시 닫힌다. production에서는 이 query로도 활성화되지 않는다.

실제 Slack 카드·receiver·업로드 구현은 아직 없다. 이번에 “PDF로 변환”→“PDF로 보기” 이름과 연결 규칙을 계획 및 제품 문서에 확정했다. Slack에서 해당 버튼이 실제 동작한다고 주장하지 않는다.

### 검증 결과

- `npm run typecheck` 통과, `npm test` 단위 7개 통과.
- `npm run test:viewer`: production/dev 빌드 통과, 브라우저 정상 12개 통과 + 기존 B-004 known-failure 1개 재현. Playwright의 `13 passed`는 이 알려진 실패를 포함한다.
- HWP/HWPX 실제 PDF API 변환: 각각 2페이지, A4, PDF 1.4, 143,282 bytes. `pdfinfo`로 구조 확인; HWP의 `pdftotext`에서 두 페이지 제목·표·그림 설명 확인. PDF 조판 변경 작업이 아니므로 이전 한컴 일치/불일치 판정을 갱신하지 않는다.
- 기존 `/viewer/#document=...` 주소가 같은 원본을 Studio에서 직접 열고 fragment를 소비한다. 편집 뒤 원본 PDF bytes가 유지된다.
- 기본 주소에는 개발 도구가 없고, 개발 query에서 선택한 문서는 서버 PDF API를 호출하지 않는다. production에서 개발 query·문서 API는 활성화되지 않는다.
- 669×863·400×800에서 Studio iframe이 x=0/y=0부터 전체 높이를 사용한다. 실제 스크린샷에서 별도 상단 메뉴/테스트 상자 부재, 기존 Studio 메뉴·툴바·본문·하단 상태를 직접 확인했다. 긴 파일명은 화면 너비를 늘리지 않는다.
- 키보드 편집 후 탭 제목 별표와 SDK dirty 상태 유지. 호스트에서 보낸 위조 dirty 이벤트 무시. 만료 시 오류 안내가 화면에 표시된다.
- `git diff --check` 통과. 브라우저 검증 이후 build-host 파일의 EOF 빈 줄만 정리했으며 실행 동작은 바뀌지 않았다.
- 엔진 저장소에는 기존 사용자 변경 `samples/exam_eng.pdf`만 남아 있으며 이번 작업으로 수정하지 않았다.

검증 환경은 macOS arm64, Node 24.21.0/npm 11.19.0, Chromium 153, 고정 Studio/core 0.8.6이다.

로그: `.cache/validation/stage3-1-browser.log`.
소스 manifest: `.cache/validation/stage3-1-source-manifest.json`, SHA-256 `f1f6766da865392fe49cfe6c6e75869d5738f2aeecd5f0104d67fe415aa96784`.
화면 증거: `test-results/editor-full-hwp.png`, `editor-full-hwpx.png`, `editor-long-name.png`, `editor-expired.png`.

### 잔여 위험

실제 Slack의 카드·PDF 업로드·기본 미리보기·편집본 저장은 후속 Stage에서 연결해야 한다. 탭 제목은 Slack 내부 iframe에서 항상 사용자에게 노출되는 UI가 아니므로 실제 저장 동작을 연결할 때 Studio 내 저장 표시를 함께 검증한다. B-004와 기존 엔진 호환성 한계, Linux 및 실제 Slack 미검증은 유지한다.

### 다음 단계 영향

Stage 4의 `/rhwp open`과 `/rhwp edit`는 Studio 직접 진입, `/rhwp pdf`는 Slack PDF 열람 요청으로 처리한다. Stage 5 카드의 버튼 이름은 “문서 열기”·“PDF로 보기”이며 업로드·공유 완료된 PDF 링크만 제공한다. 준비/실패는 편집 진입을 막지 않는다. 첫 페이지 이미지·전체 PNG·ZIP 요구는 후속 task에 유지하며 썸네일 준비 시 PDF도 함께 생성한다. 저장한 편집본의 PDF는 해당 revision으로 재생성한다.

### 승인 범위

이번 승인에 해당하는 Stage 3.1 구현·검증을 완료했다. Stage 4 실제 Slack 명령·권한 연결은 별도 후속 단계다. 원격 push·PR·Slack 게시·배포는 수행하지 않았다.
