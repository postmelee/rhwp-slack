# #48 Stage 2 — context 우선 종료와 로컬 재검증

GitHub Issue: [#48](https://github.com/postmelee/rhwp-slack/issues/48)
구현계획서: [task_m010_48_impl.md](../plans/task_m010_48_impl.md)

## 단계 목적
브라우저 연결의 소유자를 서버보다 먼저 정리하고 실패 경로에서도 나머지 정리를 시도한다.

## 산출물
`tests/viewer/cross-origin.spec.ts`: page.close를 context.close로 바꾸고 receiver → runtime → static server 정리를 중첩 finally로 보장한다.

## 본문 변경 정도 / 본문 무손실 여부
제품 코드와 기존 기능 assertion, 90초 test timeout을 유지한다.

## 검증 결과
Node 24.21.0 / macOS Chromium, Stage 1 커밋 3f35917에 종료 수정 적용.

| 기준 | 명령·관측 | 결과 |
|---|---|---|
| 수정 전 실패한 연결 회귀와 정상 경로 | `npx playwright test tests/viewer/cross-origin.spec.ts --repeat-each=3 --trace on` | 6 passed (30.9s) |
| 종료 대기 해소 | 6개 trace의 context close 214–260ms, static server close 0.04–0.08ms | OK |
| 타입 | `npm run typecheck` | exit 0 |
| 전체 viewer | `RHWP_SOURCE_REPO=/Users/melee/Documents/projects/forks/rhwp npm run test:viewer` | exit 0; Playwright 33 passed (52.3s), conversion 9 passed |
| 기존 예상 실패 구분 | Studio mixed-format undo는 기존 `test.fail`로 유지 | 위 33건 중 1건은 예상 실패; 해결 주장 안 함 |
| whitespace | `git diff --check` | OK |

보조 자료: `/private/tmp/task48-after-repeat.log`, `/private/tmp/task48-after-repeat-evidence`, `/private/tmp/task48-typecheck.log`, `/private/tmp/task48-viewer.log`.

## 잔여 위험
원래 CI의 정확한 소켓 종류는 미확정이다. 이 회귀는 context가 보유한 연결을 남긴 상태에서도 정리가 완료되는 계약을 검증한다. 제품 UI·실제 Slack 로그인은 변경하지 않아 다시 조작하지 않았다.

## 다음 단계 영향
이 소스를 Linux CI에서 검증하고 최종 보고서·PR에 SHA와 결과를 고정한다.

## 승인
사용자의 수정·재검증 지시에 따라 Stage 3 원격 검증을 진행한다.
