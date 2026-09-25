# Task #5 Stage 2 — 채널별 무효화

## 변경

`sharedChannels`가 file_unshared 처리 시 최신 files.info를 조회한다. 채널이 없는 이벤트를 임의 채널이나 전역 삭제로 해석하지 않는다. 불완전한 shares, has_more_shares/skipped_shares, 목록과 share 레코드 불일치, API 실패는 변경 전에 거절한다. 이 결과는 연결 무효화 범위에만 쓰고 요청 권한은 기존 authorizeFile로 계속 검사한다.

CloudEvents → CloudApplication.invalidate와 단일 서버 receiver → Preparations/Documents.invalidate가 같은 보존 채널 집합을 소비한다. 루트/수정본 카드·세션·observed와 로컬 준비 bytes를 해당 채널에 한정해 무효화한다. file_deleted는 전역 무효화를 유지한다. 로컬 조회 실패는 replay claim을 반환하므로 같은 이벤트의 재전달을 수용할 수 있다. 로컬의 기존 즉시 ACK 특성은 유지하므로 API 장애 시 Slack 자동 재전달을 보장하지 않는다. Cloud의 durable event는 실패 후 재시도한다.

## 검증

집중 회귀 11/11, Slack 95/95, security 53/53, typecheck 통과. 공개 채널 제거/비공개 채널 유지와 반대 경우, 루트/수정본·유효 세션, bytes 정리, 관측 기록, 지연·중복·누락 이벤트, 재공유 새 요청, 수정본만 삭제, 전역 삭제, API 장애·불완전 공유를 확인했다. 수정 전 6개 실패에서 수정 후 6개 통과를 확인하고 2개 재공유 경계를 추가했다.

합성 Bolt/API 검증이며 실제 Slack 공유 해제 및 설치 제거·재설치는 아직 실행하지 않았다. 운영 서버에 아직 배포하지 않았다.
