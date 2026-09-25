# #48 Stage 3 — Linux CI와 PR 준비

GitHub Issue: [#48](https://github.com/postmelee/rhwp-slack/issues/48)
구현계획서: [task_m010_48_impl.md](../plans/task_m010_48_impl.md)

## 단계 목적
수정 소스를 원래 실패 환경과 같은 GitHub Actions Linux에서 검증한다.

## 산출물
- 수정 소스 SHA: `52145099d987e752519b5c57e1db6a7f503547fb`.
- [App checks 36116663740](https://github.com/postmelee/rhwp-slack/actions/runs/36116663740): viewer·container 성공.
- 최종 보고서와 오늘할일 갱신. 이 단계는 문서만 추가하며 검증한 소스를 변경하지 않는다.

## 본문 변경 정도 / 본문 무손실 여부
제품 코드·배포·태그·timeout 변경 없음.

## 검증 결과
`gh run view 36116663740 --repo postmelee/rhwp-slack --json status,conclusion,headSha,jobs`와 run log를 확인했다.

| 검증 | 결과 |
|---|---|
| viewer job | success, 2026-09-25 09:12:08 UTC 완료 |
| typecheck 및 unit/Slack/security | 성공; 각각 10/104/56 pass |
| Playwright 전체 / conversion | 33 passed (1.7m) / 9 pass; 기존 expected failure 1건 포함 |
| container job | success, 09:12:24 UTC 완료 |
| 제한된 컨테이너 실행 | PDF, 합성 Slack 저장·PDF 생성·재열기, release 이미지 빌드 성공 |
| 컨테이너 브라우저 흐름 | 1 passed (10.7s), context close 462ms → receiver 1ms → runtime 1ms |

로그는 `/private/tmp/task48-linux-ci.log`에 보조 보존했다. 장기 확인은 위 run 링크와 소스 SHA를 사용한다. 최종 문서 커밋·PR CI는 PR Checks에서 별도로 확인한다.

## 잔여 위험
연결 소유권 회귀와 원래 실패 소켓 종류는 구분한다. CI 성공을 Firefox HTTP3 문제 해결 증거로 사용하지 않는다.

## 다음 단계 영향
PR 검토·병합 뒤 실제 통합 커밋 CI도 확인해야 한다. 기존 beta 태그는 바꾸지 않는다.

## 승인
수정·재검증 지시에 따라 PR을 게시한다. 병합은 수행하지 않는다.
