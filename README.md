# rhwp-slack

Slack에서 HWP/HWPX를 편집하고 `/rhwp` 명령으로 PDF와 PNG를 만들기 위한 비공개 프로젝트입니다.

## 현재 구현 — Stage 4

- **문서 열기**: PDF 중간 화면 없이 자체 호스팅 rhwp-studio 편집기로 바로 진입합니다. 기존 `/viewer/` 주소도 `/editor/`로 이동합니다.
- 편집기는 화면 전체를 사용합니다. 별도 상단 메뉴·보기/편집 전환·PDF.js 화면을 제거했고 Studio 메뉴·툴바는 유지합니다. 파일명과 미저장 표시(`*`)는 브라우저 탭 제목, 변경 상태는 접근성 안내로 제공합니다. 로딩·오류 안내는 필요할 때만 표시합니다.
- **서버 PDF 변환**: HWP/HWPX를 실제 PDF로 만드는 기능을 유지합니다. 원본 PDF는 미저장 편집에 따라 바뀌지 않습니다.
- 이전 문서 복구·자동 저장·최근 문서·영속 이력을 비활성화합니다. 테스트 파일 선택은 개발 빌드의 `?devtools=1`에서만 표시하며 문서를 열면 닫힙니다.

### Slack 연결 규칙 (연동 예정)

| 버튼 | 동작 |
| --- | --- |
| 문서 열기 | 원본을 rhwp-studio 편집으로 직접 열기 |
| PDF로 보기 | 생성·업로드·공유가 완료된 Slack PDF 파일의 미리보기 열기 |
| 첫 페이지 이미지 | 첫 페이지 PNG 제공 (후속 task) |

`/rhwp open`과 `/rhwp edit`는 Studio, `/rhwp pdf`는 Slack PDF 미리보기로 연결합니다. PDF 준비 중이나 실패 시에는 상태를 안내하고, 완료 후에만 PDF 링크를 제공합니다. PDF 준비 여부가 편집 진입을 막지 않도록 합니다. 썸네일 도입 시 PDF도 함께 미리 준비합니다. Slack 기본 미리보기가 링크 클릭으로 열리는 동작은 실제 웹·데스크톱에서 검증해야 합니다.

**Stage 4의 Slack 수신 서버를 구현했습니다.** `/rhwp open`·`edit`·`pdf`·`help`, 메시지의 다중 파일 선택, 서명·채널 참여·공유 권한 검사, 인증 다운로드와 임시 보관을 처리합니다. 설치 설정은 [Slack 개발 서버 문서](docs/development.md)를 따릅니다.

현재 명령은 원본 준비까지 처리하며 Slack 내부 편집·PDF 미리보기 링크는 아직 제공하지 않습니다. Work Objects·PDF 공유·편집본 새 파일 저장은 **Stage 5**입니다. 실제 workspace 설치와 웹·데스크톱 동작은 미검증이며 썸네일·전체/지정 PNG·ZIP은 후속 task입니다.

## 로컬 실행

Node **24.21.0** / npm **11.19.0** 및 Git이 필요합니다.

```sh
nvm install
nvm use
npm ci
npm exec playwright install chromium
npm run dev
```

[편집기 개발 화면](http://127.0.0.1:4173/editor/?devtools=1)에서 테스트 문서를 선택하세요. 파일은 브라우저의 Studio로 직접 전달되며 PDF 변환을 기다리지 않습니다. [일반 편집 화면](http://127.0.0.1:4173/editor/)에는 테스트 도구가 없습니다. [중첩 iframe 검사](http://127.0.0.1:4173/sandbox)는 `sandbox="allow-scripts allow-same-origin"`을 사용합니다.

서버는 127.0.0.1에만 바인딩하며 외부 배포용 인증 서버가 아닙니다. PDF 변환 테스트는 개발 전용 `/api/dev/documents` API를 사용합니다. 이 API에 보낸 원본/PDF는 메모리에 최대 15분 보관하고 만료 후 1분 이내 정리합니다. 프로세스를 종료하면 세션도 사라집니다. 개발용 ticket은 Slack 인증을 대신하지 않습니다.

최초 빌드는 고정 upstream commit을 가져와 archive SHA-256을 확인한 후 Studio 의존성을 별도 lockfile로 설치합니다. 로컬 rhwp checkout이 있으면 `RHWP_SOURCE_REPO=/absolute/path/to/rhwp npm run dev`로 같은 commit을 추출할 수 있습니다. 수정 중인 작업 트리는 사용하지 않습니다. 캐시는 `.cache/`, 배포 자산은 `dist/studio/`에 생성합니다. 소스 수정 후 다시 빌드하세요.

## 검증

```sh
npm ci
npm run prepare:studio
npm run typecheck
npm test
npm run test:slack
npm run test:security
npm run build
npm exec playwright install chromium
npm run test:viewer
git diff --check
```

Linux 브라우저 의존성은 `npm exec playwright install --with-deps chromium`으로 설치합니다. 테스트는 새 서버를 띄우므로 기존 개발 서버를 먼저 종료하세요.

실제 HWP/HWPX→서버 PDF 변환 및 스냅샷 유지, 기존 주소→동일 원본 Studio 직접 열기, 400px/669px 전체 높이 편집 화면, 기본/production 테스트 도구 부재, ticket 만료·동시성·Origin·변환 deadline, SDK·Studio 편집과 export 왕복, 키보드·서식·표, undo/redo, 기존 복구본 격리, 설정 재활성화·시간 경과·재열기, iframe 및 입력 한도를 검사합니다. 합성 문서만 사용하며 스크린샷은 `test-results/`에 생성합니다.

## 알려진 한계

- 실제 Slack 웹·데스크톱 embeds와 클립보드, OS 인쇄·다운로드는 미검증입니다. SDK는 opaque origin을 거절하므로 Slack의 `allow-same-origin` 설정이 필요합니다.
- 편집 내용은 이 창의 메모리에만 존재합니다. 새로고침하거나 창을 닫으면 없어집니다. Slack 저장은 아직 연결하지 않았으며 export만으로 저장 완료 상태를 만들지 않습니다.
- 입력은 20 MiB, 파싱 후 200페이지로 제한합니다. 편집 SDK 요청 시간 제한 60초는 WASM의 강제 종료나 메모리 상한을 보장하지 않습니다. 서버 PDF 변환은 별도 파서와 Chromium 프로세스에 60초 deadline을 적용하고 종료합니다. 출력은 50 MiB, 동시 변환은 1개, 문서 보관 총량은 200 MiB입니다. Studio는 이전 Stage 1의 전용 worker와 실행 구조가 다릅니다.
- Studio 0.8.6에서 혼합 서식을 전체 선택해 굵게를 변경한 뒤 취소하면 이전 굵기·문단/표 배치가 달라지는 사례가 있습니다. 해당 기대값을 유지하는 known-failure 테스트로 추적합니다.
- 모든 Studio 기능과 원본 한컴 출력 일치를 보장하지 않습니다. HWP3·암호화 파일은 지원 범위 밖입니다.
- 엔진 0.8.6의 HWPX 그림 전용 문단 누락 및 HWP/HWPX 이미지 설명 위치 차이는 [Stage 1 보고서](mydocs/working/task_m010_1_stage1.md)에 남아 있습니다. `node scripts/create-fixtures.mjs --image-only`로 SVG 진단을 재현합니다.
- WASM은 약 10 MB이며 배포 폰트 전체는 약 22 MiB입니다. Studio는 필요한 로컬 폰트를 로드합니다. 외부 CDN 폰트와 오프라인 service worker는 사용하지 않습니다. 성능 SLA는 아직 없습니다.

## 구조

- `src/editor/`: 전체 화면의 공식 Studio SDK 호스트, 로딩·오류·접근성 상태.
- `src/conversion/`: 고정 print SVG → Chromium PDF, 부모 프로세스의 수명 제어.
- `src/server/`: Slack 명령 수신·권한·다운로드·비동기 준비. `dev-documents.mjs`는 독립된 로컬 개발 API.
- `studio/`: upstream 고정 정보, Slack 전용 빌드 정책, 비영속 저장소 adapter.
- `src/shared/`: 입력·페이지 계약.
- `scripts/`: 고정 소스 준비·빌드, fixture 생성, 로컬 서버.
- `tests/`: 합성 fixture와 단위·브라우저 검증.
- [의존성과 출처](docs/dependencies.md)
- [구현계획서](mydocs/plans/task_m010_1_impl.md)

문서 준비 명령: `/rhwp open`, `/rhwp edit`, `/rhwp help`, `/rhwp pdf`. 후속 명령: `/rhwp thumbnail`, `/rhwp png`, `/rhwp png --page N`. 사용자 페이지 번호는 1부터 시작합니다.
