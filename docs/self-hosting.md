# 조직용 자체 호스팅 — Cloud Run + Cloudflare Pages

**상태: 관리자용 설치 안내 초안.** 기존 운영 구성에 근거하며, 새 조직의 빈 GCP/Cloudflare 계정에서 끝까지 재현한 배포 도구는 아직 없다. 원클릭 배포를 제공하지 않는다. Pages 분리 기능은 [PR #12](https://github.com/postmelee/rhwp-slack/pull/12)의 소스를 포함한 릴리스가 필요하다. 임의로 가장 최신 엔진과 앱을 섞지 않는다.

## 준비물과 접근 조건

- 조직 소유 Slack 워크스페이스와 앱 생성/설치 승인 권한.
- 결제 계정이 연결된 조직 GCP 프로젝트, Cloudflare 계정.
- 앱 소스 또는 검증된 컨테이너 이미지와 Pages 자산에 대한 접근 권한.
- Node/npm은 저장소 `.nvmrc`와 `package.json`에 고정한 버전, Linux AMD64 컨테이너 빌드 환경.

현재 저장소는 private이며 프로젝트 전체의 공개 배포 라이선스는 아직 정하지 않았다. 조직 초대 또는 배포물 제공 조건을 먼저 정한다. upstream/폰트 고지는 [의존성 문서](dependencies.md)를 유지한다.

## 구성

| 구성 요소 | 역할 | 외부 접근 |
|---|---|---|
| 조직 Slack 앱 | 이벤트·명령 수신, PDF/PNG·편집본 게시 | 조직 워크스페이스 |
| Cloud Run ingress | Slack 서명, 인증/권한, 문서 읽기·저장 API | HTTPS 공개 진입점, 요청별 인증 |
| Cloud Run worker | 문서 변환과 Slack 업로드 | Cloud Tasks 호출 계정만 허용 |
| Firestore | 파일·스레드 연결, 채널 설정, 임시 세션/작업 기록 | 서비스 계정 |
| Cloud Tasks | 변환 작업 전달·재시도 | 서비스 계정 |
| Secret Manager | Slack bot token·signing secret | 필요한 실행 서비스 계정 |
| Artifact Registry | 고정 컨테이너 이미지 | 배포/실행 계정 |
| Cloudflare Pages | Studio·JS·WASM·폰트 | 프로그램만 공개 |

문서는 Slack에 보관하고 Cloud Run이 처리 시 임시로 내려받는다. Pages에 문서·토큰·세션·API를 올리지 않는다. 자체 호스팅은 조직이 처리 인프라를 소유하는 방식이며, 문서가 로컬 기기에서만 처리된다는 뜻은 아니다.

## 설치 순서

### 1. 조직의 Slack 앱 만들기

소스 접근 권한을 받은 뒤 저장소에서 다음 명령으로 초기 manifest를 만든다.

```sh
node scripts/slack-manifest.mjs --bootstrap > slack-bootstrap.json
```

Slack 앱 관리 화면의 **From a manifest**로 조직 워크스페이스에 앱을 만든다. 초기 manifest에는 연결 전 설정을 생략하므로, 서버 배포 후 최종 manifest를 적용하고 필요한 권한을 승인/재설치한다. `.env.example`과 [개발 서버 문서](development.md)를 참고해 앱 ID·워크스페이스 ID·관리자/채널 ID를 확인한다. 비밀값은 Git·이미지 빌드 인자·Pages 자산에 넣지 않는다.

### 2. GCP 자원과 비밀값 준비

Cloud Run·Firestore·Cloud Tasks·Artifact Registry·Secret Manager를 같은 운영 환경으로 구성한다. Firestore 지역은 생성 전에 정한다. ingress/worker/task caller 서비스 계정을 분리하고, task caller에는 worker 호출 권한만 부여한다. ingress/worker에는 필요한 메타데이터·큐 게시·task caller 사용·개별 secret 읽기 권한을 설정한다.

Slack 토큰과 서명 비밀값은 Secret Manager에 저장하고 배포에서 버전으로 참조한다. 초기 관리자/채널 값은 조직 자신의 ID를 사용한다. 예제 운영자의 프로젝트·워크스페이스·채널 ID를 복사하지 않는다.

### 3. 동일 버전으로 빌드하고 두 Cloud Run 서비스 배포

```sh
docker build --platform linux/amd64 --target smoke -t rhwp-slack:smoke .
docker build --platform linux/amd64 --target release -t rhwp-slack:release .
```

이미지 검증 후 조직의 Artifact Registry에 게시하고 digest를 고정한다. Cloud Run 실행 명령은 `node dist/cloud/main.cjs`다. 역할별 환경변수는 [Cloud Run 운영 구성](cloud-run.md#리소스와-설정)을 따른다.

| 설정 | ingress | worker |
|---|---|---|
| `CLOUD_ROLE` | `ingress` | `worker` |
| `APP_ORIGIN` | 조직 ingress의 HTTPS origin | 같은 origin |
| `WORKER_ORIGIN` | 조직 worker의 HTTPS origin | 같은 origin |
| `GOOGLE_CLOUD_PROJECT`, `CLOUD_ENVIRONMENT` | 조직 프로젝트/환경 | 같은 값 |
| `TASK_QUEUE`, `TASK_SERVICE_ACCOUNT` | 조직 큐/호출 계정 | 같은 값 |
| Slack ID·secret·관리자 설정 | 조직 앱/워크스페이스 | 같은 조직 앱/워크스페이스 |

현재 검증한 사양은 ingress 1 CPU/1GiB, 최소1·최대1·동시4; worker 2 CPU/4GiB, 최소0·최대1·동시1이다. 큐 동시 작업은1이다. 이 사양이 모든 조직 부하에 충분하다는 보장은 없다. 시작 지연과 Slack 응답 제한 때문에 ingress 최소0으로 임의 변경하지 않는다. 예산 알림은 전체 클라우드 비용의 절대 상한을 보장하지 않는다.

worker는 공개 호출을 허용하지 않는다. ingress 공개 HTTPS 진입에도 Slack 서명·세션/파일 권한 검사가 적용된다. 서비스 URL 간 참조와 필수 환경변수를 모두 설정하고 준비 상태를 확인한 다음 Slack 요청 주소를 연결한다.

### 4. 조직의 Pages 프로그램 배포

PR #12를 포함한 소스에서, 컨테이너와 같은 앱/엔진 버전으로 빌드한다.

```sh
npm ci --ignore-scripts
npm run build
node scripts/export-pages.mjs https://YOUR-INGRESS.a.run.app
npx wrangler pages deploy dist/pages --project-name=YOUR-PAGES-PROJECT --branch=devel
```

`YOUR-...` 값은 실제 조직 주소/프로젝트로 바꾼다. Pages 프로젝트의 production branch를 `devel`로 맞추고 고정 production origin을 사용한다. `dist/pages`만 업로드한다. 결과물의 버전과 identity 파일 해시를 컨테이너의 manifest와 대조한다.

ingress의 `EDITOR_ORIGIN`에는 조직의 고정 Pages origin을 설정한다. **`APP_ORIGIN`은 계속 ingress 주소**다. preview deployment나 `*.pages.dev`를 허용하지 않는다. 프로그램에 고정한 API origin, API의 CORS, CSP, Slack embed 허용 hostname이 정확히 맞아야 한다.

### 5. Slack 연결과 채널 설정

```sh
node scripts/slack-manifest.mjs --origin https://YOUR-INGRESS.a.run.app > slack-connected.json
```

앱의 manifest를 적용하고 Events·Interactivity·`/rhwp` 주소가 ingress의 `/slack/events`인지 확인한다. Work Objects/embeds 설정에는 조직 Pages hostname과 필요한 sandbox 권한을 등록한다. 조직의 내부용 미배포 앱으로 구성하며 Public Distribution을 켜는 절차와 혼동하지 않는다. [embeds 공식 조건](https://docs.slack.dev/messaging/work-objects-embeds/)

앱을 채널에 초대한 뒤 지정 관리자가 `/rhwp settings`에서 자동 감지/멘션 모드를 설정한다. 채널 정책 저장 후에는 DB 설정이 초기 환경변수보다 우선한다.

### 6. 사용 전 검증

- 합성 HWP/HWPX 업로드 → 원본 스레드 PDF·PNG 생성.
- Slack 웹/데스크톱 편집기 → 편집본 저장 → 같은 스레드 수정본·PDF/PNG.
- 앱/사용자 채널 접근 회수 시 읽기와 저장 거부, 티켓 재사용 거부.
- 서버 재시작 뒤 기존 카드 열기, 중복 업로드/재시도 억제, 큐 실패 복구.
- 다른 조직·잘못된 Origin·외부 사용자가 문서에 접근하지 못하는지 확인.
- 비용·오류·메모리 관찰, 검증된 이전 컨테이너/Pages 배포로 복구.

## 갱신과 지원 경계

컨테이너와 Pages 자산을 같은 릴리스로 갱신하고 이전 배포를 복구용으로 보존한다. WASM만 덮어쓰지 않는다. 장기 문서 연결은 Firestore에 있으므로 프로그램 복구 과정에서 DB를 초기화하지 않는다.

향후 배포 템플릿은 프로젝트/지역/Slack 설정을 입력받아 IAM·Cloud Run·Tasks·Secret 참조·Pages 연결을 재현하도록 준비한다. 빈 조직 환경에서 검증하기 전까지 Terraform/원클릭 배포가 완료됐다고 안내하지 않는다.
