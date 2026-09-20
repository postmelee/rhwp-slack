# Task #17 — 컨테이너 시간 초과 조사·관측 보강 결과

## 결론

PR #15의 최초 시간 초과는 원인 미확정이다. 성공한 재실행을 원인 수정으로 간주하지 않는다. 향후 재발을 진단할 단계별 시간과 실패 artifact 보존을 구현했다. 제품 코드·서버 사양·90초 제한은 바꾸지 않았다.

## 변경·검증

- [Stage 1](../working/task_m010_17_stage1.md): 테스트 단계·시간 계측, typecheck.
- [Stage 2](../working/task_m010_17_stage2.md): CI output mount, always upload, finally cgroup.
- [Stage 3](../working/task_m010_17_stage3.md): Linux viewer/container 통과, 합성 flow 8.6초, artifact 실제 회수.

## 한계·후속

과거 trace는 삭제되어 복구할 수 없다. 현재 실행에서 OOM/CPU throttling은 관측되지 않았으나 과거 원인을 배제하지 못한다. 재발하면 #17에 실패 step·trace·cgroup 근거를 추가해 실제 원인을 수정한다. 따라서 이 이슈를 ‘원인 해결’로 닫지 않는다.

## 2026-09-20 재발 후 수정 결과

이전 결론은 당시 관측 보강 완료를 설명한다. 이후 #19의 반복 실패를 종료 단계로 좁혀 수정했다. [후속 증거](../working/task_m010_17_stage4.md): 클라이언트가 요청 없는 TCP 연결을 열고 있으면 Bolt 종료가 기다리는 것을 재현했고, smoke가 소유한 브라우저 context를 수신 서버보다 먼저 닫도록 변경했다. 제품 요청 강제 종료나 timeout 상향은 없다.

TypeScript 통과, 로컬 실제 편집/저장/PDF/재열기3회 통과. 소스9ebd7e9의 Linux CI35490296410은 viewer/container 첫 실행 모두 통과. container stop-receiver는 수정전 실패82,332ms에서 수정후3ms. 최초 #15의 삭제된 trace를 복원한 것은 아니며 정확한 과거 소켓 유형은 미확정이다.
