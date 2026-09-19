# Task #17 — 컨테이너 시간 초과 조사·관측 보강 결과

## 결론

PR #15의 최초 시간 초과는 원인 미확정이다. 성공한 재실행을 원인 수정으로 간주하지 않는다. 향후 재발을 진단할 단계별 시간과 실패 artifact 보존을 구현했다. 제품 코드·서버 사양·90초 제한은 바꾸지 않았다.

## 변경·검증

- [Stage 1](../working/task_m010_17_stage1.md): 테스트 단계·시간 계측, typecheck.
- [Stage 2](../working/task_m010_17_stage2.md): CI output mount, always upload, finally cgroup.
- [Stage 3](../working/task_m010_17_stage3.md): Linux viewer/container 통과, 합성 flow 8.6초, artifact 실제 회수.

## 한계·후속

과거 trace는 삭제되어 복구할 수 없다. 현재 실행에서 OOM/CPU throttling은 관측되지 않았으나 과거 원인을 배제하지 못한다. 재발하면 #17에 실패 step·trace·cgroup 근거를 추가해 실제 원인을 수정한다. 따라서 이 이슈를 ‘원인 해결’로 닫지 않는다.
