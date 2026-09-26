# #48 최종 보고서 — cross-origin 테스트 종료 대기

GitHub Issue: [#48](https://github.com/postmelee/rhwp-slack/issues/48)
마일스톤: M010

## 작업 요약
- 대상 이슈 #48, 3단계.
- main CI에서 편집·저장 assertion 이후 static server 종료가 멈추는 문제를 수정했다.
- 테스트 context 전체를 먼저 닫고 receiver·runtime·frontend를 중첩 finally로 정리한다.

## 변경 파일 목록과 영향 범위
| 경로 | 변경 요약 | 영향 범위 |
|---|---|---|
| `tests/viewer/cross-origin.spec.ts` | context 우선 정리와 미완료 연결 회귀 | 테스트만 |
| #48 계획·단계·최종 보고서, 오늘할일 | 재현·검증 기록 | 내부 작업 문서 |

## 문서 위치 검증
제품·API 문서 변경은 해당 없음. 계획의 위치 판단과 같이 `mydocs/plans`, `working`, `report`, `orders`에만 기록했다.

## 변경 전·후 정량 비교
| 지표 | 변경 전 | 변경 후 |
|---|---|---|
| 동일 context의 다른 페이지가 응답을 기다리는 회귀 | 연결 close 관측 false로 실패 (9.8s) | 정상/미완료 조건 각각 3회, 6 passed (30.9s) |
| static server 종료 | 원래 main CI에서 약 84초 대기 후 timeout | 로컬 반복 6회 0.04–0.08ms |
| test timeout | 90초 | 90초 유지 |
| Playwright 전체 결과 | 기존 32건 | 33 passed, 기존 expected failure 1건 포함 |

서로 다른 환경의 종료 시간은 관측값이며 성능 보장으로 해석하지 않는다.

## 검증 결과
| 수용 기준 | 결과 |
|---|---|
| 수정 전 결함 검출 | OK — Stage 1 커밋의 회귀에서 연결 미해제 assertion 실패 |
| 수정 후 동일 조건·정상 경로 | OK — Stage 2 소스에서 6회 통과 |
| 기능·타입 회귀 | OK — typecheck, 전체 viewer 33건, 변환 9건 |
| Linux CI | OK — 소스 `52145099d987e752519b5c57e1db6a7f503547fb`, [36116663740](https://github.com/postmelee/rhwp-slack/actions/runs/36116663740) viewer·container success |
| 변경 범위 | OK — 제품 코드·배포·태그·test timeout 변경 없음 |

### 단계별 검증 결과
- [Stage 1](../working/task_m010_48_stage1.md): 원래 CI trace와 재현 가능한 합성 반례.
- [Stage 2](../working/task_m010_48_stage2.md): 수정·반복·전체 로컬 검사.
- [Stage 3](../working/task_m010_48_stage3.md): Linux CI와 PR 준비.

## 잔여 위험과 후속 작업
### 잔여 위험
원래 CI 소켓의 정확한 종류는 미확정이다. 보조 페이지 회귀는 동일 context의 연결 소유권을 검증하며 원래 상황과 동일하다고 주장하지 않는다. 기존 Studio mixed-format undo 예상 실패 및 Firefox/Slack HTTP3 문제는 이 변경으로 해결했다고 주장하지 않는다.

### 후속 작업 후보
PR 검토·병합 후 devel/main의 실제 통합 SHA CI를 확인한다. 기존 v0.1.0-beta.1과 운영 배포는 변경하지 않았다.

## 작업지시자 승인 요청
사용자의 수정·재검증 지시에 따라 PR까지 준비한다. 병합·추가 릴리즈는 후속 승인 범위다.
