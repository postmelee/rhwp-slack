# #48 구현 계획

GitHub Issue: https://github.com/postmelee/rhwp-slack/issues/48
마일스톤: M010

## 목적과 배경
main CI 36114378878의 기능 assertion은 통과했지만 close static server가 약 84초 기다린 뒤 90초 제한으로 실패했다. 뒤이어 Playwright context가 닫히자 서버 종료가 완료됐다. #17에서 적용한 연결 소유자 우선 정리 원칙을 cross-origin 테스트에 적용한다.

## 범위
테스트의 context 우선 종료, 나머지 자원 정리 보장, 미완료 연결 회귀, 로컬 반복 및 Linux CI. 제품 코드·운영 배포·기존 태그·timeout 기준은 변경하지 않는다.

## 설계 방향
page.close 대신 테스트 전용 context.close를 두 HTTP 서버보다 먼저 실행한다. cleanup은 중첩 finally로 모든 자원의 종료를 시도한다. 요청이 남은 실제 브라우저 조건을 회귀 검사에 포함한다. 원래 CI의 정확한 소켓 종류는 미확정이며 회귀용 동일 context의 보조 페이지 미완료 요청과 구분한다.

## 문서 위치 판단
제품 안내 변경 없음. 작업 기록은 기존 mydocs/plans, working, report, orders에 둔다.

## 예상 변경 파일
 tests/viewer/cross-origin.spec.ts 및 #48 작업 문서.

## 단계와 검증
1. trace와 미완료 요청 조건에서 수정 전 실패를 확인한다.
2. context 우선 종료·finally 정리 후 동일 조건 반복, typecheck와 viewer 검증.
3. Linux viewer/container CI, SHA 고정 보고와 PR 게시.

## 리스크
원래 실패의 소켓 종류와 합성 회귀 조건을 혼동하지 않는다. 실패 재실행 통과만으로 해결을 주장하지 않는다.

## 승인
사용자의 2026-09-25 “수정 후 재검증을 진행해줘” 지시에 따라 수정·재검증을 수행한다. 제품 배포와 태그 재발행은 제외한다.
