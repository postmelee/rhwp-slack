# Task #16 Stage 4 — 후보 구성과 로컬 수용

## 준비한 구성

기존 Cloud Run main과 별도로 distributed 번들을 빌드하고 비밀값 없는 warm-code 실행을 확인했다. 베타 manifest 생성기는 내부 embeds 이벤트를 제외하고 OAuth/OpenID callback과 설치 폐기 이벤트를 구성한다. bootstrap은 권한 부여 없이 앱 정의만 만든다. 운영자 설정과 실제 수용·복구 절차는 기존 공식 문서 루트의 `docs/external-beta.md`에 둔다.

2026-09-20 읽기 전용 확인에서 현재 GCP 프로젝트에는 rhwp-ingress/rhwp-worker만 있었다. 새 서비스·큐·비밀값·공개 호출 권한은 아직 생성하지 않았다. Chrome에서 rhwp beta 앱 정의를 입력하고 생성 검토 화면(권한 0개)까지 준비했으며 새 인증정보 생성 승인을 기다린다. Marketplace 약관 동의나 기존 앱 설정 변경은 하지 않았다.

## 로컬 검증

- Node 24.21.0, 실제 npm 11.12.1. package engines의 npm 11.19.0과 차이가 있어 설치 시 경고가 있었으며 CI 결과와 구분한다.
- typecheck, unit 9, Slack 86, security 50 통과.
- test:viewer: 25개 시나리오 통과. 기존 upstream 혼합 서식 undo 테스트는 선언된 expected failure이며 이번 작업에서 완화하지 않았다. 변환 9개 통과.
- 외부 browser workspace 헤더·fragment 제거 시나리오를 startup suite에 추가했다. 실제 Slack OIDC 서버 대신 로컬 API 응답을 사용한다.
- main/distributed esbuild 번들 생성 및 distributed --warm-code 통과.

## 남은 수용

최종 head Linux CI, 실제 후보 배포, 두 workspace OAuth 설치, 다른 실제 사용자 편집·동일 스레드 저장, 설치 삭제/재설치, 초기 응답 시간과 비용 검증은 아직 미완료다. 본 구현을 공개 베타 완료로 표시하거나 운영 Slack URL을 전환하지 않는다.
