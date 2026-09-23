# Task #39 Stage 1 — 권한 철회 후 상태 확정

## 목적·산출물

CloudApplication.failed가 tenant와 task generation/lease를 검증한 뒤 먼저 실패 메타데이터를 저장한다. 정상 권한이면 기존 카드 갱신, access_denied이면 bot 채널 접근을 별도 검사한 고정 안내를 전송한다. 이 경로는 file_ids/metadata/URL/문서명을 보내지 않는다. 기존 문서 권한 검사는 그대로 유지한다. 상태용 채널 검증은 기존 authorizeChannel의 조직·공유·봇 참여 검사를 공통 함수로 분리했다.

## 검증

- 수정 전 새 회귀: expected failed, actual pending으로 FAIL.
- 수정 후 cloud-application 13/13 PASS. 탈퇴 후 게시 완료 0, 고정 안내에 file_ids/metadata/URL 없음, 재시도 거절, 재참여 후 동일 카드 ready.
- 봇 탈퇴·외부 공유·채널 off·Slack 오류에서도 내부 failed 보존. 다른 tenant 작업 거절 및 옛 작업이 새 recovery 세대를 덮어쓰지 않음.
- npm run typecheck PASS, test:slack 97/97, test:security 56/56. 최초 포트 바인딩 EPERM은 샌드박스 제한으로, 허용된 로컬 실행에서 재검증했다.
- 마지막 변경은 상태 안내 후 반응 상태 갱신이며 타입·관련 13개 테스트를 다시 통과했다.

## 한계·다음 단계

이미 Slack에 공유된 파일은 유지한다. 진행 중 전송이 철회 시점에 즉시 취소되는 것을 보장하지 않으며, 기존 완료·공유 직전 권한 검사로 새 공유를 차단한다. 실제 Linux 및 배포 검증은 Stage 2에 남긴다. 사용자 수정 진행 승인으로 이어간다.
