# Task #72 Stage 2 — 파일 조회 사유와 안내

원본 files.info 호출 출처의 WeakMap에 고정 11종 사유를 부착한다. 파일 삭제 응답, 찾을 수 없거나 접근 불가, 가시성, 권한, scope, 인증, rate-limit, 서비스 일시 장애, 응답 한도, 전송, 기타로 구분한다. file_not_found는 삭제 단정 금지. retry 정책과 별개다.

진단은 allowlist만 영속 복원한다. 복원 데이터는 fresh source 출처로 인정하지 않아 안내 게시 권한이 생기지 않는다. 기존 receipt·설치·tenant·channel/bot 접근 확인 후 plain-text 상태 안내만 갱신한다. 첨부·metadata·파일명·URL·Slack 원문은 추가하지 않는다.

source 안전 분류/진단 테스트와 실제 API 모형→application→durable notice 19개 회귀 통과. 독립 리뷰에서 차단 결함 없음. 타입·unit15·security83·viewer38·conversion10 통과. 실제 Slack 검증 및 배포는 Stage3에서 구분 기록한다.
