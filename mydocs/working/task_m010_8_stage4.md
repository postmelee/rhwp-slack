# #8 Stage 4 — Pages 비교 배포와 원격 검증

GitHub Issue: [#8](https://github.com/postmelee/rhwp-slack/issues/8)
구현계획서: [task_m010_8_impl.md](../plans/task_m010_8_impl.md)
Stage: 4

## 단계 목적

B와 C의 프로그램 바이트를 같게 유지하고 호스팅 분리만의 추가 효과를 비교할 환경을 만든다. [Stage 4.1](task_m010_8_stage4.1.md)의 API/Origin 구현을 실제 서비스에서 확인한다.

## 산출물

| 구성 | 값 |
|---|---|
| 실행 소스 | `c6e609dcf3af0ff2d8f546ac91c3bc015f419121` |
| B tag | `https://editor-b---rhwp-ingress-aaj47f2u5q-uc.a.run.app` |
| B revision | `rhwp-ingress-task8-b1`, 기본 트래픽 0% |
| B 이미지 | `sha256:cecce003ca327ca3cc8660bc1a7d02fd2e08db82b8a13890d702a8f5b2d61ebd` |
| C Pages | `https://rhwp-slack-editor-lab.pages.dev` |
| C deployment | `https://1b695dc3.rhwp-slack-editor-lab.pages.dev` |
| 동일 정적 namespace | `78e373467afb21ac634c3312ea53441245d94e2470baff0e1e8f34adc4399d0f` |

제품 문서는 계획대로 `docs/static-hosting.md`, `docs/architecture.md`, `.env.example`에 반영했다. 배포 receipt와 원시 측정은 ignored `.cache/validation/task8-*`에 보존하고 문서/토큰/비밀 URL은 게시하지 않는다.

## 본문 변경 정도 / 본문 무손실 여부

B/C의 58개 JS/WASM/글꼴 등 identity 파일은 SHA-256 전수 일치한다. 디스크 용량은 43,294,079 bytes이며 네트워크 전송량과 다르다. C의 비버전 HTML에만 고정 API origin을 넣었다. 엔진·글꼴·변환 worker·Slack URL·서버 사양·권한·예산을 변경하지 않았다.

## 검증 결과

- Pages exporter의 파일 25MiB / 헤더 100개·행 2,000자 검사 통과: 총 62파일, 헤더 62규칙.
- C 실응답: `/editor/` 200·no-cache, 버전 WASM 200·application/wasm·immutable, `/api/editor/source`·없는 경로·없는 버전 404·no-store. SPA fallback 없음.
- B 실응답: shell 200, 인증 없는 원본 403, 지정된 C origin OPTIONS 204·정확한 ACAO, 다른 Pages origin 403.
- B/C 각각 브라우저 신규/반복/다른 문서 3회씩 9/9 편집 준비 성공. A 포함 상세 비교는 Stage 5에 정리한다. 서버 warm 조건이며 B의 측정 구간 `cloud_ready`는 한 번이었다.
- [Linux CI 35459270890](https://github.com/postmelee/rhwp-slack/actions/runs/35459270890): c6e609d의 viewer/container 모두 성공. canonical Dockerfile 빌드, 2CPU/4GiB 서버 PDF, 격리 runtime/합성 Slack, release 빌드 통과.
- Mac ARM의 AMD64 에뮬레이션 smoke에서는 esbuild Go 프로세스가 비정상 주소/할당 panic으로 실패했다. 이를 코드 통과로 처리하지 않았고 위 native Linux 결과로 배포 플랫폼 검증을 완료했다.
- 배포 이미지의 OS/Node/의존성은 기존 운영 이미지 기반이다. 로컬의 canonical Dockerfile로 빌드한 AMD64 release에서 앱 산출물만 계층으로 복사했다. native Linux CI는 동일 소스를 별도로 빌드·검증했으며, 배포 이미지를 CI에서 다운로드한 것은 아니다. lockfile/Studio pin은 기준과 같으며 큰 OS 계층 업로드 연결 끊김을 피했다. 소스·자산 일치와 실제 GCP 실행은 별도로 검증했다.

## 잔여 위험

현재 단계의 원격 성공은 독립 Chromium 결과다. 실제 Slack 웹/데스크톱 수용과 운영 반영은 Stage 5에서 구분한다. Pages C 도메인을 Slack 운영 설정에 추가하지 않았다. C 단독 성공만으로 Slack 내장 동작을 주장하지 않는다.

## 다음 단계 영향

운영 ingress는 여전히 00012-6hv 100%, worker는 00008-6t7이다. B는 tag 주소용 APP_ORIGIN과 C 허용 설정을 사용하므로 운영 전환 시 새 revision에 운영 APP_ORIGIN을 복원하고 B 선택 시 EDITOR_ORIGIN을 제거한다. 기존 revision으로 트래픽을 되돌릴 수 있다.

## 승인 요청

같은 스레드의 #8 진행·비교 배포·원격 push/CI 승인 범위로 Stage 5를 이어간다. PR 병합은 별도 검토 대상이다.
