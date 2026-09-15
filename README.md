# rhwp-slack

Slack에서 HWP/HWPX를 편집하고 `/rhwp` 명령으로 PDF와 PNG를 만들기 위한 비공개 프로젝트입니다.

## 현재 구현 — Stage 3

- **문서 보기**: HWP/HWPX를 실제 PDF로 변환하고 PDF.js로 페이지를 표시합니다. PDF 받기·이전/다음 페이지를 제공합니다.
- **문서 편집**: PDF의 버튼으로 같은 원본을 별도 rhwp-studio 화면에서 엽니다. 보기/편집 모드 토글을 만들지 않습니다.
- 편집 상단은 한 줄 파일명·변경 상태이며 긴 파일명은 말줄임합니다. 파일 선택은 접힌 개발 도구에만 남습니다. Studio 메뉴·툴바·편집 UI는 그대로 유지합니다.
- 이전 문서 복구·자동 저장·최근 문서·영속 이력을 비활성화합니다. 저장하지 않은 편집은 PDF에 반영되지 않습니다.

Slack 명령·권한은 **Stage 4**, Work Objects·편집본 새 파일 저장·해당 revision의 PDF 재생성은 **Stage 5**입니다. Slack 연동 시에는 PDF 첨부의 Slack 자체 미리보기를 기본 열람 경로로 연결합니다. 아직 Slack 저장 버튼은 활성화하지 않습니다. 썸네일·전체/지정 PNG·ZIP은 후속 task이며 현재 실행 가능한 Slack 명령은 없습니다.

## 로컬 실행

Node **24.21.0** / npm **11.19.0** 및 Git이 필요합니다.

```sh
nvm install
nvm use
npm ci
npm exec playwright install chromium
npm run dev
```

[PDF 보기](http://127.0.0.1:4173/viewer/)에서 테스트 문서를 선택하세요. “문서 편집”으로 같은 원본을 Studio에서 엽니다. [편집기 단독 개발 화면](http://127.0.0.1:4173/editor/)도 사용할 수 있습니다. [중첩 iframe 검사](http://127.0.0.1:4173/sandbox)는 `sandbox="allow-scripts allow-same-origin"`을 사용합니다. 서버는 127.0.0.1에만 바인딩하며 외부 배포용 인증 서버가 아닙니다. PDF 보기에서 고른 문서는 이 로컬 서버에 전송됩니다. 원본/PDF는 메모리에 최대 15분 보관하고 만료 후 1분 이내 정리합니다. 프로세스를 종료하면 세션도 사라집니다. 개발용 ticket은 Slack 인증을 대신하지 않습니다.

최초 빌드는 고정 upstream commit을 가져와 archive SHA-256을 확인한 후 Studio 의존성을 별도 lockfile로 설치합니다. 로컬 rhwp checkout이 있으면 `RHWP_SOURCE_REPO=/absolute/path/to/rhwp npm run dev`로 같은 commit을 추출할 수 있습니다. 수정 중인 작업 트리는 사용하지 않습니다. 캐시는 `.cache/`, 배포 자산은 `dist/studio/`에 생성합니다. 소스 수정 후 다시 빌드하세요.

## 검증

```sh
npm ci
npm run prepare:studio
npm run typecheck
npm test
npm run build
npm exec playwright install chromium
npm run test:viewer
git diff --check
```

Linux 브라우저 의존성은 `npm exec playwright install --with-deps chromium`으로 설치합니다. 테스트는 새 서버를 띄우므로 기존 개발 서버를 먼저 종료하세요.

실제 HWP/HWPX→PDF→별도 편집, PDF 페이지 이동과 스냅샷 유지, 400px/669px 상단, ticket 만료·동시성·Origin·변환 deadline, SDK·Studio에서 HWP/HWPX 편집과 export 왕복, 키보드·서식·표, undo/redo, 기존 복구본 격리, 설정 재활성화·시간 경과·재열기, iframe 및 입력 한도를 검사합니다. 합성 문서만 사용하며 스크린샷은 `test-results/`에 생성합니다.

## 알려진 한계

- 실제 Slack 웹·데스크톱 embeds와 클립보드, OS 인쇄·다운로드는 미검증입니다. SDK는 opaque origin을 거절하므로 Slack의 `allow-same-origin` 설정이 필요합니다.
- 편집 내용은 이 창의 메모리에만 존재합니다. 새로고침하거나 창을 닫으면 없어집니다. Slack 저장은 아직 연결하지 않았으며 export만으로 저장 완료 상태를 만들지 않습니다.
- 입력은 20 MiB, 파싱 후 200페이지로 제한합니다. 편집 SDK 요청 시간 제한 60초는 WASM의 강제 종료나 메모리 상한을 보장하지 않습니다. 서버 PDF 변환은 별도 파서와 Chromium 프로세스에 60초 deadline을 적용하고 종료합니다. 출력은 50 MiB, 동시 변환은 1개, 문서 보관 총량은 200 MiB입니다. Studio는 이전 Stage 1의 전용 worker와 실행 구조가 다릅니다.
- Studio 0.8.6에서 혼합 서식을 전체 선택해 굵게를 변경한 뒤 취소하면 이전 굵기·문단/표 배치가 달라지는 사례가 있습니다. 해당 기대값을 유지하는 known-failure 테스트로 추적합니다.
- 로컬 PDF.js 화면은 페이지 이동·맞춤 너비 표시를 제공합니다. 전체 텍스트 선택·검색·주석·OS 인쇄 UI는 아직 구현하지 않았습니다. PDF 받기로 다른 PDF 프로그램에서 열 수 있습니다.
- 모든 Studio 기능과 원본 한컴 출력 일치를 보장하지 않습니다. HWP3·암호화 파일은 지원 범위 밖입니다.
- 엔진 0.8.6의 HWPX 그림 전용 문단 누락 및 HWP/HWPX 이미지 설명 위치 차이는 [Stage 1 보고서](mydocs/working/task_m010_1_stage1.md)에 남아 있습니다. `node scripts/create-fixtures.mjs --image-only`로 SVG 진단을 재현합니다.
- WASM은 약 10 MB이며 배포 폰트 전체는 약 22 MiB입니다. Studio는 필요한 로컬 폰트를 로드합니다. 외부 CDN 폰트와 오프라인 service worker는 사용하지 않습니다. 성능 SLA는 아직 없습니다.

## 구조

- `src/viewer/`: PDF.js 읽기 화면.
- `src/editor/`: 한 줄 상태 영역과 공식 Studio SDK 호스트.
- `src/conversion/`: 고정 print SVG → Chromium PDF, 부모 프로세스의 수명 제어.
- `src/server/dev-documents.mjs`: 로컬 개발 전용 문서 ticket·TTL.
- `studio/`: upstream 고정 정보, Slack 전용 빌드 정책, 비영속 저장소 adapter.
- `src/shared/`: 입력·페이지 계약.
- `scripts/`: 고정 소스 준비·빌드, fixture 생성, 로컬 서버.
- `tests/`: 합성 fixture와 단위·브라우저 검증.
- [의존성과 출처](docs/dependencies.md)
- [구현계획서](mydocs/plans/task_m010_1_impl.md)

예정 명령: `/rhwp open`, `/rhwp edit`, `/rhwp help`, `/rhwp pdf`, `/rhwp thumbnail`, `/rhwp png`, `/rhwp png --page N`. 사용자 페이지 번호는 1부터 시작합니다.
