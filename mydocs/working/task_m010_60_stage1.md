# Task #60 Stage 1 — 変환 실패 프로토콜

고정 failureReason 및 페이지/SVG bytes의 수치만 검증하여 전달한다. stderr·원시 예외는 계속 폐기한다. worker 종료 후 failure IPC를 전달하고 부모가 폐기할 시간을 두어 EOF가 구체적인 실패 이유를 가리지 않게 했다. fallback 종료는 5초다.

보안 경계 테스트 2개와 typecheck 통과. 실제 변환 경로 검증은 Stage 3에서 수행한다.
