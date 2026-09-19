# 편집기 프로그램 캐시와 정적 호스팅

## 기본 구성

`APP_ORIGIN`의 Cloud Run 서버가 `/editor/`, `/studio/` 및 인증 API를 제공한다. `EDITOR_ORIGIN`이 없으면 이 구성을 유지한다.

프로그램은 `/static/<build-input-sha256>/editor/` 및 `/static/<build-input-sha256>/studio/`에서 제공한다. 이 경로의 manifest 항목만 `public, max-age=31536000, immutable`이다. `/editor/`·`/studio/`의 HTML은 `no-cache`로 재검증한다. 빌드 시 만든 Brotli/gzip, 표현별 ETag, `Vary: Accept-Encoding`, GET/HEAD/304를 지원한다. 존재하지 않는 버전은 404이며 같은 이름으로 최신 파일을 돌려주지 않는다.

버전 입력은 앱 lockfile, 편집기·공유 코드, Studio pin/overlay, 관련 빌드 스크립트다. 파일명에 버전이 없는 글꼴도 버전 디렉터리에 들어간다. 운영 중 파일 하나를 교체하는 방식은 지원하지 않는다. 자산과 manifest를 같은 빌드로 배포한다. 개발용 Studio 재빌드도 압축 파일/manifest를 함께 갱신한다.

캐시는 프로그램만 보관한다. 원본·편집본·PDF·PNG·ticket·token·API/오류 응답은 대상이 아니다. 편집기는 새 창마다 새 문서를 시작하고 복구/최근 문서/자동 저장을 켜지 않는다. 브라우저가 캐시를 지우면 다음 열기에서 다시 내려받는다. HTTP cache hit가 모든 WASM 초기화나 글꼴 적용 비용 제거를 뜻하지는 않는다.

## 시작 순서

1. 호스트는 URL fragment의 일회용 ticket을 읽고 즉시 URL에서 제거한다.
2. API에서 ticket을 교환한다. 실패하면 Studio를 시작하지 않는다.
3. Studio 초기화와 metadata/source 요청을 병렬로 실행한다. metadata는 권한만 확인하고 파일명을 반환하며 원본은 source에서 한 번 다운로드/검증한다.
4. 양쪽이 모두 성공하면 loadFile 후 편집/저장을 활성화한다. 실패/제한시간 초과 시 원본 요청과 Studio, 늦게 도착한 Studio까지 폐기한다.

`rhwp:*` Performance mark는 브라우저 안에서만 기록하며 식별자/본문을 넣거나 서버로 전송하지 않는다. `scripts/benchmark-editor.mjs`는 테스트 환경에서 신규 context → 같은 문서 새 창 → 다른 문서 새 창을 각 3회 측정한다. provider는 개별 실행 직전에 새 ticket을 발급한다. 브라우저 cache cold/warm과 서버 인스턴스 cold/warm을 구분하고 리소스 전송량과 디스크 크기를 혼용하지 않는다.

## Pages 분리 구성

호스트와 Studio는 **같은 Pages origin**에 두고 API는 Cloud Run에 유지한다. `scripts/export-pages.mjs`는 이미 빌드된 manifest의 프로그램만 해시 확인 후 `dist/pages`로 복사한다. B와 C의 JS/WASM/글꼴은 동일해야 한다. shell의 `rhwp-api-origin` meta와 CSP에만 배포자가 지정한 정확한 HTTPS API origin을 넣는다. URL query, 문서 내용, localStorage로 API 주소를 바꿀 수 없다.

```sh
npm ci --ignore-scripts
npm run build
node scripts/export-pages.mjs https://YOUR-INGRESS.a.run.app
npx wrangler pages deploy dist/pages --project-name=YOUR-PAGES-PROJECT --branch=devel
```

고정된 Pages origin만 ingress의 `EDITOR_ORIGIN`에 설정한다. 이는 편집 진입 주소와 CORS 허용 주소다. 임의 preview deployment 주소나 `*.pages.dev` 와일드카드는 허용하지 않는다. API preflight는 GET/POST 및 Authorization, Content-Type, X-Save-Request-Id, X-Document-Format만 허용한다. 쿠키 인증과 `Access-Control-Allow-Credentials`는 사용하지 않는다. API는 `Vary: Origin`, `no-store`를 유지하고 요청마다 사용자/채널/파일 권한을 검사한다.

Pages에는 API/문서 저장소/Functions를 배포하지 않는다. explicit 404와 robots/noindex를 포함한다. API 및 알 수 없는 경로가 SPA HTML로 대체되지 않는지 실서버에서 확인한다. 정적 프로그램은 공개되며 upstream 라이선스/폰트 고지를 함께 제공한다. `dist/pages` 이외의 저장소 폴더·.cache·.env를 Pages에 올리지 않는다.

Exporter는 [Pages 파일 한도](https://developers.cloudflare.com/pages/platform/limits/)와 [헤더 한도](https://developers.cloudflare.com/pages/configuration/headers/)를 검사한다. Pages는 정적 파일에 대한 헤더 규칙을 적용하므로 소스 origin만 바꾸고 CSP/CORS 검증을 생략하지 않는다.

## 배포·갱신·복구

1. 동일한 소스·pin·lockfile로 컨테이너와 Pages 자산을 만들고 identity SHA-256이 같은지 확인한다.
2. 운영 트래픽 0%의 Cloud Run tag에서 API와 Pages C를 검증한다. 기존 운영 revision/worker/사양/예산을 유지한다. 테스트 tag에 별도의 min instance를 추가하지 않는다.
3. 실제 Slack 웹/데스크톱 embed 허용 도메인과 CSP ancestor를 확인한다. 외부 브라우저 단독 성공은 Slack 내장 편집 성공의 증거가 아니다.
4. 새 session의 edit/save, 만료·재사용 ticket·권한 회수·다른 origin·틀린 세션 및 같은 스레드 PDF/PNG를 확인한다.
5. 비교 tag의 `APP_ORIGIN`을 운영 배포에 그대로 복사하지 않는다. 운영용 새 revision은 실제 Slack 수신 주소를 `APP_ORIGIN`으로 복원한 후 전환한다. B/C 실측과 운영 복잡성을 보고 선택한다. C가 실익이 없으면 `EDITOR_ORIGIN`을 제거하고 기본 호스팅을 유지한다. `APP_ORIGIN`은 Slack 수신 URL/문서 연결 원본이므로 Pages 주소로 바꾸지 않는다.
6. 복구 시 ingress 이미지/revision과 Pages deployment를 맞춰 되돌린다. 이미 열려 있던 구버전이 아직 받지 못한 파일을 새 배포에서 찾을 수 없으면 Slack 카드에서 새로 연다. 인증 ticket을 URL query나 고정 링크로 바꿔 복구하지 않는다.

프로그램 캐시가 줄이는 것은 주로 전송량·일부 요청 작업이다. ingress의 기존 상시 대기 비용, 인증/다운로드/저장 API와 worker 변환 비용이 없어지지는 않는다. 비용 추정과 실제 청구 집계는 별도로 기록한다.
