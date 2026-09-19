# Task #17 Stage 2 — 컨테이너 증거 보존

CI의 합성 Slack 테스트에만 전용 `/evidence` bind mount를 추가했다. Playwright 출력은 이 경로에 남기며 `always()` artifact 업로드로 실패 후에도 회수한다. smoke의 `finally`에서 cgroup memory.events/peak/cpu.stat을 기록한다. 서버-only 검사도 실패 시 cgroup stdout을 남긴다.

검증: `node --check scripts/container-smoke.mjs`, `git diff --check` 통과. nonroot/read-only/network none/2 CPU/4GiB/90초 제한 유지. 실제 Linux 결과 및 artifact 회수는 최종 CI에서 확인한다. 프로세스 자체가 OOM kill된 경우 finally 실행까지 보장하는 것은 아니다.
