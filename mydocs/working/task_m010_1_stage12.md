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

- 초기 지연에 대한 운영 선택: 사용자가 상시 1개·약 $10 한 달 시험 운영을 제안했고 축소 메모리 검증을 승인했다. 512MiB 실패로 비용/한도 조정 결정을 남긴다.
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


## Stage 12.1 — ingress 메모리 축소 검증 (2026-09-17)

### 조건과 재현

- 검증한 source head `75de51f`, runtime digest `sha256:70cd59bef220f5fb69081e65288ac57bd0811566b2387d893919cc5b523dcd1d`. 앱 코드는 바꾸지 않았다.
- 기존 Slack 연결은 유지하고 비공개 validation ingress만 `00007-bc5` / 1CPU·512MiB로 배포했다. 동시 요청 4, 동시에 읽고 저장하는 요청 최대 2. worker 2CPU·4GiB·최소 0은 유지했다.
- 표/텍스트 2페이지 HWP 13,824 bytes와 HWPX 8,876 bytes, 비압축성 합성 이미지 1페이지 HWP 19,379,200 bytes 및 HWPX 19,221,830 bytes를 사용했다. 모두 20MiB 한도 안이며 실제 개인정보는 없다. 큰 파일은 실제 rhwp로 내보낸 뒤 재파싱했다.
- `.cache/cloud-memory-probe.ts small`, `large-single`, `large-pair`, `verify`를 `node --import tsx`로 실행했다. 각 신규 저장에 서로 다른 UUID를 먼저 기록하여 기존 성공 영수증을 재사용하는 경로로 검증이 우회되지 않게 했다.
- 작은 두 형식의 저장 HTTP 200(5.677초/5.430초), 큰 HWP 단독 저장 200(11.208초), 큰 HWP/HWPX 동시 저장 200(12.105초/9.827초). 큰 수정본 재다운로드 19,379,200 bytes는 입력과 일치했다.
- 실제 Playwright Studio에서 문서 열기, 텍스트 입력, 저장 후 PDF 준비 완료 문구까지 도달했다. 그러나 **동일 혼합 부하 구간 10:58:51.674 UTC에 Cloud Run이 512MiB 리비전을 메모리 521MiB 초과로 종료**했다. 개별 최종 성공과 관계없이 512MiB는 불합격이다. 로그만으로 어느 개별 요청/할당이 원인인지는 단정하지 않는다.
- Monitoring의 초기 표본 최대 평균 약 207.7MiB는 순간 피크를 놓쳤다. 샘플 평균을 안전한 최대 메모리로 사용하지 않고, 실제 OOM 로그를 판정 근거로 삼았다.

### 복구 및 운영 판단

- ingress `00008-bf9` / 1CPU·1GiB로 복구했고 최소 0, 서비스·리비전 최대 1을 확인했다. 256MiB 추가 시험은 시행하지 않았다.
- 복구 후 새 저장 UUID로 큰 HWP/HWPX 동시 저장을 재검증했다(HTTP 200, 로컬 20.579초/13.083초). 두 큰 수정본 모두 PDF/PNG ready 및 원본과 같은 부모 스레드를 확인했다. 동시에 실제 Studio에서 열기·텍스트 편집·저장과 PDF 준비 완료까지 통과했다. 스크린샷의 입력 텍스트와 저장 완료 상태도 직접 확인했다.
- 복구 리비전의 세 저장 요청은 모두 200이었고 조회한 검증 구간에서 ERROR 로그는 0건이었다. Monitoring 표본 최대 평균 339.2MiB는 참고값일 뿐 순간 피크가 아니다. 단기간 합성 부하 통과이며 장기간·모든 실문서 안정성을 보장하지 않는다.
- 512MiB 축소만으로 상시 대기와 할인 전 월 $10 한도를 동시에 달성할 수 없다. 1GiB·730시간 유휴 비용 $13.14, 무료 할당량이 전부 유효하면 약 $7.92(프로모션 크레딧 전). 실제 변환·요청·다른 서비스 비용은 더해진다.
- 비용 한도와 상시 대기 수는 이번 검증에서 올리지 않았다. 운영 namespace 이전과 Slack 연결 전환은 미완료다.
- 증적은 ignored `.cache/validation/memory-*.log`, `memory-errors.json`, `memory-*-receipts.json`, `memory-*-metrics.jsonl`, `ingress-before-memory.json`, `ingress-after-memory.json`에 보관한다. 비밀값과 합성 파일 bytes는 Git에 포함하지 않는다.
