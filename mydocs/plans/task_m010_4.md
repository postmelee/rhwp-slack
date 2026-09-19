# Task #4 — 외부 설치와 조직 자체 호스팅 준비

GitHub Issue: [#4](https://github.com/postmelee/rhwp-slack/issues/4)
마일스톤: M010
작성: 2026-09-20

## 목적

현재 워크스페이스 운영을 유지하면서 설치형 베타, 조직 자체 호스팅, Marketplace 제출을 구분해 준비한다. README를 실제 기능과 배포 상태에 맞추고 외부 사용자가 필요한 준비와 한계를 알 수 있게 한다.

## 배경

사용자가 원본/API 지연 개선과 함께 README 정리·외부 워크스페이스 사용·Marketplace 제출·조직 자체 호스팅 안내를 요청했다. 현재 PR #12는 OPEN이며 C(Pages 프로그램 + Cloud Run API)는 운영에 반영됐지만 devel에는 아직 통합되지 않았다. 이 브랜치는 origin/devel cef52f1에서 분리했다. C 배포 재현은 #12 통합 후 고정 릴리스에서 검증한다.

현재 config와 Cloud receiver는 단일 teamId와 botToken에 고정되어 있다. Firestore의 workspace namespace가 있어도 OAuth 설치·설치별 토큰 선택·삭제 처리가 완성된 것은 아니다. Slack 공식 문서(2026-09-20 조회)는 미등재 배포를 시험 사용에 허용하지만 distributed embeds는 초대제로 제한한다. Marketplace 제출에는 최소 10개 활성 워크스페이스 설치가 필요하다.

## 범위

### 포함

- README의 기능·명령·저장/처리 위치·설치 지원 상태 정리.
- hosted beta와 조직 소유 Slack 앱/클라우드 자체 호스팅 안내.
- 외부 배포 embeds 승인 여부와 미승인 편집 경로 결정.
- 후속 #16의 OAuth 설치/재설치/삭제, workspace별 토큰·설정·큐·메타데이터 격리 설계 및 검증 결과 연결. 구현은 #16에서 독립 추적.
- 공개 설치/개인정보/지원 페이지, 심사 자료·출시 조건 준비.

### 이번 준비 단계에서 실행하지 않는 항목

- 기존 내부 앱의 Public Distribution 활성화, 외부 모집 메시지 전송, 실제 Marketplace 제출.
- 저장소 공개 전환이나 라이선스 임의 지정, 운영 사양·예산·권한 변경.
- API 성능 소스 변경: #8 후속 별도 성능 이슈에서 추적; #3은 운영 비용 관찰로 유지.

## 설계 방향

- 내부 운영 앱과 외부 베타 앱을 구분한다. 외부 배포 승인 조건이 내부 편집 동작에 영향을 주지 않게 한다.
- 사용자가 외부 베타의 PDF·PNG는 Slack, 편집은 브라우저 방식과 조직용 자체 호스팅 안내를 선택했다. 기존 내부 앱의 embeds는 유지한다.
- 토큰 선택은 검증한 설치/워크스페이스 정보를 기준으로 하고, 비동기 task에도 workspace 식별자를 보존한다. 인증 세션·채널 관리자·할당량·삭제 범위를 함께 격리한다.
- 현재 단일 워크스페이스 자체 호스팅을 먼저 재현한다. Enterprise Grid 조직 전체 설치는 별도 검증 범위다.
- 공개 README/사이트는 검증된 기능과 실제 설치 가능 여부만 표시한다. 비공개 소스는 공개 사이트와 별개이며 접근·배포 조건을 먼저 정한다.

## 문서 위치 판단

| 파일 | 분류 | 독자 | 위치 | 대안 | 이유 |
|---|---|---|---|---|---|
| README.md | 제품 개요 | 사용자/배포자 | 루트 | docs/index.md | 첫 진입점 |
| docs/installation.md | 설치 경로 | 사용자 | 기존 docs/ | mydocs/manual/ | 제품 설치 문서 |
| docs/self-hosting.md | 자체 호스팅 | 조직 관리자 | 기존 docs/ | 운영 task 보고서 | 환경 독립 안내와 실행 검증 한계를 함께 제공 |
| docs/marketplace.md | 출시 준비 | 운영자/기여자 | 기존 docs/ | README 전체 포함 | 제출 요건과 지원 상태를 분리 |
| 본 계획·단계 보고 | 작업 산출물 | 작업자 | mydocs/ | docs/ | 제품 기능과 작업 상태 구분 |

## 예상 변경 파일

- README.md, docs/installation.md, docs/self-hosting.md, docs/marketplace.md
- 후속: src/server/config.ts, src/server/cloud/{main,receiver,application,tasks,sessions}.ts, 설치 저장소와 OAuth routes, 보안/Slack 테스트
- mydocs/orders/20260920.md, 본 계획서, 구현계획서, 단계 보고와 최종 보고

## 잠정 단계

1. **배포 조건·문서 준비**: 공식 요건, 실제 코드 차이, README·설치 안내. 로컬 링크/manifest 생성 명령 확인. 현재 단계.
2. **#16 설치 및 workspace 격리 결과 연결**: OAuth/state/설치별 토큰과 해제, 현재 내부 운영 보존. 최소 두 workspace의 교차 접근 거부 테스트.
3. **#16 외부 설치 수용과 #4 자체 호스팅 재현·실제 베타 확보**: 사용자 선택 편집 경로, 초대형 베타, 깨끗한 조직 계정에서 재현 가능한 배포. 예산/큐 공정성/작업량 제한 검증.
4. **심사 준비·제출**: 공개 지원/개인정보/삭제/설치 페이지, 기능/권한 설명, 활성 설치 10개, embeds 승인 또는 검증된 대체 경로. 요건 충족 후 실제 제출 결과 별도 기록.

## 검증 계획

- Stage 1: 링크 검사, README 명령과 실제 구현 대조, bootstrap/HTTPS Slack manifest 생성 확인. 아직 설치 버튼·Terraform·원클릭 배포가 있다는 표현 금지.
- Stage 2: state 변조/재사용, token 혼용, 파일/세션/큐/설정 workspace 간 접근, uninstall/reinstall 및 진행 중 작업 차단 테스트.
- Stage 3: HWP/HWPX 열기/같은 스레드 저장/PDF/PNG/권한 회수, 두 workspace 독립 설치, 새 GCP/Cloudflare 계정 설치/업데이트/복구.
- Stage 4: 공식 조건 재확인, 검증 계정/영상/권한 사유·지원 연락처 확인. 제출과 승인을 별도 상태로 기록.

## 리스크와 결정 사항

- 외부 embeds 초대는 일반 Marketplace 승인과 별개다. 미등재 배포에서도 내부 전용 예외가 계속 적용된다고 가정하지 않는다.
- 조직별로 별도 생성한 앱 설치 수를 중앙 배포 앱의 설치 실적으로 합산하지 않는다.
- 소스는 private이고 프로젝트 라이선스가 없다. 공개 문서만으로 불특정 조직에 소스 재배포 권리를 부여하지 않는다.
- 최소 인스턴스 1 비용과 사용량 증가를 고려한다. 외부 베타는 무제한 사용을 약속하지 않는다.
- 실제 외부 배포와 비용/비밀값 범위 확대는 구현·검증 후 검토 가능한 상태에서 확정한다.

## 참고

- [Slack 배포](https://docs.slack.dev/app-management/distribution/)
- [embeds 조건](https://docs.slack.dev/messaging/work-objects-embeds/)
- [활성 설치 요건](https://docs.slack.dev/changelog/2026/09/01/slack-marketplace-install-requirement/)
- [심사 요구사항](https://docs.slack.dev/slack-marketplace/slack-marketplace-app-guidelines-and-requirements/)
