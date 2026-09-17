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

- 첫 요청이 실제 인스턴스 시작을 포함하는 응답 시간 확인.
- 원본 서버를 멈춘 시점의 최종 스냅샷, 운영 namespace/큐 적용 및 서버 이미지 배포.
- ingress 공개·worker 비공개 확인, Slack 주소/도메인 전환, 실제 업로드·기존 카드·내부 편집/저장 확인.
- 다른 사용자 직접 수용은 사용자가 동료와 별도로 확인할 항목으로 유지한다.
