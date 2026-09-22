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
| 기존 링크 재열기 | 재설치 후 별도 확인 필요 | 미검증 |
| 채널 복구·새 연결 | test·rhwp-slack 재초대와 새 연결 검증 대기 | 진행 중 |
| 실제 file_unshared | 이 설치 시험으로 대체하지 않음 | 미검증 |

비밀값·원본 파일은 기록하지 않는다. 로컬 배포/설치 요약은 `/private/tmp/rhwp-task5-deployment.json`, `/private/tmp/task5-installations-revoked.json`, `/private/tmp/task5-installations-after.txt`에 있다. UI 증적은 현재 작업의 `rhwp-slack-screenshots-20260922` 폴더에 `revocation-before-editor.png`, `revocation-save-denied.png`, `review-install-oauth.png`, `review-install-complete.png`로 보존했다. 아직 공개 심사 자료로 게시하지 않았다.

## 심사 양식

제품 정본 [Marketplace 준비](../../docs/marketplace.md)에 저장/초안/미제출을 구분했다. 보안 정보는 새 설정 탭에서 재조회하고 보안 이메일은 화면으로 단일 주소를 직접 확인했다. 전화번호·인증 코드·토큰은 기록하지 않았다.

활성 워크스페이스·주간 활성 사용자 요건, 전체 설치/설정 시연 링크, 실제 공유 해제·다른 사용자 철회, 별도 조직 자체 호스팅 재현은 아직 남는다.
