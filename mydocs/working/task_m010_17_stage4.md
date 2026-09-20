# Task #17 Stage 4 — 종료 지연 재현

PR #19 실행 35486142804는 reopen-revision 890ms 뒤 stop-receiver 82,332ms로 90초 제한에 걸렸다. 앞선 편집/저장/PDF 단계는 모두 성공했다.

설치된 Bolt 5.1.0 ExpressReceiver.stop은 Node HTTP server.close 콜백을 기다린다. Node 24.21.0에서 실제 receiver를 시작하고 net.connect로 요청 없는 TCP 연결을 열면 200ms가 지나도 stop은 미완료였다(bytesRead/bytesWritten 0). 소유 클라이언트를 destroy한 직후 총203ms에 종료됐다. browser context는 test finally 이후 자동 정리되므로 서버 종료와 정리 순서가 뒤집혀 있다.

수정: smoke finally에서 browser context를 먼저 닫고 receiver, runtime을 순서대로 닫는다. 앞 정리 실패 시에도 뒤 정리를 시도한다. timeout·제품 서버·요청 처리·컨테이너 제한은 유지한다.

한계: 위 TCP 재현은 종료 대기 메커니즘 증거다. 기존 CI 실패 소켓의 정확한 출처/상태를 기록한 자료는 없으므로 모든 최초 실패를 동일 원인으로 단정하지 않는다. 동일 조건 실제 smoke와 Linux CI로 수정 결과를 검증한다.

## Stage 5 로컬 결과

Node24.21.0 typecheck 통과. 수정한 실제 Studio 편집/저장/PDF/재열기 smoke 3회 연속 모두 통과(총18.9초). context 종료 245/233/248ms, receiver 종료는 세 번 모두 1ms 미만. 로컬에서는 이미 준비된 동일 dist와 의존성을 재사용했으며 최종 Linux CI는 소스에서 별도 빌드한다.
