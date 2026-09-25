# #45 구현·검증 보고

## 구현 결과
초대 자동 변환 초기화, 기존 정책 보존, 홈 설명과 설정명 개선, /rhwp 설정 진입. 커밋 f98ed82. 공개 Cloud Run 경로가 자동 활성화 대상이며 기존 단일 서버는 명시적 설정을 유지한다.

## 검증
Typecheck 통과, Slack 104/104, security 56/56. 최초 업로드가 참여 이벤트보다 먼저 오는 경우, 중복 초대, 기존 off/mention 보존, 일반 사용자 참여 무시, 봇 미참여 거절, 빈 명령 설정 진입과 관리자 제한을 검사했다. 배포용 서버 번들 생성도 성공했다.

## 배포와 실제 검증 (2026-09-24)
- 삭제된 `rhwp-slack-cloud-run` 작업 폴더에 공식 Google Cloud CLI 586.0.0을 재설치하고 사용자 로그인을 복구했다.
- PR #46: https://github.com/postmelee/rhwp-slack/pull/46. Linux viewer/container 검사 모두 통과.
- Cloud Build `eae3d747-c18a-4fa1-bd6f-07e2fb912c37` 성공. 이미지 digest `sha256:8329574336e29b510235333a4462ab205f688be1b5f7e8e1bf1704b02763b7eb`.
- worker `rhwp-beta-worker-00010-2gv`, ingress `rhwp-beta-ingress-00015-2bx`에 각각 트래픽 100%. 사양·환경 설정·IAM 유지, 내부 서비스 revision 유지. 로컬 증적 `/private/tmp/task45-deployment.json`.
- Slack 앱 A0C329NJ85C에 `member_joined_channel` 저장. 이벤트 화면 저장은 `mpim:read`를 자동 추가해 즉시 이벤트 및 해당 권한을 원복했다. 이후 앱 명세에 기존 8개 bot scope를 명시한 채 이벤트만 추가하여 저장 성공. 새로고침한 명세에서 이벤트 존재와 `mpim:read` 부재를 확인했다. 일반 대화 읽기 권한 및 그룹 DM 읽기 권한은 추가하지 않았다.
- `/rhwp` 설명과 usage hint를 채널 설정용으로 저장하고 새로고침한 명세에서 확인했다.
- Alhanguel에서 Sherlock Holmes 계정으로 새 공개 검증 채널 `rhwp-onboarding-check`(C0C3PPW3FC7)를 만들고 rhwp를 초대했다. 별도 설정·파일 업로드 없이 안내 메시지 `1790241799.599779`가 게시됐고 서버에 `mode:auto, onboarding:true, welcomed:true`가 기록됐다.
- 같은 계정의 앱 홈에서 새 3단계 사용 설명과 일반 사용자용 관리자 문의 안내를 확인했다.

## 브라우저 편집·저장 검증 (2026-09-25)

검증 코드 기준은 `f98ed82`, 검증 시작 시 PR head는 `91ebc68252b02f62b9f1ea50de9e088455ccc7e3`이다. 이후 이번 변경은 문서뿐이다. 기존 설치 재승인과 새 합성 문서를 사용했다. 브라우저의 기존 로그인 세션을 사용했으며 새 OpenID 동의 화면을 거치는 검증으로 확대 해석하지 않는다.

- 원본: [Alhanguel test의 새 합성 HWP](https://alhanguel.slack.com/archives/C0C2ZCX509K/p1790321135986669). 별도 채널 설정 없이 2페이지 PDF와 PNG 두 장이 생성됐다.
- Chrome / Sherlock Holmes: 에이전트가 실제 카드로 열기, `Chrome release 20260925 ` 삽입, 저장, Slack 산출물 확인, 편집본 재열기를 수행했다. [편집본 1](https://alhanguel.slack.com/archives/C0C2ZCX509K/p1790321373964119?thread_ts=1790321135.986669&cid=C0C2ZCX509K)의 문구·제목·표·2페이지를 확인했다.
- Firefox / melee 관리자: 사용자가 직접 열기·`Firefox 저장 확인` 삽입·저장·재열기를 수행하고 17:17 KST 화면으로 확인했다. [편집본 2](https://alhanguel.slack.com/archives/C0C2ZCX509K/p1790324178623379?thread_ts=1790321135.986669&cid=C0C2ZCX509K)에 HWP `F0C49DR53NH`, PDF `F0C4CGZFY7Q`, PNG `F0C4J5WFHJ8`·`F0C4J5XS1E0`가 존재한다. 재열기 화면에 입력 문구·제목·표·2페이지와 변경 없음 상태를 확인했다. 계정은 사용자 설명 및 첨부 Slack 메뉴 기준이며 편집기 화면 자체에는 사용자 ID가 표시되지 않는다.
- 두 브라우저의 일반적인 문서 열기 → 편집 → 저장 → PDF/PNG 생성 → 저장본 재열기 검증은 통과했다. Firefox UI 자동 조작의 한계는 사용자 직접 검증으로 보완했다.

### 검증 한계

- 이번 화면에는 브라우저 버전·실제 협상된 HTTP 프로토콜이 표시되지 않는다. 기존 Firefox의 특정 Slack 쿠키/HTTP3 문제에 대한 모든 사용자 재발 방지를 입증한 것은 아니다.
- 재사용한 Firefox 설치 callback 탭에서 설치 미완료 화면이 보였던 원인은 확정하지 않았다. 앞서 기록한 설치 성공과 이후 실제 편집 성공을 이 오류의 원인 규명으로 대신하지 않는다.

## 설정 진입 실제 확인 (2026-09-25)

사용자가 Alhanguel 관리자(melee) 계정으로 `test` 채널에서 인자 없는 `/rhwp`를 실행하고 “설정 창이 열림”으로 확인했다. 설정 저장·정책 변경은 요청하거나 검증하지 않았다. 빈 명령의 설정 진입은 자동 테스트와 사용자 실제 확인 모두 통과했다.

## 남은 작업

- PR 검토 및 릴리즈 통합 준비. 영상 녹화와 Marketplace 최종 제출은 이번 이슈 범위 밖이다.
