# Task #13 Stage 3 — 회귀 검사와 비교 보고

Issue: [#13](https://github.com/postmelee/rhwp-slack/issues/13).
구현계획: [task_m010_13_impl.md](../plans/task_m010_13_impl.md).

## 검증 대상

Source SHA: `30e7f0d86e89b9212e0a2231dc781737499fdb48`.
Node 24.21.0, macOS ARM64. 이후 변경은 문서뿐이다.

| 명령 | 결과 |
|---|---|
| `npm run typecheck` | 통과 |
| `npm test` | 9/9 |
| `npm run test:slack` | 86/86 |
| `npm run test:security` | 30/30 |
| `git diff --check` | 통과 |

최초 unit 실행의 로컬 loopback bind가 sandbox `EPERM`으로 차단되어 해당 환경 제한을 해소한 뒤 세 suite를 재실행했다. 위 결과는 재실행 결과이며 실패를 제외해 집계한 것이 아니다. 전체 125개 검사 통과, skip 0개다. 원시 출력은 ignored `.cache/task13/{unit,slack,security}.log`에 둔다.

## 전후 비교와 보안 경계

[Stage 2](task_m010_13_stage2.md)의 동일 합성 입력 비교에서 원본 Slack 논리 호출9→6, 수정본15→12, metadata get5→4다. 각 경로 전후3회 모두 동일했다. 네트워크나 실제 클라우드 요금 측정은 아니다.

다운로드 도중 멤버 제거·수정본 root 공유 해제·카드 무효화·파일 내용 변경을 차단하는 회귀 검사와 동시 API context 분리·실패 상태·로그 비밀값 배제 검사를 포함한다. 프로그램 자산·폰트·WASM·변환 출력은 바꾸지 않았다.

## 문서 변경과 잔여 검증

`docs/architecture.md`에 계측 계약과 요청 내 재사용 경계를 추가했다. 기존 인증·원본 전달·저장 API 계약을 보존한다. [최종 보고서](../report/task_m010_13_report.md)에 로컬 완료 범위와 Linux CI/후보 Cloud Run 측정 전 상태를 구분한다.

운영 C의 CPU·메모리·최소 인스턴스·예산·Slack 주소를 변경하지 않았다. 실제 시간/비용 비교는 PR #12 의존성 해결 및 후보 배포 검증 후 진행한다.
