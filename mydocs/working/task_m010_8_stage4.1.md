# #8 Stage 4.1 — 정적 호스팅 분리 코드와 로컬 검증

GitHub Issue: [#8](https://github.com/postmelee/rhwp-slack/issues/8)
구현계획서: [task_m010_8_impl.md](../plans/task_m010_8_impl.md)
Stage: 4.1

## 단계 목적

비교 C가 B와 같은 프로그램을 실행하고 Cloud Run API만 안전하게 호출하도록 준비한다.

## 산출물

- `EDITOR_ORIGIN` 선택 설정: 정확한 단일 HTTPS origin. 기본값은 기존 APP_ORIGIN과 동일한 호스팅이다.
- API CORS: 지정된 두 origin만 허용하며 GET/POST 및 필요한 네 헤더만 preflight 승인. credentials 허용 없음, 모든 API/OPTIONS/error는 no-store, Vary Origin.
- 배포자가 HTML의 meta로 API origin을 설정한다. 쿼리나 문서 입력에서 endpoint를 받지 않는다. 티켓은 iframe 생성 전에 fragment에서 제거하고 API로만 전송한다.
- `scripts/export-pages.mjs`: 기존 manifest 파일만 SHA 검증 후 복사. JS/WASM/font는 B와 동일하고 `/editor/` shell의 API meta만 다르다. Functions, 토큰, 원본·PDF·PNG, source map, .env, 런타임 DB는 포함하지 않는다. explicit 404로 SPA fallback 비활성화.
- `tests/security/editor-cors.test.ts`, `tests/viewer/cross-origin.spec.ts`: 올바른 origin/잘못된 origin, 로컬의 실제 서로 다른 origin에서 Studio 편집과 같은 스레드 저장 검증.

## 본문 변경 정도 / 본문 무손실 여부

변환 엔진·파일·Slack 표시 내용 변경 없음. iframe/SDK/저장 제어는 같은 정적 origin을 유지한다.

## 검증 결과

- typecheck 통과, security 30/30, 관련 viewer 6/6.
- 실제 cross-origin 편집→HWP 저장→같은 스레드 PDF/PNG 완료. 정적 요청 Authorization/cookie/fragment 없음.
- Pages exporter: 프로그램 58파일 43,294,079 B, 운영 파일 포함 총 62, header 62규칙. 단일 파일 최대 25 MiB/100 header/행 2,000문자 한도 검사 통과.
- Cloudflare CLI의 만료 인증을 사용자 직접 로그인으로 갱신했다. account:read/user:read/pages:write만 요청했고 기존 Pages 프로젝트와 분리할 수 있다.

## 잔여 위험

실제 Cloud Run tagged revision·Pages 배포, CORS/CSP 실응답과 시간/전송량 비교는 Stage 4.2 및 5에서 이어서 검증한다. 현재 검증을 실제 Slack 데스크톱 검증으로 간주하지 않는다.

## 다음 단계 영향

프로그램 SHA를 고정한 후 운영 트래픽 0% 비교 revision을 만들고 B/C에 동일 빌드 자산을 제공한다. 서비스 수준 min=1은 유지하며 비교 revision에 추가 min instance를 지정하지 않는다.

## 승인 요청

동일 스레드의 #8 비교 배포 승인 범위로 이어간다. 비용 한도·사양·Slack 권한은 확대하지 않는다.
