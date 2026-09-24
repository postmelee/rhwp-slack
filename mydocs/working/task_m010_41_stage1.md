# #41 Stage 1 — 영속 버튼 접수와 잠금 해제 후 발행

## 목적과 산출물
서명 검증한 버튼의 최소 입력을 CloudEvents로 인계했다. 권한 조회·진행 안내는 worker에서 실행하고, 카드 잠금 안에서 예약/상태만 기록한 뒤 잠금 밖에서 Cloud Tasks를 발행한다. 재전달은 입력 ID로 동일 예약을 재사용한다. 공유/보기 권한 검사는 유지한다.

변경: cloud receiver/events/application/tasks/telemetry, document-message, Slack 회귀 2개 파일.

## 본문 변경 정도
제품 문서 변경 없음. 접수 표시 및 처리 위치 변경, 문서 변환 엔진/권한 범위 유지.

## 검증 결과
- `npm run typecheck` PASS.
- `npm run test:slack` 101/101 PASS.
- `npm run test:security` 56/56 PASS.
- 21개 관련 application/receiver 검사 PASS.
- 독립 이전 코드 origin/devel(8396e1c)에서 동일 HTTP 회귀: Slack API를 응답 대기시킬 때 약 3.1초 후 404로 실패. 수정 후 200이며 접수 시 Slack API 호출 0회.
- 수정 전 사본의 dispatch 관련 검사는 새 API가 없어 실패했으므로 결함 재현 증거로 세지 않는다. 같은 예약 재전달·위조 메시지·다른 사용자·안내 실패·잠금 해제는 수정 후 경계 검사다.

## 잔여 위험 / 다음 단계
Cloud Run 콜드 스타트 및 Cloud Tasks 장애 자체의 지연은 코드만으로 3초 이내를 보장하지 않는다. 실제 서비스와 Linux CI 검증은 Stage 2/3에서 수행한다. 영속 인계 전에는 성공 응답하지 않는다.

## 승인 근거
사용자의 ‘그렇게 수정을 진행해줘’와 기존 공개 서비스 수정·검증 지시에 따라 계속 진행한다.
