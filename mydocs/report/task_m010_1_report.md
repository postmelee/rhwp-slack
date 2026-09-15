# Task #1 통합 결과 — Studio 임베드와 Slack PDF 연결

GitHub Issue: [#1](https://github.com/postmelee/rhwp-slack/issues/1)
마일스톤: M010 / 상태: 구현 인계, 실제 수용 잔여 항목 있음

## 작업 요약

6개 Stage와 Stage 3.1·6.1에서 자체 호스팅 rhwp-studio, Slack 권한·문서 세션, PDF 공유, 편집본 저장, Linux 실행 경계를 구현했다. 웹 편집/저장과 데스크톱 문서 열기/PDF 첨부를 실제 비공개 채널에서 확인했다. Stage 6.1에서 수정본 재편집·카드 썸네일·동일 댓글의 PDF 연결을 검증했다. 전체/지정 PNG·ZIP 명령의 완료를 의미하지 않는다.

## 변경 파일 목록과 영향 범위

| 경로 | 변경 요약 | 영향 범위 |
| --- | --- | --- |
| src/editor/, studio/ | 공식 Studio SDK·비영속 overlay·직접 편집 진입 | 호스트·편집 UI |
| src/server/ | 명령, 서명/권한, Work Objects, 일회용 세션, 새 편집본 저장 | Slack 연결 |
| src/conversion/ | 실제 PDF, 별도 파서/브라우저, 시간/자원·환경변수 경계 | 변환 |
| scripts/, Dockerfile, compose.yaml, .github/workflows/ | 고정 빌드·자동 검사·Linux runtime·설치 도구 | 개발/배포 |
| tests/ | 합성 문서·실제 Studio/PDF·합성 API·보안 회귀 | 검증 |
| README.md, docs/, mydocs/ | 현재 동작·출처·설정·수행 증거 | 문서 |

## 문서 위치 검증

| 파일 | 계획된 위치 | 실제 위치 | 결과 | 근거 |
| --- | --- | --- | --- | --- |
| README·development·architecture·dependencies | README.md, docs/ | 동일 | OK | 승인된 구현계획서 위치 유지 |
| 계획·단계·통합 보고서 | mydocs/plans/, working/, report/ | 동일 | OK | 새 제품 문서 루트 없음 |

## 변경 전·후 정량 비교

| 지표 | Stage 6 | Stage 6.1 |
| --- | --- | --- |
| 정상 자동 검사 | 64 | 67 |
| 기존 expected-failure | 1 | 1 (해결되지 않음) |
| Linux 제한 실행 검증 | Node 48 + 브라우저 1 | Node 51 + 브라우저 1 성공 |
| 실제 Slack | 웹 편집/저장·데스크톱 열기 | 수정본 재열기/재저장·두 댓글, 웹/데스크톱 PDF 링크 내부 열람 |

## 검증 결과

| 수용 기준 | 결과 |
| --- | --- |
| Studio 직접 편집, PDF 모드 화면 제거 | OK — 로컬 HWP/HWPX 및 실제 Slack 기본 카드 진입 |
| 문서 복구·자동 저장·최근 문서·영속 이력 금지 | OK — 저장소 호출/재열기/설정 경로 자동 검사 |
| 권한·서명·세션·저장 재시도·변환 | OK — 정상 67개; 실제 기본 API 연결 확인. 실제 권한 회수·장애 주입은 별도 미검증 |
| 편집본 새 파일과 PDF | OK — 웹 실제 저장 성공 안내, 원본 재다운로드 해시 일치; revision bytes와 PDF 연계는 자동 통합 검사 |
| Linux 빌드/실행 | OK — non-root/read-only/4 GiB/egress 없음 합성 API smoke |
| 수정본을 카드 스레드에 누적 | OK — 실제 첫 수정본 재열기→둘째 수정본 저장 뒤 동일 스레드의 두 댓글 확인; PDF는 각 댓글에 갱신; 최상위/기존 부모·공유 지연·응답 유실 회귀 검사 |
| 실제 Slack 데스크톱 입력/저장 | 사용자 확인 — 정상 동작 답변 및 저장 완료 화면. 저장 위치 문제는 카드 스레드 누적으로 수정 |
| PDF 링크로 Slack 내부 열람 | OK — URL action 제거. 실제 웹·macOS 데스크톱에서 PDF 링크 클릭으로 기본 뷰어 두 페이지 확인 |
| PNG·썸네일·ZIP | 첫 페이지 카드 썸네일 완료; 단독/전체/지정 PNG·ZIP 명령은 후속 |
| 원격 CI/PR/운영 배포 | 미실행 |

### 단계별 검증 결과

- [Stage 1](../working/task_m010_1_stage1.md): core 경로의 역사적 기록, 이후 Studio로 교체.
- [Stage 2](../working/task_m010_1_stage2.md): Studio 전체 UI·비영속 문서·실제 편집.
- [Stage 3](../working/task_m010_1_stage3.md): PDF 기본 열람/편집 분리. Stage 3.1에서 별도 PDF UI를 제거한 변경은 구현계획서와 해당 단계 기록을 따른다.
- [Stage 4](../working/task_m010_1_stage4.md): Slack receiver·명령·접근 검사.
- [Stage 5](../working/task_m010_1_stage5.md): Work Objects·세션·저장·revision PDF.
- [Stage 6](../working/task_m010_1_stage6.md): 실제 API 보정·Linux·실제 Slack 검증과 잔여 항목.
- [Stage 6.1](../working/task_m010_1_stage6.1.md): 수정본 카드·썸네일·PDF 내부 열람과 실제 두 번 저장 검증.

## 잔여 위험과 후속 작업

### 잔여 위험

임시 HTTPS·메모리 세션·Chromium 내부 sandbox·최대 입력 자원, 엔진 B-003/B-004를 Stage 6 보고서와 제품 문서에 명시했다. 실제 Slack 권한 회수·장애·모바일·배포형 앱 이용 조건의 전체 수용이 남았다.

### 후속 작업 후보

1. 남은 실제 Slack 권한 회수·장애·모바일 수용 확인.
2. 정식 HTTPS 운영 환경과 별도 변환 worker 경계.
3. B-002 `/rhwp` 첫 페이지 이미지 단독 명령·전체/지정 PNG·ZIP.

## 작업지시자 승인 요청

실제 수용 잔여 항목을 보완하고 이 결과를 검토한 뒤 PR 게시 절차로 진행한다. 현재 이슈는 진행중으로 유지한다.
