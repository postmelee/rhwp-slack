# Task #4 Stage 13 — 베타 모집·지원 창구

## 반영 범위

사용자가 README 베타 모집과 Discussions 지원 구성을 승인했다. Discussions를 활성화하고 [모집 공지 #55](https://github.com/postmelee/rhwp-slack/discussions/55)를 Announcements에 게시한 뒤 전체 Discussions 상단에 고정했다. Q&A는 답변 채택 가능한 사용 질문 창구, Ideas는 기능 제안 창구로 연결한다. GitHub의 기본 카테고리를 유지하며 중복 Wiki를 만들지 않는다.

README 상단에는 초기 10개 팀 모집 목표·설치·피드백 경로를 추가했다. 목표와 실제 활성 조직 수를 구분하여 0/10 같은 미확인 실적은 게시하지 않았다. CONTRIBUTING과 이슈 선택 화면에도 공개 질문·제안·재현 가능한 버그·비공개 지원·보안 신고 경로를 구분했다. GitHub 계정 없이 설치·이메일 지원을 이용할 수 있다.

## 검증

- GitHub GraphQL: Discussions 활성화, Q&A의 isAnswerable=true, 공지 본문이 작성본과 일치함을 확인.
- GitHub 실제 화면: 공지 Markdown 표시와 Unpin discussion 상태를 확인해 상단 고정을 검증.
- GitHub Markdown API(mode=gfm): README의 굵게 표시 정상, 본문에 남은 ** 없음. README/CONTRIBUTING 상대 링크 대상 존재 확인.
- git diff --check 통과. 앱 코드와 웹 배포 자산은 변경하지 않아 앱 실행 검증·Pages 재배포는 수행하지 않는다.

## Marketplace 보류

현재 연락처·지원·보안 이메일은 실제 화면에서 저장을 확인했고 전용 영상 URL 저장 오류는 남아 있다. 본문에는 영상·설치 화면 링크가 저장되어 있다. 알림 채널 지정 비교는 수행하지 않았다. 모집 기간에는 양식 변경·제출 시도를 멈추며, 실제 10개 이상 활성 워크스페이스 확보 후 저장 오류 해결·필수 정보·자동 검사·설치부터 제거까지 검증 증거를 다시 확인한다. 모집 인원 달성만으로 심사 조건 전체 충족 또는 제출 완료를 선언하지 않는다. #4는 열어 둔다.
