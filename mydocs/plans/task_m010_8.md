# 편집기 로딩 최적화·Cloudflare Pages 비교 수행계획서

GitHub Issue: [#8](https://github.com/postmelee/rhwp-slack/issues/8)
마일스톤: M010

## 목적

현재 워크스페이스 동작과 서버 사양을 유지하면서 Slack 편집기가 실제 사용 가능해질 때까지의 대기와 프로그램 전송량을 줄인다. 기존 호스팅 개선 B와 동일 프로그램의 Pages 분리 C를 각각 기준 A와 비교하고, 운영 전환을 증거로 판단한다.

## 배경

#2/PR #9와 #10/PR #11이 병합됐다. 기준 A는 merge cef52f142c08502b48336ab6f33802bac29ccbd3, 실행 소스 93943c721c78f9a78de0fe1477e8d1a699d3c982, ingress 00012-6hv/worker 00008-6t7이다. 이미지와 선행 수용은 [#10 보고서](../report/task_m010_10_report.md)에 있다. worker 브라우저·WASM 재사용과 브라우저 편집기 프로그램 로딩은 다른 경로다.

`editor-routes.ts`는 정적 자산에도 no-store를 적용하며 document/source에서 각각 ensureSource를 호출한다. `editor/main.ts`는 티켓 교환→Studio 준비→메타데이터→원본을 순차 처리한다. 이 코드 관찰과 실제 병목 측정을 구분한다.

## 범위

### 포함

- 기준 A의 첫/반복 접속·동일/다른 문서, 코드/WASM/글꼴 실제 전송량과 편집 준비 계측.
- 버전으로 고정한 공개 정적 자산 캐시·압축, shell 재검증, 이전 URL 호환.
- 인증 후 Studio 준비와 원본 조회 병렬화, 불필요한 중복 원본 다운로드 제거. 요청별 권한/원본 변경 검사는 유지.
- 동일 B 정적 프로그램의 별도 무료 Pages 테스트 배포, 정확한 Origin/CORS/CSP·iframe 통신·API 연결 설정과 회귀 검증.
- A/B/C 최소 3회 비교, Linux CI·운영 및 Slack 웹/데스크톱 수용, 복구 가능한 운영 결정·최종 PR.

### 제외

- 서버 사양·동시성·최소 인스턴스·예산 변경, 유료 CDN/Functions 필수화.
- 원본/편집 내용/인증 응답의 공개 또는 영구 캐시, 사용자 간 상태 재사용.
- #10 변환 renderer·엔진 0.8.6 교체, 장문 PDF 조판 최적화.
- 새 Slack 권한·Marketplace/OAuth·다중 워크스페이스, GitHub Pages 구현.

## 설계 방향

공개 캐시에는 JS/WASM/글꼴/CSS 등 프로그램 파일만 둔다. API·ticket·session·문서·오류 응답은 no-store를 유지한다. 배포마다 자산 버전을 바꾸며 구 프로그램이 새 파일과 섞이지 않게 한다. 소스 응답만 원본 해시를 확인하고 metadata는 권한 확인된 이름/형식만 전달한다. Studio와 다운로드는 인증 후 병렬 시작하고 전체 취소·늦은 결과 폐기를 유지한다.

C는 host와 Studio를 같은 정적 origin에서 제공하고 API만 Cloud Run의 정확한 origin으로 요청하는 구성을 우선한다. API origin을 URL 입력에서 임의로 받지 않고 빌드/서버 설정으로 고정한다. Slack 기존 편집 경로와 운영 URL은 비교 수용 전 유지한다. Pages가 효과가 없거나 Slack embed 조건을 충족하지 않으면 B를 유지하고 결과를 기록한다.

## 문서 위치 판단

| 파일 | 분류 | 대상 독자 | 선택 위치 | 대안 위치 | 선택 이유 |
|---|---|---|---|---|---|
| docs/architecture.md·security.md·cloud-run.md·dependencies.md | 제품/운영 계약 | 운영자·기여자 | 기존 docs | mydocs/manual | 기존 공식 루트 확장 |
| docs/static-hosting.md (필요 시) | 정적 배포/복구 계약 | 운영자 | docs | mydocs/tech | 재사용 가능한 배포 절차 |
| task_m010_8 문서 | 계획·측정·결과 | 내부 작업자 | mydocs/plans·working·report | docs | 이슈별 증적 |
| 원시 측정/네트워크/문서 | 비공개 검증 자료 | 작업자 | ignored .cache/validation | Git | 원본·비밀 URL 비공개 |

## 예상 변경 파일

src/editor/main.ts·startup.ts·설정/계측 helper, src/server/editor-routes.ts·config.ts·cloud/application.ts, scripts/build-host.mjs·build-studio.mjs·빌드/측정/Pages 지원 도구, studio/vite.config.ts·vite.config.ts, tests/security·slack·viewer, docs, mydocs.

## 잠정 단계

1. 기준 A 계측·현재 배포/캐시/전송량 확인.
2. 버전 자산·캐시/압축·갱신/rollback 회귀.
3. 원본 중복 제거·인증 후 병렬 초기화·B 전후 검증.
4. Pages C 정적 배포와 Origin/iframe/API 보안 검증.
5. A/B/C 비교·Slack 수용·비용/운영 판단·최종 보고와 PR.

## 검증 계획

- 각 조건 최소 3회, 중앙값·범위·성공률; 캐시 cold/warm과 서버 cold/warm 구분. 실제 전송 bytes와 빌드 파일 크기 구분.
- typecheck·unit·Slack·security·실제 UI/변환·Linux container 검증. 대기 순서·취소·권한 회수·만료/reused ticket·잘못된 Origin·공개 캐시 제외·구버전 갱신을 확인.
- 운영 합성 HWP/HWPX·장문·수정본 같은 스레드, Slack 웹/데스크톱을 실제 확인. 못 확인한 표면은 미검증으로 남긴다.
- B/C 렌더러는 동일하며 문서 복구·최근 기록·자동 저장 비활성화를 유지한다. 단계 커밋/보고·git diff --check·clean tree 후 PR.

## 리스크

버전 경로와 CSP가 WASM/worker/폰트 경로를 깨뜨릴 수 있다. 모든 자산 재검증과 실제 Studio 로딩을 확인한다. API와 정적 origin 분리는 정확한 allowlist·무자격 CORS·인증 token no-store·iframe origin 검사로 제한한다. Pages 파일 크기 제한·계정 인증·Slack embed 허용 도메인 조건은 배포 전 확인한다. CDN은 파싱/조판 시간과 Cloud Run 최소 대기 비용을 제거하지 않는다.

## 승인 요청 사항

2026-09-20 같은 스레드에서 PR #11 리뷰·조건부 병합 후 #8 진행 순서를 제안했고 사용자가 “진행해줘”로 승인했다. 이 계획은 원래 #8 범위를 구체화하므로 해당 승인으로 구현·검증을 이어간다. 비용/권한 확대나 별도 제품 범위는 포함하지 않는다.
