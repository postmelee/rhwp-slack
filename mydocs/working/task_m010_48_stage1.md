# #48 Stage 1 — 종료 연결 소유권 회귀

GitHub Issue: [#48](https://github.com/postmelee/rhwp-slack/issues/48)
구현계획서: [task_m010_48_impl.md](../plans/task_m010_48_impl.md)

## 단계 목적
기능 검사 실패와 테스트 정리 실패를 구분하고, page만 닫는 정리의 한계를 검출한다.

## 산출물
- `tests/viewer/cross-origin.spec.ts`: 기존 정상 경로와 보조 페이지의 미완료 응답을 둔 경로를 각각 실행한다. 응답 본문 일부를 보내 navigation commit을 확인하고, 서버의 response close 이벤트로 연결 해제를 관찰한다.
- 수행·구현 계획서: 최종 회귀 조건을 동일 context의 보조 페이지 요청으로 명시한다.

## 본문 변경 정도 / 본문 무손실 여부
제품 코드는 변경하지 않는다. 기존 인증·토큰 전파 방지·편집·동일 스레드 저장 assertion을 유지한다.

## 검증 결과
- [원래 main CI](https://github.com/postmelee/rhwp-slack/actions/runs/36114378878)의 trace: 기능 assertion은 약 13.17초에 끝났고 static server close가 약 13.18초부터 대기했다. 90초 test timeout 이후 fixture context가 닫힌 약 96.90초에 server close도 끝났다. 실제 소켓 종류는 미확정이다.
- Node 24.21.0, macOS Chromium. `npx playwright test tests/viewer/cross-origin.spec.ts --grep 'pending context request' --trace on`: **수정 전 1 failed (9.8s)**. 기능 assertion 통과 후 `browser released pending request`에서 expected true / received false, 기본 poll 5초 제한으로 실패했다.
- 로그 `/private/tmp/task48-before-context-body.log`, trace `/private/tmp/task48-before-context-evidence/`, 수정 전 소스 `/private/tmp/task48-before-context.spec.ts` 보존. 임시 증거는 로컬 보조 자료이며 재실행 가능한 회귀 조건은 커밋한 테스트다.
- 개발 중 같은 페이지 keepalive probe는 page.close만으로 통과해 검출 증거에서 제외했다. 본문 없는 navigation probe의 timeout도 회귀 검출로 세지 않는다.

## 잔여 위험
보조 페이지는 연결 소유권의 합성 반례이며 원래 CI에서 동일한 페이지가 존재했다는 증거는 아니다.

## 다음 단계 영향
컨텍스트 우선 종료와 중첩 finally 후 같은 회귀를 반복한다. timeout을 늘리거나 assertion을 삭제하지 않는다.

## 승인
사용자의 수정·재검증 지시에 포함된 범위로 Stage 2를 진행한다.
