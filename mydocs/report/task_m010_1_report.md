# Task #1 통합 결과 — Studio 임베드와 Slack PDF 연결

GitHub Issue: [#1](https://github.com/postmelee/rhwp-slack/issues/1)
마일스톤: M010 / 상태: 내부 워크스페이스 배포·수용 및 PR 통합 완료

## 작업 요약

Stage 1~12와 하위 단계에서 자체 호스팅 rhwp-studio, Slack 권한·문서 세션, PDF 공유, 편집본 저장, Linux 실행 경계를 구현했다. 웹 편집/저장과 데스크톱 문서 열기/PDF 첨부를 실제 비공개 채널에서 확인했다. Stage 6.1에서 수정본 재편집·카드 썸네일·동일 댓글의 PDF 연결을 검증했다. Stage 6.3에서 업로드 자동 감지·멘션·같은 스레드의 3→10페이지 기본 이미지 갤러리를 구현하고 실제 HWPX 댓글·Studio·수정본 누적을 확인했다. 전체/지정 PNG·ZIP 명령의 완료를 의미하지 않는다.

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

| 지표 | Stage 6 | Stage 6.1 | Stage 6.3 |
| --- | --- | --- | --- |
| 정상 자동 검사 | 64 | 67 | 80 |
| 기존 expected-failure | 1 | 1 (해결되지 않음) | 1 (유지) |
| Linux 제한 실행 검증 | Node 48 + 브라우저 1 | Node 51 + 브라우저 1 성공 | Node 62 + 브라우저 1 성공 |
| 실제 Slack | 웹 편집/저장·데스크톱 열기 | 수정본 재열기/재저장·두 댓글, 웹/데스크톱 PDF 링크 내부 열람 | HWP/HWPX 자동/멘션·단일 댓글 확장·갤러리·Studio·수정본 누적 |

## 검증 결과

| 수용 기준 | 결과 |
| --- | --- |
| Studio 직접 편집, PDF 모드 화면 제거 | OK — 로컬 HWP/HWPX 및 실제 Slack 기본 카드 진입 |
| 문서 복구·자동 저장·최근 문서·영속 이력 금지 | OK — 저장소 호출/재열기/설정 경로 자동 검사 |
| 권한·서명·세션·저장 재시도·변환 | OK — 정상 80개; 실제 기본 API 연결 확인. 실제 권한 회수·장애 주입은 별도 미검증 |
| 편집본 새 파일과 PDF | OK — 웹 실제 저장 성공 안내, 원본 재다운로드 해시 일치; revision bytes와 PDF 연계는 자동 통합 검사 |
| Linux 빌드/실행 | OK — non-root/read-only/4 GiB/egress 없음 합성 API smoke |
| 수정본을 카드 스레드에 누적 | OK — 실제 첫 수정본 재열기→둘째 수정본 저장 뒤 동일 스레드의 두 댓글 확인; PDF는 각 댓글에 갱신; 최상위/기존 부모·공유 지연·응답 유실 회귀 검사 |
| 실제 Slack 데스크톱 입력/저장 | 사용자 확인 — 정상 동작 답변 및 저장 완료 화면. 저장 위치 문제는 카드 스레드 누적으로 수정 |
| PDF 링크로 Slack 내부 열람 | OK — URL action 제거. 실제 웹·macOS 데스크톱에서 PDF 링크 클릭으로 기본 뷰어 두 페이지 확인 |
| PNG·썸네일·ZIP | 같은 스레드의 기본 3페이지/추가 10페이지 native 갤러리 완료; 단독/전체/지정 PNG·ZIP 명령은 후속 |
| 자동 업로드·멘션 | file_shared·app_mention으로 같은 원본 스레드에 댓글; 일반 채널 history 권한 없음 |
| 원격 CI/PR | 아래 최종 통합 검증에 기록 |
| Cloud Run 내부 워크스페이스 시험 운영 | 2026-09-17 고정 주소 전환, 상세 Stage 12 보고서 |

### 단계별 검증 결과

- [Stage 1](../working/task_m010_1_stage1.md): core 경로의 역사적 기록, 이후 Studio로 교체.
- [Stage 2](../working/task_m010_1_stage2.md): Studio 전체 UI·비영속 문서·실제 편집.
- [Stage 3](../working/task_m010_1_stage3.md): PDF 기본 열람/편집 분리. Stage 3.1에서 별도 PDF UI를 제거한 변경은 구현계획서와 해당 단계 기록을 따른다.
- [Stage 4](../working/task_m010_1_stage4.md): Slack receiver·명령·접근 검사.
- [Stage 5](../working/task_m010_1_stage5.md): Work Objects·세션·저장·revision PDF.
- [Stage 6](../working/task_m010_1_stage6.md): 실제 API 보정·Linux·실제 Slack 검증과 잔여 항목.
- [Stage 6.1](../working/task_m010_1_stage6.1.md): 수정본 카드·썸네일·PDF 내부 열람과 실제 두 번 저장 검증.

- [Stage 6.3](../working/task_m010_1_stage6.3.md): 자동 업로드·멘션·같은 댓글의 3→10페이지 Slack 갤러리·실제 수용 및 UI 제약.

## 잔여 위험과 후속 작업

### 잔여 위험

임시 HTTPS·메모리 전용 세션은 Stage 10~12에서 고정 Cloud Run·Firestore로 보완했다. Chromium 내부 sandbox·최대 입력 자원과 엔진 B-003/B-004는 기존 제약으로 유지한다. 실제 Slack 권한 회수·장애·모바일·배포형 앱 이용 조건의 전체 수용이 남았다.

### 후속 작업 후보

1. 남은 실제 Slack 권한 회수·장애·모바일 수용 확인.
2. Cloud Run 한 달 비용·안정성 관찰과 다른 동료 계정 수용.
3. B-002 `/rhwp` 첫 페이지 이미지 단독 명령·전체/지정 PNG·ZIP.

## 마무리 승인과 범위

사용자가 현재 이슈의 기존 작업을 마무리하고 성능·복구 개선은 별도 이슈에서 순서대로 진행하도록 승인했다. PR 검증·통합 후 이슈를 종료한다. 아래 미완료 항목은 후속 이슈에 명시하며 초기 배포 완료와 구분한다.


## Stage 10~12 운영 전환 추가 보고 (2026-09-17)

문서 bytes는 Slack에 두고 Cloud Run ingress/worker와 Firestore 메타데이터·Cloud Tasks를 적용했다. 워크스페이스 설정·카드16개를 포함한 기록23개를 이전했다. 공개 ingress에도 서명·문서 권한을 확인하고 worker는 비공개다. 1GiB/min1 ingress와 4GiB/min0 worker를 운영하며 할인 전 Cloud Run 월20,749원 차단, 크레딧 적용 후 전체 프로젝트13,833원 알림을 구분한다. 정확한 차단 시점·총 결제액 상한을 보장하지 않는다.

실제 비공개 테스트 채널에서 사용자 파일 첨부→자동 스레드 미리보기→완료 체크→Slack 내부 PDF 두 페이지→내부 Studio 글자 입력→원본 스레드 새 편집본과 PDF/PNG를 확인했다. 티켓 재사용 거절·무서명 및 익명 문서 차단·중복 저장 방지는 실제 Cloud 환경에서 확인했다. 공개 rhwp-전체 채널의 HWPX 자동 변환도 확인했다. 과거 임시 주소 카드4개는 내부 열기 실패 후 무효화 상태가 확인되어 열기 성공으로 판정하지 않았다. 다른 동료 계정의 직접 검증은 남았다. 상세 설정·증거·한계는 [Stage 12](../working/task_m010_1_stage12.md)와 [운영 문서](../../docs/cloud-run.md)를 따른다.

Marketplace 콘솔은 공개 배포 미설정으로 Get Started가 비활성화되어 있다. OAuth 다중설치, 최소10활성 workspace 설치, 외부 배포용 embeds pilot, 개인정보·지원·심사 자료를 준비하기 전에는 제출 완료로 표시하지 않는다. 원격 PR·merge·이슈 종료는 시행하지 않았다.


## 최종 마무리 — 2026-09-17

### 최종 수용과 관측

- 현재 운영 이미지: `sha256:70cd59bef220f5fb69081e65288ac57bd0811566b2387d893919cc5b523dcd1d`. ingress `00009-btj` 1CPU/1GiB/min1/max1, worker `00006-m9v` 2CPU/4GiB/min0/max1. 작업 동시1. 이번 문서 정리는 배포 이미지나 요금을 바꾸지 않는다.
- 공개·비공개 두 채널의 HWP/HWPX 자동 감지, 원본 스레드 카드, Slack 기본 PDF·이미지 갤러리, 내부 Studio 편집 및 같은 스레드 수정본 저장은 Stage 12.2에서 실제 확인했다.
- 사용자가 22:19 KST 제공한 화면과 답변으로 **동료 계정의 Studio 문서 열기 성공**을 추가 확인했다. 앞 절의 ‘동료 직접 수용 남음’은 해당 시점 기록이며 열기 항목은 이번 확인으로 갱신한다. 동료의 수정본 저장·모바일·전체 권한 회수 시나리오까지 완료한 것은 아니다.
- 69페이지 실문서 작업은 22:17:58→22:19:02 약64.6초 실패, 22:19:13→22:20:17 약64.5초 실패, 22:20:37→22:21:50 약73.0초 성공으로 관측됐다. 최종 PDF/PNG ready·69페이지·작업 done을 조회했다. 첫 두 번의 상세 예외가 없어 60초 변환 제한은 의심 원인이며 확정 원인은 아니다. 재시도 중에도 ‘PDF 준비 실패’를 보인 UI 문제는 #2로 이관한다.
- 같은 파일의 로컬 변환은 14.833초였다. 이 값은 다운로드/권한/Slack 업로드를 포함하는 서버 작업 약73초와 직접 비교하지 않는다. #2에서 단계별 계측과 동일 사양 비교를 먼저 수행한다.
- 이전 주소 카드4개는 무효화 상태로 **실제 열기 성공 미검증**이다. 원본 부모 메시지 삭제·file_unshared/file_deleted의 원인을 분리해야 하며 접근을 강제로 복원하지 않았다.

### 후속 이슈와 완료 범위

| 이슈 | 미완료/후속 범위 | 이번 종료와 관계 |
| --- | --- | --- |
| [#2](https://github.com/postmelee/rhwp-slack/issues/2) | 동일 사양 성능 계측·복구 상태·변환/업로드 최적화·편집 초기화 안내 | 사용자 승인한 다음 구현 |
| [#3](https://github.com/postmelee/rhwp-slack/issues/3) | 한 달 비용·안정성·동료 저장/모바일/권한 회수 수용 | 배포 완료와 운영 관찰 완료 구분 |
| [#4](https://github.com/postmelee/rhwp-slack/issues/4) | OAuth 다중설치·Marketplace·embeds 외부 배포 조건 | 내부 workspace 서비스와 공개 출시 구분 |
| [#5](https://github.com/postmelee/rhwp-slack/issues/5) | 채널별 공유 해제와 전역 무효화 범위 | 코드상 잠재 문제를 독립 재현/수정 |
| [#6](https://github.com/postmelee/rhwp-slack/issues/6) | 단독 썸네일·전체/지정 PNG·ZIP 명령 | 기존3→10페이지 갤러리와 구분 |

기존 엔진의 HWPX 이미지/형식 간 조판 차이와 expected-failure는 해결되지 않았으며 서버 최적화에서 출력 품질을 완화하지 않는다. 원본 엔진 변경은 이 앱의 완료 범위에 포함하지 않는다. 비용 차단은 지연 집계되며 다른 서비스/총 청구액의 절대 상한을 보장하지 않는다.

### 최종 통합 검증

- 제품 source `aedd428` 동일 상태에서 typecheck, unit7/7, Slack69/69, security22/22가 통과했다. `npm run test:viewer`의19건은 정상18건과 기존 expected-failure1건이다. 합계 정상116건이며 known-failure를 해결 성과에 포함하지 않는다.
- 첫 새 빌드는 upstream fetch 지연으로 중단했다. 기존 `studio.tar`를 pinned SHA-256과 대조한 뒤 재사용했다. 이후 Studio 캐시 심볼릭 링크 때문에 overlay의 경로 비교가 적용되지 않아 dirty-state 검사 등이 실패했다. 링크만 독립 복사본으로 교체하고 다시 빌드한 최종 검사가 통과했다. 제품 코드를 바꾸거나 기대값을 완화하지 않았다.
- 로컬 Node24.15.0에서 실행했다. 고정 Node24.21.0/Linux·읽기 전용 컨테이너의 재검증은 PR CI에서 수행한다. 이전 Linux 검증은 각 Stage 기록이며 최종 PR CI와 구분한다.
- `git diff --check` 통과. Git 추적 파일에 실제 문서/토큰/캐시가 없음을 확인했다. 추적 HWP/HWPX는 합성 fixture 두 개뿐이다.
- 접근·다운로드·업로드·편집 라우트·Cloud Tasks/Firestore 경계를 자체 코드 검토했다. 워크스페이스/채널/사용자 확인, Slack 다운로드 호스트 제한, 세션 재사용 차단, 작업 lease·영수증 보존을 확인했다. 발견된 공유 해제 과잉 무효화와 재시도 UI/편집 진입 복구는 #5/#2에서 추적한다. 독립 외부 보안 감사로 보고하지 않는다.
- [PR #7](https://github.com/postmelee/rhwp-slack/pull/7)은 head `0b18002`의 [PR CI](https://github.com/postmelee/rhwp-slack/actions/runs/35230542681)와 [push CI](https://github.com/postmelee/rhwp-slack/actions/runs/35230422261)에서 viewer/container 모두 통과했다. 2026-09-17 23:03 KST `789972761719138f0274999ca0735d6e9aed7220`으로 merge하고 #1 종료를 확인했다. 운영 이미지와 사양은 변경하지 않았다.
