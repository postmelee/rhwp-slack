# rhwp-slack

Slack에서 HWP/HWPX를 편집하고 `/rhwp` 명령으로 PDF와 PNG를 만들기 위한 비공개 프로젝트입니다.

## 현재 구현 — Stage 9 (워크스페이스 내 다중 채널 운영)

- **문서 열기**: Slack 카드의 문서 제목을 누르면 PDF 중간 화면 없이 자체 호스팅 rhwp-studio 편집기로 바로 진입합니다. 기존 `/viewer/` 주소도 `/editor/`로 이동합니다.
- 편집기는 화면 전체를 사용합니다. 별도 상단 메뉴·보기/편집 전환·PDF.js 화면을 제거했고 Studio 메뉴·툴바는 유지합니다. 파일명과 미저장 표시(`*`)는 브라우저 탭 제목, 변경 상태는 접근성 안내로 제공합니다. 로딩·오류 안내는 필요할 때만 표시합니다.
- **서버 PDF 변환**: HWP/HWPX를 실제 PDF로 만드는 기능을 유지합니다. 원본 PDF는 미저장 편집에 따라 바뀌지 않습니다.
- 이전 문서 복구·자동 저장·최근 문서·영속 이력을 비활성화합니다. 테스트 파일 선택은 개발 빌드의 `?devtools=1`에서만 표시하며 문서를 열면 닫힙니다.

- **자동 미리보기**: 활성 채널의 HWP/HWPX 업로드를 감지해 원본 메시지 스레드에 댓글 한 개를 만듭니다. 지정 관리자는 App Home 또는 `/rhwp settings`에서 채널별 자동 감지·멘션 요청·사용 안 함을 설정합니다. 일반 채널 대화 내역 권한은 사용하지 않습니다.
- **처리 표시**: `reactions:write` 설치 및 설정 후 원본 메시지에 ⏳ 처리 중·✅ 완료·⚠️ 실패를 표시합니다. 여러 파일의 상태를 합산하며 반응 실패가 변환을 반복시키지 않습니다.
- **재시작 복구**: 문서 카드·공유 위치·저장 영수증·채널 설정을 SQLite에 보관합니다. 원본 bytes와 편집 세션은 보관하지 않으며, 다시 열 때 권한을 확인하고 Slack에서 원본을 다시 받습니다.

봇과 편집 카드는 동일한 rhwp 로고를 사용합니다. 카드 파일명 아래에 **rhwp에서 편집 · 이 카드를 클릭하세요**를 표시하며 별도의 위쪽 편집 안내는 생략합니다. 앱 아이콘 재설정에는 원본에 투명 여백만 추가한 [정사각형 로고](slack/rhwp-logo.png)를 사용하세요.

### Slack 연결 규칙

| 조작 | 동작 |
| --- | --- |
| 문서 제목 / 사이드 패널에서 열기 | 원본을 rhwp-studio 편집으로 직접 열기 |
| PDF로 보기 | 생성·업로드·공유가 완료된 Slack PDF 파일의 미리보기 열기 |
| PNG 이미지 묶음 | 첫 3페이지를 Slack 기본 이미지 갤러리로 표시; 클릭하면 Slack 이미지 뷰어 |
| 추가 페이지 이미지 보기 (최대 10페이지) | 같은 댓글에 앞 10페이지까지 추가 |

`/rhwp open`과 `/rhwp edit`는 Studio, `/rhwp pdf`는 Slack PDF 미리보기로 연결합니다. PDF 준비 중이나 실패 시에는 상태를 안내하고, 완료 후에만 PDF 링크를 제공합니다. PDF 준비 여부가 편집 진입을 막지 않도록 합니다. 첫 3페이지 PNG와 전체 PDF를 함께 준비하고 같은 댓글에 갱신합니다. Slack이 썸네일 수·`+N`·펼침 상태를 결정하며, 메시지 내부의 가로 스크롤을 앱에서 지정하지 않습니다. **PDF로 보기**는 같은 메시지의 실제 Slack 파일 링크입니다. 웹·macOS 데스크톱의 Slack 내부 PDF 뷰어에서 확인했습니다. 브라우저로 보내는 URL 버튼을 제거했습니다.

**Slack 수신 서버와 Work Objects·편집본 저장 adapter를 구현했습니다.** `/rhwp open`·`edit`·`pdf`·`help`, 메시지의 다중 파일 선택, 서명·채널 참여·공유 권한 검사, 인증 다운로드와 임시 보관을 처리합니다. 설치 설정은 [Slack 개발 서버 문서](docs/development.md)를 따릅니다.

카드 클릭에서 일회용 ticket을 발급하고 인증된 원본을 Studio로 전달합니다. 실제 세션에는 **편집본을 Slack에 저장** 버튼을 표시하며, 열었던 카드의 스레드에 저장마다 수정본 카드 한 개를 추가합니다. 카드 제목은 해당 수정본을 다시 편집하며 PDF·페이지 PNG는 그 카드 메시지에 갱신합니다. 별도의 PDF 댓글은 추가하지 않습니다. 기존 스레드에서 만든 카드는 같은 부모 스레드를 유지합니다. 저장 중 추가 변경은 미저장 상태로 남깁니다. [인증·저장 구조](docs/architecture.md)를 참고하세요.

실제 테스트 앱 설치와 비공개 채널의 명령·업로드·웹 Studio 편집/저장, 데스크톱 Studio 열기·PDF 첨부 미리보기를 확인했습니다. Linux 컨테이너 검사도 통과했습니다. 데스크톱 직접 입력/저장은 사용자 확인을 받았으며, 실제 권한 회수 등 남은 시나리오는 [Stage 6 보고서](mydocs/working/task_m010_1_stage6.md)에 구분합니다. 전체/지정 PNG·ZIP과 첫 페이지 이미지 단독 명령은 후속 task입니다.

### 직접 테스트

```sh
node scripts/create-preview-fixture.mjs
```

`.cache/test-documents/rhwp-12페이지-테스트.hwp` 또는 `.hwpx`를 앱이 참여한 허용 채널에 올리세요. 원본 스레드의 댓글에서 **추가 페이지 이미지 보기 (최대 10페이지)**, **PDF로 보기**, 하단의 **편집용 문서 카드**를 확인할 수 있습니다. 파일과 `@rhwp`를 함께 보내도 댓글은 하나입니다. 최근 24시간 내 관찰한 같은 스레드에서는 파일 없이 멘션해도 되며, 이전 문서를 찾지 못하면 원본 메시지 메뉴의 **한글 문서 열기**를 사용하세요.

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
npm exec playwright install chromium
npm run check
git diff --check
```

Linux 브라우저 의존성은 `npm exec playwright install --with-deps chromium`으로 설치합니다. 테스트는 새 서버를 띄우므로 기존 개발 서버를 먼저 종료하세요.

실제 HWP/HWPX→서버 PDF 변환 및 스냅샷 유지, 기존 주소→동일 원본 Studio 직접 열기, 400px/669px 전체 높이 편집 화면, 기본/production 테스트 도구 부재, ticket 만료·동시성·Origin·변환 deadline, SDK·Studio 편집과 export 왕복, 키보드·서식·표, undo/redo, 기존 복구본 격리, 설정 재활성화·시간 경과·재열기, iframe 및 입력 한도를 검사합니다. 합성 문서만 사용하며 스크린샷은 `test-results/`에 생성합니다.

## Slack 앱 등록과 Linux 실행

[처음 앱을 등록하는 순서](docs/development.md#처음-slack-앱을-등록하는-순서)에 앱 생성용 JSON·설정값 위치·테스트용 HTTPS 연결을 정리했습니다. Slack 클라이언트 설치와 별도로 개발용 앱 등록이 필요합니다. `scripts/slack-manifest.mjs --bootstrap`은 URL 없이 등록할 JSON을 만들고 `--origin https://HOST`는 서버 실행 후 적용할 연결용 JSON을 만듭니다.

Dockerfile/Compose는 고정 Node 이미지, 일반 사용자·읽기 전용 파일시스템·자원 제한을 사용합니다. [컨테이너 실행·검증](docs/development.md#linux-컨테이너-실행)을 따릅니다. `npm run preflight:slack`은 설치 상태만 읽어 확인하며 실제 Slack 화면·파일 공유 검증을 대신하지 않습니다.

## 알려진 한계

- 실제 Slack 웹·데스크톱 embeds 열기는 확인했습니다. 데스크톱 직접 입력/저장은 사용자 확인을 받았습니다. 클립보드, OS 인쇄·다운로드의 전체 수용은 미완료입니다. SDK는 opaque origin을 거절하므로 Slack의 `allow-same-origin` 설정이 필요합니다.
- 편집 내용은 이 창의 메모리에만 존재합니다. 새로고침하거나 창을 닫으면 없어집니다. Slack 저장 버튼이 성공한 편집본만 서버에 공유합니다. export만으로 저장 완료 상태를 만들지 않으며, 저장 결과가 불확실하면 같은 요청으로 재확인합니다.
- 입력은 20 MiB, 파싱 후 200페이지로 제한합니다. 편집 SDK 요청 시간 제한 60초는 WASM의 강제 종료나 메모리 상한을 보장하지 않습니다. 서버 PDF 변환은 별도 파서와 Chromium 프로세스에 60초 deadline을 적용하고 종료합니다. 출력은 50 MiB, 동시 변환은 1개, 문서 보관 총량은 200 MiB입니다. Studio는 이전 Stage 1의 전용 worker와 실행 구조가 다릅니다.
- Studio 0.8.6에서 혼합 서식을 전체 선택해 굵게를 변경한 뒤 취소하면 이전 굵기·문단/표 배치가 달라지는 사례가 있습니다. 해당 기대값을 유지하는 known-failure 테스트로 추적합니다.
- 모든 Studio 기능과 원본 한컴 출력 일치를 보장하지 않습니다. HWP3·암호화 파일은 지원 범위 밖입니다.
- 엔진 0.8.6의 HWPX 그림 전용 문단 누락 및 HWP/HWPX 이미지 설명 위치 차이는 [Stage 1 보고서](mydocs/working/task_m010_1_stage1.md)에 남아 있습니다. `node scripts/create-fixtures.mjs --image-only`로 SVG 진단을 재현합니다.
- WASM은 약 10 MB이며 배포 폰트 전체는 약 22 MiB입니다. Studio는 필요한 로컬 폰트를 로드합니다. 외부 CDN 폰트와 오프라인 service worker는 사용하지 않습니다. 성능 SLA는 아직 없습니다.

## 구조

- `src/editor/`: 전체 화면의 공식 Studio SDK 호스트, 로딩·오류·접근성 상태.
- `src/conversion/`: 고정 print SVG → Chromium PDF, 부모 프로세스의 수명 제어.
- `src/server/`: Slack 명령·Work Objects·권한·세션·다운로드·새 파일 저장·PDF 공유. `dev-documents.mjs`는 독립된 로컬 개발 API.
- `studio/`: upstream 고정 정보, Slack 전용 빌드 정책, 비영속 저장소 adapter.
- `src/shared/`: 입력·페이지 계약.
- `scripts/`: 고정 소스 준비·빌드, fixture 생성, 로컬 서버.
- `tests/`: 합성 fixture와 단위·브라우저 검증.
- [의존성과 출처](docs/dependencies.md)
- [구현계획서](mydocs/plans/task_m010_1_impl.md)

문서 준비 명령: `/rhwp open`, `/rhwp edit`, `/rhwp help`, `/rhwp pdf`. 후속 명령: `/rhwp thumbnail`, `/rhwp png`, `/rhwp png --page N`. 사용자 페이지 번호는 1부터 시작합니다.
