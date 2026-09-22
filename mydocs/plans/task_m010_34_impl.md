# Task #34 구현계획

수행계획: [task_m010_34.md](task_m010_34.md) · M010

## 단계와 산출물

| 단계 | 작업 | 검증 |
|---|---|---|
| 1 | 기존 Studio SDK에서 한글 입력 후 상태·export 비교, caret 저장 훅 추적 | epoch/seq/hash와 산출 바이트 비교, 원인 재현 |
| 2 | 상태와 저장 바이트가 같은 시점의 결과를 나타내도록 수정, 실제 입력 회귀 추가 | 수정 전 실패/후 성공, HWP/HWPX·동시 편집·재시도 보호 |
| 3 | 통합 검증·PR·배포·합성 문서 수용 | typecheck, save/viewer·보안, CI, 실제 Slack 저장 |

문서 위치는 수행계획과 동일하다. 각 단계는 `mydocs/working/task_m010_34_stageN.md`, 최종은 `mydocs/report/task_m010_34_report.md`에 기록한다. 단계 종료 시 소스와 보고서를 함께 커밋한다. 비해당 전체 Rust 검증은 실행하지 않는다.

기존 UI 오류를 숨기지 않고 실제 변경 보호를 유지한다. 저장소에 없는 일반 SDK 기능을 가정하지 않으며 필요한 Slack 전용 연동은 기존 overlay 안에서 구현한다. 사용자의 순차 진행 승인을 적용한다.
