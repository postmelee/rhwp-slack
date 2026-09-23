# Task #35 Stage 2 — Linux·화면·운영 수용

GitHub Issue: [#35](https://github.com/postmelee/rhwp-slack/issues/35)
구현계획서: [구현계획](../plans/task_m010_35_impl.md)

## 단계 목적

정확한 코드 `8448f3e`를 Linux와 실제 공개 서버에서 검증한다.

## 산출물

- 아래 CI·Cloud Build·Cloud Run 배포 기록.
- `assets/task35/`: PC/모바일 복구 안내와 실제 옛 연결 거절·현재 연결 문서 표시 스크린샷. 합성 문서이며 인증 코드는 포함하지 않는다.

## 본문 변경 정도 / 본문 무손실 여부

코드 추가 변경 없음. 공개 ingress만 업데이트했다. worker와 Pages 편집기 산출물은 변경하지 않았다.

## 검증 결과

- [push CI](https://github.com/postmelee/rhwp-slack/actions/runs/35816841298), [PR CI](https://github.com/postmelee/rhwp-slack/actions/runs/35817015571): viewer/container 4개 SUCCESS. 타입·unit·Slack·보안·실제 Chromium·Linux 제한 컨테이너 포함.
- 로컬 실제 라우트를 사용하는 임시 HTTP 서버에서 desktop 1200px와 mobile 390×844 화면을 직접 판독했다. 제목/설명/버튼/보관 안내에 잘림·가로 넘침 없음. [PC](assets/task35/desktop.png), [모바일](assets/task35/mobile.png).
- release Cloud Build `194124cc-78ed-45bc-aaef-5396b1af457b` SUCCESS. source `8448f3e`, image digest `sha256:7f1ae33e42223a6f8aafd33734aba81759c1759576ceec52e31490fb1f3bd290`.
- 공개 ingress `rhwp-beta-ingress-00007-kzs` 100%. rollback `rhwp-beta-ingress-00006-zw5`. 초기 서비스 template 비교는 자동 생성 라벨 때문에 실패했다. 실제 두 revision의 spec은 image를 제외하고 동일함을 재확인했다. IAM 변경 명령은 수행하지 않았으며 기존 public invoker가 존재한다.
- 공개 worker `rhwp-beta-worker-00007-2pg`, 내부 ingress `rhwp-ingress-task8-c1`, 내부 worker `rhwp-worker-00008-6t7` 유지.
- 배포된 `/browser/callback`에 합성 code/state를 보내 `/browser/result?reason=login_expired`와 200 HTML, no-store/no-referrer, 입력값 미포함 확인.
- 실제 Alhanguel 재설치 전 합성 편집본 카드 `1789873799.579339`의 연결은 Slack 로그인 후 `document_unavailable` 안내로 이동했다. [이전 연결](assets/task35/old-link.png).
- 현재 설치의 합성 원본 카드 `1790072332.401279` 연결은 Slack 로그인 후 2페이지 문서를 정상 표시했다. [현재 연결](assets/task35/current-link.png).
- Slack 검색 결과에서 버튼은 disabled였고 일부 Slack UI 클릭이 반응하지 않아, 보존된 카드 메타데이터에서 실제 UUID를 조회해 앱이 생성하는 동일 `/browser/open` 링크로 비교했다. 버튼 클릭부터의 전 여정 성공으로 기록하지 않는다.

## 잔여 위험

다른 사용자 채널 탈퇴 검증은 협력자가 없어 미검증이다. 이전 Chrome ERR_BLOCKED_BY_CLIENT의 확장 원인은 확정하지 않았다.

## 다음 단계 영향

PR 최종 head의 문서·증거 정리 및 CI 확인 뒤 병합한다. #4의 다른 사용자·약관·설치 실적 조건은 별도로 남긴다.

## 승인 요청

사용자의 최종 제출 전까지 진행 지시에 따라 Stage 3를 계속한다.
