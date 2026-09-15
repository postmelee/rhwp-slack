# AGENTS.md

본 저장소에서 작업하는 모든 코딩 에이전트(Codex, Claude Code 등)가 따르는 운영 규칙. 매 턴 시스템 프롬프트로 적재되므로 항상 필요한 정책·제약·인덱스만 둔다. 절차 상세는 매뉴얼·SKILL로 분리한다.

## 프로젝트 개요

rhwp-slack은 rhwp를 활용해 Slack 안에서 HWP/HWPX 문서를 열고 PDF와 PNG로 변환하는 비공개 프로젝트다. 기본 문서 보기는 PDF 미리보기이며, 편집은 Slack Work Objects embeds에 연결하는 자체 호스팅 rhwp-studio로 분리한다. `/rhwp` 명령어와 메시지 메뉴로 PDF, 첫 페이지 썸네일, 전체 또는 지정 페이지 PNG를 제공한다. 전체 페이지 PNG는 페이지별 이미지와 ZIP으로 전달한다.

## 하이퍼-워터폴 핵심 규칙

이 프로젝트는 **하이퍼-워터폴** 방법론을 적용한다. 에이전트의 기본 동작(빠른 실행, 자율 수정)과 충돌하므로 반드시 숙지한다. 상세: [`agent_code_hyperfall_rule_conflict.md`](mydocs/manual/agent_code_hyperfall_rule_conflict.md).

- 소스 수정 전 반드시 작업지시자 승인 요청
- 작업은 GitHub Issue 기준으로 추적
- 새 기능, 버그 수정, 구조 변경은 `이슈 -> 브랜치 -> 오늘할일 -> 계획서 -> 구현 -> 검증 -> 최종 보고서 -> PR` 순서 절대 생략 금지
- 각 단계 완료 후 승인 없이 다음 단계 진행 금지
- 범위가 불명확하거나 기존 작업과 충돌할 가능성이 있으면 먼저 확인
- 사용자나 다른 작업자가 만든 변경은 되돌리지 않음
- 이슈 close는 작업지시자 승인 후 또는 PR merge 확인 후에만 수행
- 문서 수정은 기존 내용을 먼저 읽고 필요한 부분만 수정하며, 불가피할 때만 내용을 추가
- 제품/사용자/기여자/외부 통합/API/아키텍처/로드맵 문서를 생성, 이동, 수정할 때는 수행계획서에 문서 위치 판단을 기록하고 승인받음
- `mydocs/manual`은 대상 프로젝트 제품 문서 위치가 아니며, 공식 문서 루트(`docs/`, `specs/`, `site/`, `website/`, `adr/` 등)는 대상 프로젝트가 별도 task에서 명시적으로 선택
- 작업 완료 후 다음 작업에 필요하지 않은 로컬/원격 부산물은 정리
- PR merge와 이슈 close 후에는 `devel`로 돌아오고, 더 이상 필요 없는 `local/task{번호}` 브랜치와 임시 worktree를 정리

**승인 간주 조건**: 작업지시자가 같은 스레드에서 "계속 진행", "다음 단계 진행"처럼 명시 지시한 경우에만 해당 단계 승인으로 간주한다.

## 명명 규칙

- 마일스톤: `M{버전}` (예: M100=v1.0.0, M05x=v0.5.x). 문서 파일명은 `m{숫자}` 소문자 (예: `m100`)
- 브랜치: `local/task{이슈번호}` (작업), `publish/task{이슈번호}` (`devel` 대상 PR 게시용)
- 커밋 메시지:
  - 기본형: `Task #{번호}: 내용`
  - 단계: `Task #{번호} Stage {N}: 내용`
  - 하위 단계: `Task #{번호} [Stage {N.M}]: 내용`
  - 보고서 묶음: `Task #{번호} Stage {N} + 최종 보고서: 내용`
- 문서 파일명: `task_{milestone}_{이슈번호}{_impl|_stage{N}|_report}?.md`. 신규 문서는 마일스톤 포함 형식 강제. 상세: [`document_structure_guide.md`](mydocs/manual/document_structure_guide.md)
- 모든 문서는 이 저장소에 선택된 Hyper-Waterfall locale로 작성한다.

## 핵심 강제 규칙 (변경 전 매뉴얼 확인 필수)

- Slack 전용 Studio는 이전 문서 복구·자동 저장·최근 문서·문서 이력의 영속 기록을 비활성화하고 현재 편집의 undo/redo·dirty 상태는 유지한다.
- 명령어 이름은 `/rhwp`로 유지한다. 사용자 페이지 번호는 1부터 시작한다.
- rhwp 엔진은 별도 의존성으로 사용하고, 원본 엔진 저장소와 이 앱의 변경을 분리한다.
- Slack 토큰, 서명 키, 사용자 원본 문서와 변환 산출물은 Git에 커밋하지 않는다.
- 문서 접근 권한은 보기와 변환 요청마다 확인하고 워크스페이스 간 문서와 캐시를 분리한다.
- 실제 Slack embeds 실행 검증과 로컬 단위 테스트를 구분한다. 배포형 앱의 embeds 이용 조건은 출시 전에 공식 문서로 확인한다.
- 제품 소스, 공식 문서 위치, 엔진 버전과 검증 명령은 도입 후 별도 제품 task의 수행계획서에서 확정한다.

## 필수 참조 문서

- [`README.md`](README.md) — 프로젝트 개요, 초기 설정, 빌드
- [`mydocs/manual/document_structure_guide.md`](mydocs/manual/document_structure_guide.md) — `mydocs/` 폴더 역할, 문서 파일명, 외부 PR 폴더 정책, Skills 위치 정책
- [`mydocs/manual/task_workflow_guide.md`](mydocs/manual/task_workflow_guide.md) — 타스크 진행 15단계, 커밋 메시지 규칙, 작업 시간 규칙
- [`mydocs/manual/git_workflow_guide.md`](mydocs/manual/git_workflow_guide.md) — 브랜치 정책, Git 다이어그램, 메인테이너/컨트리뷰터 워크플로우
- [`mydocs/manual/pr_process_guide.md`](mydocs/manual/pr_process_guide.md) — 외부 기여 PR 검토
- [`mydocs/manual/agent_code_hyperfall_rule_conflict.md`](mydocs/manual/agent_code_hyperfall_rule_conflict.md) — 하이퍼-워터폴과 에이전트 기본 동작 충돌 규칙
- 프로젝트 고유 필수 문서는 첫 제품 task의 문서 위치 판단 후 등록한다. 도입 시점에는 추가 문서가 없다.

## Agent Skills

하이퍼-워터폴 절차의 정형 시점은 SKILL로 분리한다. 진실 원천은 `mydocs/skills/`이며, Codex(`.agents/skills`)와 Claude Code(`.claude/skills`)는 심볼릭 링크로 동일 본문을 인식한다. 상세: [`document_structure_guide.md`](mydocs/manual/document_structure_guide.md) 의 "Agent Skills 위치 정책".

## 작업 규칙

- 작업 시간의 시작과 종료는 작업지시자가 결정한다. 에이전트가 임의로 작업 종료를 제안하거나 시간을 한정하지 않는다.
