# rhwp-slack

Slack 안에서 HWP/HWPX를 읽고 `/rhwp` 명령으로 PDF와 PNG를 만들기 위한 비공개 프로젝트입니다.

## 현재 구현 — Stage 1

- 실제 `@rhwp/core@0.8.6` WASM으로 HWP5/HWPX를 읽고 페이지를 표시합니다.
- 1부터 시작하는 페이지 이동, 50~200% 확대, 로딩·오류·닫기를 지원합니다.
- 문서는 worker에서 처리하며 작업당 30초가 지나면 worker를 종료합니다. 입력은 20 MiB, 파싱 결과는 200페이지로 제한합니다.
- 개발 뷰어는 선택한 파일을 브라우저에서 처리합니다. 원본 파일을 서버로 업로드하지 않습니다.
- SVG의 실행 코드·외부 리소스를 제거하고 Noto 글꼴을 앱 자산으로 제공합니다.

Slack 앱 연결과 접근 권한 확인은 **Stage 2·3**, PDF·썸네일·전체/지정 페이지 PNG와 ZIP은 후속 task입니다. 현재 production 빌드는 안내 화면이며 문서 입력을 열어 두지 않습니다.

## 로컬 실행

Node **24.21.0**과 함께 제공되는 npm **11.19.0**을 사용합니다. nvm을 사용하는 경우:

```sh
nvm install
nvm use
npm ci
npm run dev
```

[로컬 뷰어](http://127.0.0.1:4173/viewer/)에서 문서를 선택하세요. [제한된 iframe 테스트 화면](http://127.0.0.1:4173/sandbox)은 `sandbox="allow-scripts"`를 사용합니다. 서버는 127.0.0.1에만 바인딩합니다. Slack 자격 증명은 아직 필요하지 않습니다.

`npm run dev`는 개발 빌드 후 로컬 정적 서버를 실행합니다. 소스 수정 후 다시 실행하세요. 이 서버에는 Slack 인증 API가 없으며 외부 배포용 서버가 아닙니다.

## 검증

```sh
npm ci
npm run typecheck
npm test
npm exec playwright install chromium
npm run test:viewer
git diff --check
```

Linux에서 브라우저 시스템 의존성이 없으면 `npm exec playwright install --with-deps chromium`을 사용합니다. `test:viewer`가 production·개발 빌드를 모두 갱신합니다. 테스트마다 새 로컬 서버를 실행하므로 먼저 `npm run dev`를 종료하세요.

브라우저 검증은 실제 두 페이지 HWP/HWPX, 한글·표·PNG, iframe, 페이지 입력, 확대, 문서 교체·취소, 손상 입력, 201페이지 거절, SVG 보안과 동기 worker 강제 종료를 확인합니다. 화면 증거는 `test-results/`에 생성됩니다. 테스트 문서는 이 프로젝트를 위해 작성했으며 사용자 문서를 포함하지 않습니다.

## 알려진 한계

- 실제 Slack 웹·데스크톱 앱의 Work Objects embeds는 아직 검증하지 않았습니다. 로컬 iframe 통과는 Slack 지원 완료를 뜻하지 않습니다.
- Noto 대체 글꼴과 엔진 내장 측정값은 원본 한컴 글꼴과 다를 수 있습니다. 한컴 출력과의 시각 일치를 보장하지 않습니다.
- 엔진 0.8.6에서 직접 만든 HWPX 중 **그림만 들어 있는 문단의 inline 이미지가 SVG에서 빠지는 사례**를 확인했습니다. 앱의 sanitizer 이전에도 누락됩니다. 같은 문단에 설명 글을 넣은 경우 HWP/HWPX 모두 표시됩니다. 엔진 수정이나 자동 문서 변형은 적용하지 않았습니다.
- 테스트 문서에서 그림 옆 설명 글의 세로 위치가 HWP와 HWPX 사이에 다르게 나타납니다. 원본 출력과의 추가 검증이 필요합니다.
- HWP3·암호화·손상 파일, 200페이지 초과는 지원 대상이 아닙니다. 압축 파일의 파싱 중 메모리에 대한 하드 상한은 보장하지 않습니다.
- 전체 Unicode subset을 준비하므로 첫 열기에 약 10 MiB의 WASM과 약 10 MiB의 폰트 다운로드가 필요합니다. 성능 SLA는 아직 없습니다.

이미지 누락 진단은 아래 명령으로 재현할 수 있습니다. 정상 fixture를 바꾸지 않고 임시 디렉터리에 입력과 manifest를 만듭니다. 이 명령의 JSON은 진단 결과이며 CI 통과 기준이 아닙니다.

```sh
node scripts/create-fixtures.mjs --image-only
```

## 구조와 다음 단계

- `src/viewer/`: UI, worker 연결, SVG 정책, 표시 글꼴.
- `src/shared/`: 페이지·입력 한도와 오류 계약.
- `scripts/`: 빌드 자산, 테스트 문서 생성, 로컬 서버.
- `tests/`: 독립적으로 작성한 fixture와 자동 검증.
- [의존성과 출처](docs/dependencies.md)
- [Task #1 구현계획서](mydocs/plans/task_m010_1_impl.md)

예정 명령은 `/rhwp open`, `/rhwp help`, `/rhwp pdf`, `/rhwp thumbnail`, `/rhwp png`와 `--page`입니다. 현재 실행 가능한 Slack 명령은 없습니다.
