# Task #1 Stage 10 — Cloud Run 저장·작업 경계

계획: [구현계획서](../plans/task_m010_1_impl.md#stage-1012--google-cloud-run-전환-2026-09-17-사용자-승인)

## 범위와 현재 상태

기존 e17f86d 운영 checkout·서버·터널·SQLite는 유지한다. 분리 브랜치 `codex/task1-cloud-run`에 선택형 cloud 진입점을 추가했다. 실제 Slack 전환은 Stage 11의 클라우드 수용 뒤에 수행한다.

- Firestore/SQLite 비동기 메타데이터 계약. 문서 bytes·자격증명·임시 다운로드/업로드 URL을 거부한다.
- 서버 간 일회용 티켓 교환, 만료 세션, 현재 Slack 권한 재검사와 문서 회수 epoch.
- Cloud Tasks는 opaque ID만 전달한다. 작업 기록을 먼저 저장하고 게시 실패를 호출자에게 반환한다. worker lease·문서 lease로 동시 변경을 제한하며 Slack side effect 전 다시 확인한다.
- 다운로드/변환/업로드는 worker HTTP 요청이 살아 있는 동안 실행한다. 파일 bytes는 요청 메모리에만 있으며 완료 이후 다른 요청에서 재사용하지 않는다.
- 공유되지 않은 Slack 업로드 ID·완료 시도·댓글 TS를 영속화한다. 확실하지 않은 완료는 동일 ID로 조회하고 새 파일을 임의 공유하지 않는다. 외부 Slack API와 Firestore 사이의 단일 원자 트랜잭션/완전한 exactly-once를 주장하지 않는다.
- 편집본은 같은 스레드, 이미지 3→10페이지, PDF Slack 링크, 편집 Work Object UX를 유지한다. 제목/갤러리/카드 생성 함수를 legacy와 공유한다.
- cloud 수신기는 서명 검사 후 durable handoff를 완료해야 200을 반환한다. worker는 Google OIDC audience와 전용 호출 계정을 검사한다. 일반 대화 이력은 요청·보관하지 않는다.

## 검증 증거

- macOS Node 24.15.0: `npm run typecheck` 통과, `npm run test:slack` 65/65, `npm run test:security` 22/22, `npm test` 7/7.
- 실제 editor HTTP: 서버 교체 후 티켓 교환·문서 로드 성공, 같은 티켓 재사용 403, 세션 회수 후 403.
- 합성 Slack API: 새 worker마다 상태를 다시 읽어 원본 카드·PNG/PDF·저장본을 처리, 큐 장애 후 동일 저장 ID 재시도는 파일/댓글을 중복 생성하지 않는다.
- 실제 Firestore(us-central1): 기본 gRPC에서 2개 동시 갱신과 경쟁 티켓 교환(성공 1개) 통과. 개발자 OAuth로 사용한 REST fallback은 동시 트랜잭션 타임아웃이 발생하여 배포 경로로 사용하지 않는다.
- Linux amd64 release 빌드 성공. Node 24.21.0이 사용된다. Mac amd64 에뮬레이션에서 esbuild Go GC 충돌이 발생했으나 `GOMAXPROCS=1`로 65/65 통과했다. 이후 초기 실패 상태·메모리 계측 보완은 macOS에서 재검증했고 최종 Linux 이미지는 Stage 11에서 다시 확인한다. 에뮬레이션 결과를 실제 Cloud Run 수용으로 대신하지 않는다.
- 로그는 비공개 `.cache/validation/`의 cloud-typecheck, cloud-slack, cloud-security, cloud-unit, firestore-probe-grpc, cloud-docker-build에 남긴다. 비밀값·실사용 문서는 커밋하지 않는다.

## 남은 검증

Stage 11: 실제 worker IAM/OIDC, Cloud Tasks 전달·재시도, Linux 실제 변환·메모리, 최소 인스턴스 0 콜드 스타트, 비용. Stage 12: 기존 메타데이터 이전/중복 차단, Slack 설정 전환과 실제 PDF·Studio 저장 수용. 운영 완료로 보고하지 않는다.
