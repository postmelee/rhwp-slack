# Task #34 최종 보고 — 첫 저장의 잘못된 변경 감지 해결

GitHub Issue: [#34](https://github.com/postmelee/rhwp-slack/issues/34) · M010 · 3단계

## 작업 요약

커서 위치가 파일에 기록되는 시점 때문에 본문을 더 편집하지 않았는데도 첫 저장이 실패했다. 커서 기록·파일 내보내기·상태 캡처를 하나의 동기 작업으로 묶고 실제 바이트 해시를 검사한다. 재시도와 업로드 중 추가 편집 보호는 유지했다. 정상 네트워크와 로컬에서 모두 재현돼 네트워크 장애와 무관한 원인으로 확인했다.

## 변경 파일과 영향

| 경로 | 변경 | 영향 |
|---|---|---|
| studio/vite.config.ts | Slack 전용 저장 snapshot hook | 공개 Studio/host 연동 |
| src/editor/save-snapshot.ts | 실제 파일 bytes/state 검증 | 저장·복구 다운로드 |
| src/editor/save.ts | 공통 snapshot 사용 | 첫 저장, 기존 재시도 보호 유지 |
| tests/viewer/save.spec.ts | 한글 붙여넣기·커서 이동, 해시 불일치 회귀 | HWP/HWPX |

## 문서 위치 검증

수행계획의 plans/working/report/orders 위치와 실제 산출물이 일치한다. 제품 정본 문서·API·엔진 변경은 없다.

## 전후 비교

| 지표 | 변경 전 | 변경 후 |
|---|---|---|
| HWP 한글 붙여넣기 후 커서 이동·첫 저장 | 실패, 추가 클릭 필요 | 첫 클릭 성공 |
| HWPX 동일 회귀 | 통과 | 통과 |
| 저장 회귀 | 기존 3개 | 6개 통과 |
| 실제 Slack 합성 HWP | 첫 실패 후 재시도 성공 | 첫 클릭 후 HWP/PDF/PNG 생성 |

## 검증 결과

| 수용 기준 | 결과 |
|---|---|
| 독립 원인 재현 | OK — raw hash와 caret hook 실행 순서·전후 epoch/seq/hash 대조 |
| 첫 저장·바이트 무결성 | OK — 실제 저장 bytes 재파싱, mismatch 업로드 0건 |
| 추가 편집/재시도 보호 | OK — dirty 유지 및 동일 요청·bytes 재사용 |
| 통합 | OK — typecheck, viewer 32, security 53, Slack 95, unit 10, conversion 9 |
| 공개 앱 수용 | OK — Pages 배포, 새 편집 세션, Slack 결과 PNG 직접 확인 |

단계 근거: [원인](../working/task_m010_34_stage1.md), [구현](../working/task_m010_34_stage2.md), [배포·수용](../working/task_m010_34_stage3.md).

## 잔여 위험과 후속

- upstream 0.8.6 고정 overlay의 앵커가 변경되면 build가 실패하도록 기존 검사를 유지한다.
- OS/입력기 모든 조합은 미검증이다. HWPX 실제 Slack 수동 저장은 이번에 반복하지 않았고 자동 회귀로 확인했다.
- 내부 rhwp-pro의 Cloud Run 정적 편집기에는 배포하지 않았다. 공개 앱은 Pages 수정본을 사용한다.
- #5 실제 채널 공유 해제/다른 사용자 권한 철회, #4 Marketplace 자료·설치 요건은 별도다.

## 진행 승인

동일 스레드의 순차 진행 지시와 기존 push/CI/PR/검토 후 병합 승인을 적용한다. CI 최종 결과와 리뷰는 PR에 기록하고 성공한 head만 병합한다.
