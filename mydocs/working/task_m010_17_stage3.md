# Task #17 Stage 3 — Linux CI 결과

Source `7e73d295ccbe485aec30b5518dc8709f2e9dec50`, run [35474873676](https://github.com/postmelee/rhwp-slack/actions/runs/35474873676). viewer/container 모두 통과. 서버-only와 Studio 결합 컨테이너의 제약은 기존 그대로다.

| 실제 단계 | 소요 |
|---|---:|
| 원본 준비 | 4 ms |
| 원본 열기 | 2,697 ms |
| 수정본 저장 | 1,231 ms |
| 수정본 PDF 완료 대기 | 2,849 ms |
| 수정본 재열기 | 967 ms |
| receiver/runtime 정리 | 각 1 ms |
| Playwright 테스트 전체 | 8.6 s |

결합 컨테이너 memory.peak 1,169,678,336 bytes(약 1.09 GiB), oom/oom_kill 0, CPU throttling 0. 서버-only peak 733,515,776 bytes(약 0.68 GiB). 이 값은 이번 실행의 합성 테스트 측정이며 과거 실패 시점의 자원 상태나 운영 Cloud Run 수치가 아니다.

`container-synthetic-evidence` artifact를 실제 다운로드해 cgroup.json과 합성 HWP/PDF/PNG/screenshot을 확인했다. 이번 실행은 성공하여 retain-on-failure trace는 생성되지 않았다. 실패 artifact 업로드 분기는 구조상 보강했으나 강제 시간 초과는 실행하지 않았다. 최초 90초 초과 원인은 trace 소실로 미확정이며, 재발 시 새 step/trace로 조사한다.
