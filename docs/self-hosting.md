# 조직용 자체 호스팅 — Cloud Run + Cloudflare Pages

**상태: 관리자용 설치 안내.** 기존 운영 구성에 근거하며, 새 조직의 빈 GCP/Cloudflare 계정에서 끝까지 재현한 배포 도구는 아직 없다. 원클릭 배포를 제공하지 않는다. 외부 브라우저 편집은 #16 및 후속 공개 베타 변경을 포함한 소스가 필요하다. 임의로 가장 최신 엔진과 앱을 섞지 않는다.

## 준비물과 접근 조건

- 조직 소유 Slack 워크스페이스와 앱 생성/설치 승인 권한.
- 결제 계정이 연결된 조직 GCP 프로젝트, Cloudflare 계정.
- 앱 소스 또는 검증된 컨테이너 이미지와 Pages 자산에 대한 접근 권한.
- Node/npm은 저장소 `.nvmrc`와 `package.json`에 고정한 버전, Linux AMD64 컨테이너 빌드 환경.

앱의 자체 코드·문서는 [MIT License](../LICENSE)로 제공한다. 엔진·라이브러리·폰트는 [제3자 고지](../THIRD_PARTY_NOTICES.md)의 원래 조건을 유지한다. 검증된 앱 릴리스와 함께 고정된 엔진을 사용한다.

## 구성

| 구성 요소 | 역할 | 외부 접근 |
|---|---|---|
| 조직 Slack 앱 | 이벤트·명령 수신, PDF/PNG·편집본 게시 | 조직 워크스페이스 |
| Cloud Run ingress | Slack 서명, 인증/권한, 문서 읽기·저장 API | HTTPS 공개 진입점, 요청별 인증 |
| Cloud Run worker | 문서 변환과 Slack 업로드 | Cloud Tasks 호출 계정만 허용 |
| Firestore | 파일·스레드 연결, 채널 설정, 임시 세션/작업 기록 | 서비스 계정 |
| Cloud Tasks | 변환 작업 전달·재시도 | 서비스 계정 |
| Secret Manager | 앱 client secret·signing secret·설치 토큰 암호화 키 | 필요한 실행 서비스 계정 |
| Artifact Registry | 고정 컨테이너 이미지 | 배포/실행 계정 |
| Cloudflare Pages | Studio·JS·WASM·폰트 | 프로그램만 공개 |

문서는 Slack에 보관하고 Cloud Run이 처리 시 임시로 내려받는다. Pages에 문서·토큰·세션·API를 올리지 않는다. 자체 호스팅은 조직이 처리 인프라를 소유하는 방식이며, 문서가 로컬 기기에서만 처리된다는 뜻은 아니다.

## 설치 순서

### 1. 조직의 Slack 앱 만들기

저장소를 준비한 뒤 다음 명령으로 초기 manifest를 만든다.

```sh
node scripts/slack-beta-manifest.mjs --bootstrap > slack-bootstrap.json
```

Slack 앱 관리 화면의 **From a manifest**로 조직 워크스페이스에 앱을 만든다. 초기 manifest에는 연결 전 설정을 생략하므로, 서버 배포 후 최종 manifest를 적용하고 필요한 권한을 승인/재설치한다. [외부 베타 구성](external-beta.md)을 참고해 앱 ID·client ID·signing secret·client secret을 준비한다. 설치자는 OAuth로 확인되며 전역 봇 토큰이나 고정 워크스페이스 ID를 설정하지 않는다. 비밀값은 Git·이미지 빌드 인자·Pages 자산에 넣지 않는다.

### 2. GCP 자원과 비밀값 준비

Cloud Run·Firestore·Cloud Tasks·Artifact Registry·Secret Manager를 같은 운영 환경으로 구성한다. Firestore 지역은 생성 전에 정한다. ingress/worker/task caller 서비스 계정을 분리하고, task caller에는 worker 호출 권한만 부여한다. ingress/worker에는 필요한 메타데이터·큐 게시·task caller 사용·개별 secret 읽기 권한을 설정한다.

앱 signing secret·client secret·설치별 토큰 암호화 키는 Secret Manager 버전으로 참조한다. `INSTALLATION_KEY_ID`와 `INSTALLATION_KEYS_JSON`은 키 ID와 32바이트 난수의 base64 값을 대응시킨다. 저장된 설치 토큰은 Firestore에 암호화되고 실행 중에만 복호화된다. 예제 운영자의 프로젝트·워크스페이스·채널 ID를 복사하지 않는다.

### 3. 동일 버전으로 빌드하고 두 Cloud Run 서비스 배포

```sh
docker build --platform linux/amd64 --target smoke -t rhwp-slack:smoke .
docker build --platform linux/amd64 --target release -t rhwp-slack:release .
```

이미지 검증 후 조직의 Artifact Registry에 게시하고 digest를 고정한다. 브라우저 편집을 사용할 조직의 실행 명령은 **`node dist/cloud/distributed.cjs`**다. 내부 embed용 `main.cjs`와 섞지 않는다. 역할별 환경변수는 다음 표와 [외부 베타 구성](external-beta.md)을 따른다.

| 설정 | ingress | worker |
|---|---|---|
| `CLOUD_ROLE` | `ingress` | `worker` |
| `APP_ORIGIN` | 조직 ingress의 HTTPS origin | 같은 origin |
| `WORKER_ORIGIN` | 조직 worker의 HTTPS origin | 같은 origin |
| `GOOGLE_CLOUD_PROJECT`, `CLOUD_ENVIRONMENT` | 조직 프로젝트/환경 | 같은 값 |
| `TASK_QUEUE`, `TASK_SERVICE_ACCOUNT` | 조직 큐/호출 계정 | 같은 값 |
| `SLACK_APP_ID`, `SLACK_SIGNING_SECRET` | 조직 앱 | 같은 앱 |
| `SLACK_CLIENT_ID`, `SLACK_CLIENT_SECRET` | 필요 | 불필요 |
| `INSTALLATION_KEY_ID`, `INSTALLATION_KEYS_JSON` | 현재 key ID·key ring | 같은 값 |
| `EDITOR_ORIGIN` | 조직의 Pages HTTPS origin | 같은 origin |

외부 베타에서 검증한 사양은 ingress 1 CPU/1GiB, 최소0·최대1·동시4; worker 2 CPU/4GiB, 최소0·최대1·동시1이다. 큐 동시 작업은1이다. 이 사양이 모든 조직 부하에 충분하다는 보장은 없다. 최소0에는 콜드 스타트 지연이 있다. 상시 대기 1은 지연과 비용을 측정한 뒤 선택한다. 예산 알림은 전체 클라우드 비용의 절대 상한을 보장하지 않는다.

worker는 공개 호출을 허용하지 않는다. ingress 공개 HTTPS 진입에도 Slack 서명·세션/파일 권한 검사가 적용된다. 서비스 URL 간 참조와 필수 환경변수를 모두 설정하고 준비 상태를 확인한 다음 Slack 요청 주소를 연결한다.

### 4. 조직의 Pages 프로그램 배포

컨테이너와 같은 commit·lockfile·Studio pin으로 빌드한다.

```sh
npm ci --ignore-scripts
npm run build
node scripts/export-pages.mjs https://YOUR-INGRESS.a.run.app
npx wrangler pages deploy dist/pages --project-name=YOUR-PAGES-PROJECT --branch=devel
```

`YOUR-...` 값은 실제 조직 주소/프로젝트로 바꾼다. Pages 프로젝트의 production branch를 `devel`로 맞추고 고정 production origin을 사용한다. `dist/pages`만 업로드한다. 결과물의 버전과 identity 파일 해시를 컨테이너의 manifest와 대조한다.

ingress의 `EDITOR_ORIGIN`에는 조직의 고정 Pages origin을 설정한다. **`APP_ORIGIN`은 계속 ingress 주소**다. preview deployment나 `*.pages.dev`를 허용하지 않는다. 프로그램에 고정한 API origin, API의 CORS와 CSP가 정확히 맞아야 한다. 조직 홈페이지까지 게시하려면 `--public-site`를 쓸 수 있지만 `site/`의 운영자·연락처·개인정보 내용은 먼저 조직 정보로 바꾼다.

### 5. Slack 연결과 채널 설정

```sh
node scripts/slack-beta-manifest.mjs --origin https://YOUR-INGRESS.a.run.app > slack-connected.json
```

앱의 manifest를 적용하고 Events·Interactivity·`/rhwp` 주소가 ingress의 `/slack/events`인지 확인한다. OAuth redirect는 ingress의 `/oauth/callback`, OpenID redirect는 `/browser/callback`을 등록한다. `/install`로 설치하면 설치자가 초기 설정 관리자가 된다. 채널에 앱을 초대하면 처음 초대한 채널에서 자동 감지가 켜진다. 기존 채널 설정은 유지한다. 한 조직에서만 쓸 경우 외부 배포를 켤 필요가 없다. 여러 workspace에 배포하려면 해당 앱의 Public Distribution을 별도로 활성화한다.

이 경로는 **Slack PDF·PNG + 브라우저 Studio**이며 Work Objects embeds를 요청하지 않는다. 이미 승인된 내부 embed 앱을 자체 운영하려는 경우에만 기존 [단일 workspace 운영](cloud-run.md)과 `slack-manifest.mjs`를 사용한다. 공개 앱의 내부 embeds 지원은 별도 승인 조건을 확인해야 한다.

설정 관리자는 앱 홈 또는 `/rhwp`에서 자동 감지·멘션 요청·사용 안 함을 선택한다. 일반 대화 내역 읽기 권한은 요청하지 않는다. 단일 워크스페이스 서버의 명시적 활성화 설정과 분산 서버의 초대 시 자동 감지를 구분한다.

### 6. 사용 전 검증

- 합성 HWP/HWPX 업로드 → 원본 스레드 PDF·PNG 생성.
- Slack 웹/데스크톱의 편집 버튼 → 브라우저 Studio → 편집본 저장 → 같은 스레드 수정본·PDF/PNG.
- 앱/사용자 채널 접근 회수 시 읽기와 저장 거부, 티켓 재사용 거부.
- 서버 재시작 뒤 기존 카드 열기, 중복 업로드/재시도 억제, 큐 실패 복구.
- 다른 조직·잘못된 Origin·외부 사용자가 문서에 접근하지 못하는지 확인.
- 비용·오류·메모리 관찰, 검증된 이전 컨테이너/Pages 배포로 복구.

## 갱신과 지원 경계

컨테이너와 Pages 자산을 같은 릴리스로 갱신하고 이전 배포를 복구용으로 보존한다. WASM만 덮어쓰지 않는다. 장기 문서 연결은 Firestore에 있으므로 프로그램 복구 과정에서 DB를 초기화하지 않는다.

자체 호스팅 안내 문의: [Taegyu Lee](mailto:meleeisdeveloping@gmail.com). 조직의 보안·백업·지원·비용 책임은 자체 운영자에게 있다.

향후 배포 템플릿은 프로젝트/지역/Slack 설정을 입력받아 IAM·Cloud Run·Tasks·Secret 참조·Pages 연결을 재현하도록 준비한다. 빈 조직 환경에서 검증하기 전까지 Terraform/원클릭 배포가 완료됐다고 안내하지 않는다.

## IAM·만료 기록 점검

- 실행 서비스 계정: 필요한 Firestore 접근, Cloud Tasks enqueue, 해당 task caller의 serviceAccountUser, 개별 secret의 secretAccessor. 프로젝트 Owner 키를 실행 환경에 넣지 않는다.
- task caller: worker의 Cloud Run Invoker만 부여한다. Cloud Tasks 서비스 에이전트의 OIDC 토큰 발급 권한도 확인한다.
- 공개 ingress만 allUsers 호출 허용하며 worker·DB·Secret Manager는 비공개다.
- Firestore `records` collection group의 `expiresAt` TTL은 만료된 임시 기록만 삭제한다. 활성 연결·설치 기록에 임의 만료를 설정하지 않는다.
- 암호화 키 교체 시 이전 키를 복호화용으로 유지한다. 설치 갱신은 generation을 바꾸므로 과거 카드의 자동 이전은 지원하지 않는다.
- 최소/최대 인스턴스·작업 큐 제한·예산 알림을 설정해도 프로젝트 총액의 즉시 하드 캡은 아니다.
