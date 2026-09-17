# Task #1 Stage 11 — Cloud Run 검증

계획: [Stage 10~12](../plans/task_m010_1_impl.md#stage-1012--google-cloud-run-전환-2026-09-17-사용자-승인)

## 실제 환경

- 프로젝트 `rhwp-slack-postmelee`, 지역 `us-central1`. ingress·worker는 비공개로 배포했다. worker 호출은 task caller의 IAM과 OIDC로 제한한다.
- 사용자 승인 후 기존 bot token·signing secret을 Secret Manager 버전 1로 저장했다. ingress·worker 계정만 각 secret 읽기 권한을 가진다. 비밀값은 출력하거나 Git에 기록하지 않았다.
- Firestore Native Standard 기본 DB는 freeTier=true다. 큐는 동시 작업 1·초당 1·최대 5회 재시도다. 서버는 최소 인스턴스 0, 서비스/리비전 최대 1을 설정했다.
- `expiresAt` TTL은 별도 명시 승인 후 활성화 요청을 완료했다. null인 활성 카드와 Slack 파일은 TTL 삭제 대상이 아니다.
- 크레딧 CSV에서 사용 가능 6건×13,833원=82,998원을 확인했다. 만료된 과거 Free Trial은 제외했다. 결제 계정에 프로젝트를 연결했다.
- 월 10,000원 예산 알림(크레딧 제외, 10/50/90%)과 Cloud Run 서비스 월 5,000원 지출 한도를 설정했다. 한도는 지연될 수 있고 다른 서비스/저장 비용을 포함하지 않는다. 실제 청구 집계는 지연되므로 무과금 확정으로 표시하지 않는다.

## 검증 결과

| 검증 | 실제 결과 |
| --- | --- |
| Firestore 동시 쓰기·일회용 티켓 | gRPC에서 경쟁 쓰기 2건, 티켓 성공 1건 |
| 실제 큐·OIDC | Cloud Tasks→비공개 worker 204, Firestore done 확인. 초기 IAM 전파 중 403은 재시도 뒤 해소 |
| 무인증 worker POST | 403 |
| 실제 Slack 합성 HWP | 원본 스레드에 카드 1개, PDF와 PNG 2장, 약 57초 |
| 편집 HTTP | 일회용 티켓 교환, 재사용 403, source bytes 일치 |
| 저장 중복·스레드 | 동일 저장 UUID 재시도는 같은 파일, 수정본 PDF/PNG 같은 스레드 |
| 실제 Studio | Cloud Run 편집기에서 `Cloud verified ` 입력→Slack 저장→수정본 PDF 준비 완료, 화면 직접 확인 |
| 네이티브 Linux Job | `rhwp-native-validation-kl5dl` 성공. 단위 7/7, Slack 67/67, 보안 22/22, HWP/HWPX 실제 PDF 변환 |
| 메모리 | Google Monitoring memory/usage 샘플 평균의 관측 최대 약 1,123.8MiB. 순간 peak 또는 모든 문서의 상한을 입증한 값은 아님 |

Linux Job은 데이터 권한·Slack secret이 없는 검증 계정으로 실행했다. Job의 Slack API 테스트는 합성이며 위의 별도 실제 Slack 검증과 구별한다. 비공개 ingress 편집 테스트에서는 Google 인증 헤더와 앱 bearer를 분리했다. 아직 Slack embeds 설정을 전환한 검증은 아니다.

## 시작 지연과 보완

최초 TS 직접 실행은 요청 6.46초·시작 약 5.5초였다. 서버/Slack 의존성을 CJS로 번들링하고 Playwright를 변환 시점에 로딩하며, Slack 설치 검증과 저장소/큐 초기화를 병렬로 수행했다. 최신 시작 로그는 process uptime 2.06~2.47초, 인증 연결 초기화 472~587ms다.

정상 가동 요청은 0.8~1.0초다. 수동 0→auto 복원은 라우팅 복원 도중 인스턴스가 준비될 수 있으므로 0.805초 응답을 자연 콜드 스타트 증거로 사용하지 않는다. 자연 축소 뒤 첫 요청의 3초 기준은 전환 전 추가 확인 대상이다.

멘션이 file_shared보다 먼저 단일 worker 슬롯을 잡은 경우 슬롯을 반환해 나중 공유 알림이 먼저 처리될 수 있게 했다. 저장소 장애를 권한 거절로 삼아 이벤트를 버리지 않고 503으로 재시도를 요구한다. entity details 중복 이벤트도 공유 메타데이터로 차단한다.

## 이미지·증적·후속

- Linux smoke digest: `sha256:56b633397d9dc96525d44ca6337222dabbfc00c9981bec861339c5b941542ec3`.
- SDK 초기 연결 보완 release digest: `sha256:c20dc0ca7a3780a1e7e4b6252b369f4a3d5f4c6c7099fdbea6a644a42e6cc03b`.
- 비공개 `.cache/validation/`의 cloud-native-tests, cloud-slack-probe, cloud-editor-probe, cloud-studio-probe, cloud-studio-edited.png, cloud-metrics, cloud-cold-probe 기록을 보관한다.
- 운영 로컬 서버 health는 200, 기존 임시 HTTPS는 확인 시 응답하지 않았다. 로컬 서버·기존 DB와 Slack manifest는 변경하지 않았다.
- Stage 12: 이전 adapter와 dry-run 준비, 최종 일관된 스냅샷, 기존 카드/설정 보존, Slack 주소 전환·embeds 수용. 자연 콜드 스타트와 이전 검증을 마치기 전 실제 연결을 변경하지 않는다.
