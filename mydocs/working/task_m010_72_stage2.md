# Task #72 Stage 2 — 파일 조회 사유와 안내

원본 files.info 호출 출처의 WeakMap에 고정 11종 사유를 부착한다. 파일 삭제 응답, 찾을 수 없거나 접근 불가, 가시성, 권한, scope, 인증, rate-limit, 서비스 일시 장애, 응답 한도, 전송, 기타로 구분한다. file_not_found는 삭제 단정 금지. retry 정책과 별개다.

진단은 allowlist만 영속 복원한다. 복원 데이터는 fresh source 출처로 인정하지 않아 안내 게시 권한이 생기지 않는다. 기존 receipt·설치·tenant·channel/bot 접근 확인 후 plain-text 상태 안내만 갱신한다. 첨부·metadata·파일명·URL·Slack 원문은 추가하지 않는다.

source 안전 분류/진단 테스트와 실제 API 모형→application→durable notice 19개 회귀 통과. 독립 리뷰에서 차단 결함 없음. 타입·unit15·security83·viewer38·conversion10 통과. 실제 Slack 검증 및 배포는 Stage3에서 구분 기록한다.

## 메타데이터 검증 사유 보완
기존 invalid_source_metadata를 ID·이름·지원 확장자·크기 정보·20 MiB 한도·다운로드 주소 누락·원본 변경으로 나누었다. 허용/거절 predicate와 순서는 유지한다. 상세 안내는 기존 userMessage 및 안전 카드 상태 갱신에 적용하며 카드 없는 자동 prepare에 새 메시지 게시 계약을 만들지는 않는다. 해당 prepare의 진단은 상세화되지만 안내 대상이 없으면 기존 skip을 유지한다.

타입 및 공개 Slack270/security84, 운영 Slack288/security85 재검증 통과. 이후 메타데이터 안내 통합 회귀4개 추가, 안내 전체23개 통과. 첫 실제 API 후보 시험은 합성 HWPX→PDF/PNG 정상, 최종 metadata 보완 후보를 별도로 다시 검증한다. 보완 전 이미지는 배포하지 않았다.
