# #45 진행 보고

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

## 남은 작업
- 기존 녹화 채널 `rhwp_slack`에서 실제 새 파일 자동 변환과 관리자 계정의 빈 `/rhwp` 모달 열기 확인을 사용자에게 요청했다. 현재 초대 흐름은 실제 검증 완료이며 파일 변환·관리자 모달은 이번 배포 후 미검증이다.
- 사용자 안내 Pages 반영 확인과 PR 검토 마무리. 영상 녹화와 Marketplace 최종 제출은 이번 이슈 범위 밖이다.
