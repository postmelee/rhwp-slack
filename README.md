# rhwp-slack

Slack에 올린 HWP/HWPX를 PDF·페이지 이미지로 확인하고, rhwp-studio에서 편집한 문서를 같은 스레드에 저장하는 봇입니다.

**현재 한 워크스페이스에서 시험 운영 중입니다.** 외부 워크스페이스용 Add to Slack 설치형 베타는 [#16](https://github.com/postmelee/rhwp-slack/issues/16)에서 준비 중이며, 아직 설치 링크를 제공하지 않습니다. Marketplace에도 제출하지 않았습니다.

## 사용과 설치

| 사용 방식 | 미리보기 | 편집 | 준비 상태 |
|---|---|---|---|
| 현재 내부 운영 | Slack PDF·PNG 갤러리 | Slack 내부 rhwp-studio | 시험 운영 중 |
| 외부 설치형 베타 | Slack PDF·PNG 갤러리 | 인증 후 브라우저 rhwp-studio | OAuth·워크스페이스 격리 구현 예정 |
| 조직 자체 호스팅 | 조직 Slack의 PDF·PNG | 조직 소유 Slack 앱의 내부 편집 | 안내 초안, 새 조직에서 재현 검증 필요 |

- [설치 방식 선택](docs/installation.md)
- [조직용 Cloud Run + Pages 자체 호스팅](docs/self-hosting.md)
- [Marketplace 준비와 외부 편집 지원 조건](docs/marketplace.md)

일반 사용자는 하나의 rhwp 배포 앱을 Add to Slack으로 설치하는 방향입니다. Manifest로 조직별 앱을 만드는 절차는 자체 호스팅용입니다. 외부 배포 앱의 Slack 내부 편집은 Work Objects embeds 초대 승인이 필요합니다. 베타에서는 브라우저 편집 경로를 제공하는 방향으로 준비합니다. 현재 비공개 저장소는 초대받은 사람만 읽을 수 있으며, 소스/이미지 배포 방식과 라이선스는 공개 전에 확정합니다.

## 무엇을 할 수 있나요?

1. 앱이 참여한 활성 채널에 `.hwp` 또는 `.hwpx`를 올립니다.
2. 봇이 **원본 메시지 스레드**에 미리보기 댓글을 만듭니다.
3. **PDF로 보기**로 Slack 기본 PDF 뷰어를 열거나, 첫 3페이지 PNG를 이미지 갤러리에서 확인합니다.
4. **추가 페이지 이미지 보기 (최대 10페이지)**로 같은 댓글에 이미지를 추가합니다.
5. 편집용 카드에서 rhwp-studio를 열고 **편집본을 Slack에 저장**하면, 같은 스레드에 수정본 카드가 추가됩니다.

PDF와 PNG는 각각 준비되는 대로 같은 댓글에 갱신됩니다. 수정본도 다시 열어 편집할 수 있습니다. 원본 메시지의 이진 첨부를 교체하는 방식은 아니며, 이미지 배치·접힘 상태는 Slack이 결정합니다.

### 채널별 동작 설정

지정 관리자가 App Home 또는 `/rhwp settings`에서 채널별로 선택합니다.

- **자동 감지:** HWP/HWPX 업로드를 감지합니다.
- **멘션 요청:** 파일이 있는 메시지/스레드에서 `@rhwp`로 요청합니다.
- **사용 안 함:** 해당 채널에서 처리하지 않습니다.

파일과 멘션을 함께 보내도 댓글은 하나입니다. 관찰한 파일을 찾을 수 없으면 원본 메시지 메뉴의 **한글 문서 열기**를 사용합니다. 일반 채널 대화 내역 읽기 권한은 사용하지 않습니다. 설정과 승인된 `reactions:write` 권한이 있으면 ⏳ 처리 중·✅ 완료·⚠️ 실패를 표시합니다.

### 명령과 편집

| 조작 | 동작 |
|---|---|
| `/rhwp open`, `/rhwp edit` | 문서 편집 |
| `/rhwp pdf` | PDF 준비 및 Slack PDF 미리보기 |
| `/rhwp settings` | 관리자용 채널 설정 |
| `/rhwp help` | 사용 안내 |
| 메시지 메뉴 **한글 문서 열기** | 첨부 문서 선택·편집 |

첫 페이지 이미지 단독 명령, 전체/지정 페이지 PNG·ZIP은 [후속 이슈 #6](https://github.com/postmelee/rhwp-slack/issues/6)입니다. 현재의 기본 3페이지·최대 10페이지 갤러리와 구분합니다.

Studio의 메뉴·툴바·undo/redo를 사용합니다. 이전 문서 복구·자동 저장·최근 문서·영속 문서 이력은 비활성화했습니다. **창을 닫거나 새로고침하면 미저장 편집은 사라집니다.** Slack 저장이 성공한 편집본만 다시 열 수 있습니다.

## 파일은 어디에서 처리하나요?

- 원본·편집본·PDF·PNG는 **Slack에 저장**합니다.
- 편집기 프로그램은 정적 호스팅에서 전달되며, **편집은 사용자 브라우저에서 실행**합니다.
- 자동 변환과 Slack 열기/저장 연동에서는 **Cloud Run이 문서를 임시로 내려받아 처리**합니다.
- Cloud Run 구성의 Firestore에는 문서/스레드 연결·채널 설정과 만료되는 세션/작업 기록을 보관합니다. 문서 bytes는 DB에 저장하지 않습니다. 로컬 단일 서버는 SQLite를 사용합니다.
- Pages에는 공개 프로그램만 배포합니다. 토큰·세션·원본 문서·PDF·PNG를 Pages에 올리지 않습니다.

따라서 문서가 사용자 기기 밖으로 전혀 나가지 않는 서비스는 아닙니다. 조직 자체 호스팅은 조직이 소유한 Slack·GCP·Cloudflare 계정에서 이 구성을 운영하는 방식입니다. [인증·저장 구조](docs/architecture.md)

## 로컬 개발

Node **24.21.0** / npm **11.19.0** 및 Git이 필요합니다.

```sh
nvm install
nvm use
npm ci
npm exec playwright install chromium
npm run dev
```

[개발 편집기](http://127.0.0.1:4173/editor/?devtools=1)에서 테스트 문서를 선택합니다. 이 서버는 `127.0.0.1`에 바인딩하는 개발용이며, Slack 인증 서버를 대신하지 않습니다. 일반 `/editor/`에는 파일 선택 도구가 없습니다.

고정 upstream commit과 archive SHA-256을 확인해 Studio를 빌드합니다. 로컬 rhwp checkout이 있으면 `RHWP_SOURCE_REPO=/absolute/path/to/rhwp npm run dev`로 해당 commit을 추출할 수 있습니다. 캐시는 `.cache/`, 프로그램은 `dist/`에 생성합니다. 엔진 버전과 출처는 [의존성 문서](docs/dependencies.md)를 따릅니다.

### Slack 앱과 테스트 문서

Slack 앱 생성, `.env` 설정, HTTPS 연결, Linux 컨테이너 실행은 [개발 서버 안내](docs/development.md)를 따릅니다. 비밀값과 사용자 문서는 Git에 넣지 않습니다.

```sh
node scripts/create-preview-fixture.mjs
```

생성된 `.cache/test-documents/rhwp-12페이지-테스트.hwp` 또는 `.hwpx`를 테스트 채널에 올려 미리보기·페이지 추가·편집·같은 스레드 저장을 확인할 수 있습니다.

### 검증

```sh
npm ci
npm exec playwright install chromium
npm run check
git diff --check
```

Linux에서는 `npm exec playwright install --with-deps chromium`으로 브라우저 의존성을 설치합니다. 브라우저 테스트가 사용하는 포트의 개발 서버는 먼저 종료합니다. 로컬 자동 테스트 통과와 실제 Slack 웹/데스크톱 검증은 구분합니다.

## 지원 범위와 한계

- 입력 파일은 최대 20 MiB, 파싱 후 최대 200페이지입니다. 변환 시간·동시성·재시도 상한은 [Cloud Run 운영 문서](docs/cloud-run.md)를 따릅니다.
- HWP3·암호화 파일은 지원 범위 밖입니다. 모든 Studio 기능과 한컴 출력의 동일성을 보장하지 않습니다.
- 고정 엔진 0.8.6의 혼합 서식 undo 및 일부 HWPX 그림/설명 배치 문제는 [의존성·검증 기록](docs/dependencies.md)에 남아 있습니다.
- 앱과 사용자가 접근 가능한 허용 채널의 문서만 처리합니다. Slack Connect/조직 간 공유와 Enterprise Grid 조직 전체 설치를 지원한다고 보장하지 않습니다.
- 현재 외부 워크스페이스 OAuth 설치는 미구현입니다. 조직의 새 환경에서 자체 호스팅을 재현하는 검증도 남아 있습니다.
- 무료 할당량·크레딧은 무과금 보장이 아닙니다. Pages로 프로그램을 옮겨도 Cloud Run 대기·API·변환 및 DB/큐/전송 비용은 남습니다.

## 개발·운영 문서

- [Slack 개발 서버·컨테이너](docs/development.md)
- [인증·파일 처리 구조](docs/architecture.md)
- [Cloud Run 설정·비용·복구](docs/cloud-run.md)
- [엔진·폰트·라이선스 고지와 갱신](docs/dependencies.md)
- [외부 설치/Marketplace 작업 #4](https://github.com/postmelee/rhwp-slack/issues/4)

`src/editor/`는 Studio 호스트, `src/conversion/`은 PDF/PNG 변환, `src/server/`는 Slack·권한·저장·작업 처리, `studio/`는 고정 upstream과 빌드 정책입니다. 봇과 편집 카드에는 동일한 [rhwp 로고](slack/rhwp-logo.png)를 사용합니다.
