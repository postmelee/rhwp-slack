# Task #1 Stage 12 — 메타데이터 이전과 Slack 연결 전환

계획: [Stage 10~12](../plans/task_m010_1_impl.md#stage-1012--google-cloud-run-전환-2026-09-17-사용자-승인)

## 이전 준비

- 원본 checkout의 DB를 읽기 전용 transaction으로 읽는다. 기존 카드 ID, origin 별칭, 부모 스레드·수정본 연결, 채널 정책과 완료된 저장 영수증을 보존한다.
- 변환·업로드가 완료되지 않은 자료와 대상 namespace 충돌은 이전 전에 거절한다. 각 기록은 원자적으로 삽입하므로 같은 스냅샷의 재실행을 허용한다. 기존 열린 세션은 옮기지 않는다.
- 자동 감지·멘션의 기존 스레드 요청 ID도 재사용해 옛 문서의 카드를 중복 생성하지 않는다.
- 기존 카드 4개와 실제 Cloud Run 검증 카드 3개를 운영 namespace 이전 후보로 확인했다. 채널 설정 2개·초기화 설정 1개·스레드 연결 2개와 유효한 공유 관측 2개를 포함한 dry-run 14개는 충돌이 없었다. 원본 파일 bytes·비밀값은 포함하지 않는다.
- 운영자 명령 `scripts/migrate-cloud-state.ts`는 기본 dry-run이며 명시적 `--apply` 때만 쓴다. Google ADC를 사용하고 Slack 토큰은 요구하지 않는다.

## 현재 검증

- typecheck 통과. Slack 회귀 69/69 (이전 dry-run/중복 재실행/잘못된 입력/기존 카드 주소·스레드 재사용 2개 포함).
- release 후보 digest `sha256:a2283cc9bc579d6209de7d67903aeed09342208d6fc3b80af9afb5b93e77e404`.
- 사용자 승인한 `records.expiresAt` TTL은 실제 ACTIVE 확인. 활성 문서의 만료 필드는 null이다.
- Slack 매니페스트의 변경 전 URL·도메인·scope 구성을 읽어 보관했다. 요청 URL 3개와 새 embed 도메인만 전환 대상이며 권한 추가는 없다.

## 미완료 수용 조건

- 초기 지연에 대한 운영 선택: 최소 0개 내부 테스트 또는 상시 대기 비용 검토. 사용자 답변 대기.
- 원본 서버를 멈춘 시점의 최종 스냅샷, 운영 namespace/큐 적용 및 서버 이미지 배포.
- ingress 공개·worker 비공개 확인, Slack 주소/도메인 전환, 실제 업로드·기존 카드·내부 편집/저장 확인.
- 다른 사용자 직접 수용은 사용자가 동료와 별도로 확인할 항목으로 유지한다.

## 초기 지연 검증과 후속 결정

- 수동 scaling=0으로 인스턴스를 종료한 뒤 auto 복원을 비동기로 요청하고 즉시 HTTP 요청했다. 로그에서 HTTP 접수 이후 AUTOSCALING 인스턴스 시작을 확인했다. 자연 유휴 축소가 아니라 제어된 재시작 검증이며, 이미 준비된 인스턴스의 응답과 구별한다.
- 코드 캐시 전: 로컬 왕복 3,233ms, Cloud Run 요청 latency 2.597초. 캐시 후: 로컬 왕복 3,065ms, Cloud Run latency 2.366초. 마지막 실행의 process uptime 1,762ms, 인증/저장소 초기화 496ms.
- Node 24.21.0 이미지에 489개 모듈 코드 캐시가 포함됐고, 네트워크가 차단된 `node dist/cloud/main.cjs --warm-code`가 종료 0으로 완료됐다. 문서나 인증 정보는 캐시에 포함하지 않는다.
- release digest `sha256:70cd59bef220f5fb69081e65288ac57bd0811566b2387d893919cc5b523dcd1d`를 비공개 ingress/worker 양쪽에 적용했다. worker `00005-z78`, ingress `00006-s8x`. 최소 0, 서비스/리비전 최대 1.
- 위 수치는 최초 Slack 요청의 항상 3초 이내 응답을 보장하지 않는다. 초기 명령/편집 클릭 재시도 가능성을 감수하는 최소 0개 내부 운영과 상시 대기 비용 재검토를 사용자에게 제시했다. Slack 연결은 선택 전 변경하지 않았다.
- 실제 Slack API에서 이전 후보 7개 카드 모두 권한 확인에 통과했고 이전 URL 별칭도 확인했다. 운영 namespace에는 아직 쓰지 않았다.

최종 후보 이미지에서 편집 HTTP 검증도 재실행했다. 티켓 교환 성공·재사용 403, 합성 원본 bytes 일치, 동일 저장 UUID의 파일 ID 일치, 수정본 PDF/PNG가 원본 스레드에 유지됨을 확인했다. 증적: `.cache/validation/cloud-editor-final.log`.
