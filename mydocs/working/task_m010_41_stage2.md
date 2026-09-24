# #41 Stage 2 — 회귀와 Linux CI

GitHub Issue: [#41](https://github.com/postmelee/rhwp-slack/issues/41)

## 단계 목적
서명된 버튼 접수와 작업 발행 경계, 기존 문서 권한을 검증한다.

## 산출물
Stage 1의 소스 `2d6501ba778bc3cf5e345628adac722f192e0392`에 대한 자동 검증 결과. 추가 제품 소스 변경 없음.

## 본문 변경 정도 / 본문 무손실 여부
검증 기록만 추가했다. 엔진·제품 문서·권한 범위는 변경하지 않았다.

## 검증 결과
- `npm run typecheck`: PASS.
- `npm run test:slack`: 101/101 PASS.
- `npm run test:security`: 56/56 PASS.
- 느린 Slack API에 대한 동일 서명 HTTP 검사: 이전 8396e1c는 약 3.1초 후 404, 변경 후 200이며 접수 경로 Slack API 호출 0회.
- 다른 사용자 권한 확인, 중복 접수, 위조 message_ts 차단, 잠금 해제 후 발행, 발행 실패 후 같은 예약 재사용, 안내 실패 후 변환 완료를 검사했다.
- Linux push 및 PR의 container/viewer 모두 PASS: [push run](https://github.com/postmelee/rhwp-slack/actions/runs/35965120594), [PR run](https://github.com/postmelee/rhwp-slack/actions/runs/35965185779).
- 코드 검토: receiver → 영속 event → worker 권한 확인 → 카드 잠금/예약/접수 표시 → 잠금 해제 → dispatch 경로를 확인했다. 사용자·워크스페이스·메시지 식별 확인은 유지된다.

## 잔여 위험
Cloud Run 시작과 Cloud Tasks 자체 접수 지연은 남는다. Slack API 응답을 ingress에서 기다리지 않도록 한 범위의 개선이다. 장기 큐 장애·worker 전체 정지의 복구 보장은 이 검사에 포함하지 않는다.

## 다음 단계 영향
같은 SHA 이미지로 공개 ingress/worker에 배포하고 Alhanguel의 실제 표시를 확인한다.

## 승인 근거
사용자의 수정 진행 지시와 기존 CI·공개 배포 검증 승인에 따라 진행한다.
