# rhwp-slack

Slack에서 HWP/HWPX를 편집하고 `/rhwp` 명령으로 PDF와 PNG를 만들기 위한 비공개 프로젝트입니다.

## 현재 구현 — Stage 2

- 자체 호스팅 **rhwp-studio 0.8.6**을 공식 `@rhwp/editor` SDK로 임베드합니다. Studio의 메뉴·툴바·편집 화면을 그대로 사용합니다.
- 글자·서식·표 편집과 undo/redo를 유지합니다. 이전 문서 복구, 자동 저장, 최근 문서, 영속 문서 이력은 Slack 전용 빌드에서 비활성화합니다.
- `chrome=embed`를 강제하고 문서 URL 자동 열기와 로컬 열기·저장·인쇄 메뉴를 비활성화합니다. 문서 생명주기는 호스트가 관리합니다.
- 개발 화면은 선택한 문서를 브라우저에서 처리합니다. 원본을 서버로 업로드하지 않습니다. production 화면은 인증 연결 전까지 문서 입력을 제공하지 않습니다.

Slack 명령·권한 검사는 **Stage 3**, Work Objects·편집본 Slack 저장은 **Stage 4**입니다. PDF·썸네일·전체/지정 PNG·ZIP은 후속 task입니다. 현재 실행 가능한 Slack 명령은 없습니다.

## 로컬 실행

Node **24.21.0** / npm **11.19.0** 및 Git이 필요합니다.

```sh
nvm install
nvm use
npm ci
npm run dev
```

[편집기](http://127.0.0.1:4173/viewer/)에서 테스트 문서를 선택하세요. [중첩 iframe 검사](http://127.0.0.1:4173/sandbox)는 `sandbox="allow-scripts allow-same-origin"`을 사용합니다. 서버는 127.0.0.1에만 바인딩하며 외부 배포용 인증 서버가 아닙니다.

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

실제 SDK·Studio에서 HWP/HWPX 편집과 export 왕복, 키보드·서식·표, undo/redo, 기존 복구본 격리, 설정 재활성화·시간 경과·재열기, iframe 및 입력 한도를 검사합니다. 합성 문서만 사용하며 스크린샷은 `test-results/`에 생성합니다.

## 알려진 한계

- 실제 Slack 웹·데스크톱 embeds와 클립보드, OS 인쇄·다운로드는 미검증입니다. SDK는 opaque origin을 거절하므로 Slack의 `allow-same-origin` 설정이 필요합니다.
- 편집 내용은 이 창의 메모리에만 존재합니다. 새로고침하거나 창을 닫으면 없어집니다. Slack 저장은 아직 연결하지 않았으며 export만으로 저장 완료 상태를 만들지 않습니다.
- 입력은 20 MiB, 파싱 후 200페이지로 제한합니다. SDK 요청 시간 제한 60초는 WASM의 강제 종료나 메모리 상한을 보장하지 않습니다. Studio는 이전 Stage 1의 전용 worker와 실행 구조가 다릅니다.
- Studio 0.8.6에서 혼합 서식을 전체 선택해 굵게를 변경한 뒤 취소하면 이전 굵기·문단/표 배치가 달라지는 사례가 있습니다. 해당 기대값을 유지하는 known-failure 테스트로 추적합니다.
- 모든 Studio 기능과 원본 한컴 출력 일치를 보장하지 않습니다. HWP3·암호화 파일은 지원 범위 밖입니다.
- 엔진 0.8.6의 HWPX 그림 전용 문단 누락 및 HWP/HWPX 이미지 설명 위치 차이는 [Stage 1 보고서](mydocs/working/task_m010_1_stage1.md)에 남아 있습니다. `node scripts/create-fixtures.mjs --image-only`로 SVG 진단을 재현합니다.
- WASM은 약 10 MB이며 배포 폰트 전체는 약 22 MiB입니다. Studio는 필요한 로컬 폰트를 로드합니다. 외부 CDN 폰트와 오프라인 service worker는 사용하지 않습니다. 성능 SLA는 아직 없습니다.

## 구조

- `src/viewer/`: 파일 연결·상태 안내와 공식 Studio SDK 호스트.
- `studio/`: upstream 고정 정보, Slack 전용 빌드 정책, 비영속 저장소 adapter.
- `src/shared/`: 입력·페이지 계약.
- `scripts/`: 고정 소스 준비·빌드, fixture 생성, 로컬 서버.
- `tests/`: 합성 fixture와 단위·브라우저 검증.
- [의존성과 출처](docs/dependencies.md)
- [구현계획서](mydocs/plans/task_m010_1_impl.md)

예정 명령: `/rhwp open`, `/rhwp help`, `/rhwp pdf`, `/rhwp thumbnail`, `/rhwp png`, `/rhwp png --page N`. 사용자 페이지 번호는 1부터 시작합니다.
