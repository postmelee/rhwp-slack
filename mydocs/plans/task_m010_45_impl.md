# #45 채널 첫 사용 개선 수행계획

GitHub Issue: https://github.com/postmelee/rhwp-slack/issues/45
마일스톤: M010

## 목적과 배경
초대 후 설정 없는 채널에서 파일 업로드가 무응답인 문제를 해결한다. 사용자는 초대 자동 감지, 홈 설명, /rhwp 설정 진입의 실행을 승인했다.

## 범위와 설계 방향
공개 Cloud Run 경로에 채널 최초 초기화를 추가한다. Slack에서 봇의 실제 동일 워크스페이스 채널 참여를 검증한 뒤 atomic create로 auto를 저장한다. 명시적 기존 정책은 보존한다. member_joined_channel에서 자기 봇 참여만 처리한다. file_shared/app_mention의 선행 도착에도 동일 초기화를 사용한다. 초기화 안내는 채널별 한 번 게시한다. /rhwp 빈 인자는 설정을 열고 기존 인자는 유지한다. 홈 설명은 업로드→PDF/PNG→브라우저 편집→저장을 설명한다.

## 문서 위치 판단
기존 site 사용자 안내와 README만 최신 흐름으로 맞춘다. 작업 기록은 mydocs/plans, working, report의 기존 위치를 사용한다. 엔진·embed·영상·Marketplace 최종 제출은 제외한다.

## 예상 변경 파일
src/server/settings.ts, cloud/receiver.ts, cloud/events.ts, receiver.ts, tests/slack, Slack manifest, 기존 사용자 안내.

## 단계와 검증
1. 정책 초기화·참여 이벤트 및 순서 역전 처리: 기존 off/mention 보존, 권한 거절, 중복 검증.
2. 홈·설정·명령·문서 안내: 빈 /rhwp, 기존 인자 및 설정 권한 검증.
3. 통합 검사·배포·실제 채널 검증: typecheck, Slack/security, 서버와 Slack 설정 반영, 보고.

## 리스크
초대 이벤트 중복과 업로드 순서 역전은 atomic 초기화로 처리한다. 기존 관리자가 비활성화한 채널은 재활성화하지 않는다. 내부 단일 서버 자동 활성화는 별도 경로이므로 이번 공개 서버와 구분한다.

## 승인
2026-09-24 사용자의 “그렇게 진행해줘. 이 세가지를 진행” 지시 범위로 실행한다.
