# Task #4 Stage 4 — 심사 양식과 설치 철회 수용

계획: [수행계획](../plans/task_m010_4.md) · [구현계획](../plans/task_m010_4_impl.md)

## 승인과 범위

사용자가 2026-09-22 대한민국 개인 운영·보안 연락처 운영 사실을 확인했다. 별도로 Alhanguel 공개 rhwp 앱의 제거·재설치를 승인했으며 기존 편집 링크가 무효화되는 점을 고지했다. Slack 파일과 내부 rhwp-pro는 유지한다. Marketplace 약관 동의와 최종 제출은 진행하지 않는다.

## 배포

- 소스: PR #32 병합 `32a2c5789ab02bb89e5852016180fa7c7580b5d2`.
- 첫 Cloud Build `208b6e68-efe2-46df-a536-9c43d1157a80`는 소스 묶음에서 Dockerfile smoke 단계가 참조하는 tests가 누락되어 실패했다. 운영 트래픽에는 영향이 없었다.
- tests·site·Playwright 설정을 같은 SHA에서 추가해 빌드 `2e41f1a5-e577-4cca-8e60-64cbf31bb7f8` 성공. release target은 테스트 파일을 포함하지 않는다.
- worker `rhwp-beta-worker-00007-2pg`, ingress `rhwp-beta-ingress-00006-zw5`에 동일 digest 배포, 각각 트래픽 100%.
- 기존 환경 변수·사양을 변경하지 않았고 내부 ingress·worker의 revision/traffic 불변 확인.
- 공개 `/install` 302 및 실제 OAuth/완료 페이지 확인. 외부 `/healthz`는 Google 프런트 404를 반환하므로 이 호출을 앱 health 통과로 기록하지 않는다.

## 실제 설치 수용

| 항목 | 관측 | 판정 |
|---|---|---|
| 제거 전 | 기존 합성 viewer-two-pages 편집본 2페이지 열림 | 충족 |
| 실제 앱 제거 | Alhanguel 설치 revoked, rhwphq active 유지 | 충족 |
| 열어 둔 편집기의 저장 | Slack에서 다시 열기 안내, 다운로드/재시도 선택 | 차단 관측; 세션 유효시간과 별개인 철회 원인은 레지스트리 결과로 확인 |
| 재설치 | 같은 8개 봇 권한, 새 설치 세대, 완료 화면 | 충족 |
| 기존 링크 재열기 | 이전 편집본 링크 → Slack OIDC → callback HTTP 400; Chrome은 ERR_BLOCKED_BY_CLIENT 표시 | 접근 거절 확인, 사용자 오류 화면 개선 여지 |
| 채널 복구 | test·rhwp-slack 앱 참여 true, 두 채널 auto 설정 | 충족 |
| 새 연결 | `/rhwp open`으로 기존 합성 파일 재요청; PDF·2페이지 PNG ready, 새 편집기 열림 | 충족 |
| 편집본 저장 | 첫 저장은 내보내기 중 변경 감지로 거절; 추가 편집 없이 재시도 성공, 같은 카드 스레드에 HWP·PDF·2페이지 PNG 생성 | 재시도 후 충족; 첫 실패 원인 미확정 |
| 편집 결과 | 저장된 첫 페이지 PNG를 Slack 뷰어에서 열어 `재설치 검증 ·` 접두어 확인 | 충족 |
| 실제 file_unshared | 이 설치 시험으로 대체하지 않음 | 미검증 |

비밀값·원본 파일은 기록하지 않는다. 로컬 배포/설치 요약은 `/private/tmp/rhwp-task5-deployment.json`, `/private/tmp/task5-installations-revoked.json`, `/private/tmp/task5-installations-after.txt`에 있다. UI 증적은 현재 작업의 `rhwp-slack-screenshots-20260922` 폴더에 `revocation-before-editor.png`, `revocation-save-denied.png`, `review-install-oauth.png`, `review-install-complete.png`로 보존했다. 아직 공개 심사 자료로 게시하지 않았다.

재설치 후 증적은 같은 폴더의 `reinstall-new-preview.png`, `reinstall-editor-saved.png`, `reinstall-saved-thread.png`, `reinstall-saved-page.png`다. 이번 새 연결은 기존 합성 파일에 대한 명령 요청이며 새 원본 업로드 자동 감지 시험과 구분한다. 저장 스레드는 이 명령이 만든 카드(`1790072332.401279`)이고, 편집본 댓글은 `1790072674.560489`다. 파일 `F0C3KN6L22E`의 PDF·PNG ready를 작업 상태와 Slack UI로 대조했다.

첫 저장 오류는 `src/editor/save.ts`의 내보내기 전후 documentEpoch/changeSeq/documentSha256 비교에서 나온다. 어떤 값이 바뀌었는지는 측정하지 않았으므로 IME·내보내기 부작용 등 특정 원인으로 단정하지 않는다. 재시도 성공을 원인 해결로 기록하지 않는다. 오래된 링크의 HTTP 400에서 Chrome 오류 화면이 노출되는 문제도 별도 개선 대상으로 남긴다.

후속 추적: [첫 저장 재시도 #34](https://github.com/postmelee/rhwp-slack/issues/34), [무효 링크 복구 안내 #35](https://github.com/postmelee/rhwp-slack/issues/35).

## 심사 양식

제품 정본 [Marketplace 준비](../../docs/marketplace.md)에 저장/초안/미제출을 구분했다. 보안 정보는 새 설정 탭에서 재조회하고 보안 이메일은 화면으로 단일 주소를 직접 확인했다. 전화번호·인증 코드·토큰은 기록하지 않았다.

활성 워크스페이스·주간 활성 사용자 요건, 전체 설치/설정 시연 링크, 실제 공유 해제·다른 사용자 철회, 별도 조직 자체 호스팅 재현은 아직 남는다.
