# Task #4 Stage 1 — README와 외부 설치 안내

Issue: [#4](https://github.com/postmelee/rhwp-slack/issues/4), M010.
계획: [수행계획](../plans/task_m010_4.md), [구현계획](../plans/task_m010_4_impl.md).

## 목적과 산출물

기존 한 워크스페이스 운영을 유지하면서 외부 베타·조직 자체 호스팅·Marketplace 제출의 경로와 현재 상태를 구분했다. 사용자 선택은 **PDF·PNG는 Slack, 외부 편집은 브라우저**다.

| 파일 | 변경 |
|---|---|
| `README.md` | 제품 설명·기능·명령·채널 설정·처리 위치·설치 지원 상태·개발 진입점 재구성 |
| `docs/installation.md` | 설치형 베타와 조직 자체 호스팅, Marketplace 경로 |
| `docs/self-hosting.md` | 조직 Slack/GCP/Pages 구성·빌드·연결·검증·갱신 순서 초안 |
| `docs/marketplace.md` | OAuth·격리·공개 안내·활성 설치10개·embeds 별도 승인·진행 순서 |

제품 문서는 수행계획에 선택한 기존 `docs/` 아래에 두었다. README는 전반적으로 재작성했으나 개발 명령·기능·엔진 제약의 의미와 운영 문서 연결은 유지했다. 아직 없는 OAuth/설치 버튼/원클릭 배포를 완료 기능으로 소개하지 않는다. 코드·운영 설정은 변경하지 않았다.

## 확인한 근거와 검증

- 2026-09-20 Slack 공식 배포·Work Objects embeds·Marketplace 설치 요건 확인. 각 제품 문서에 직접 출처 링크를 둠.
- README, 설치·자체 호스팅·Marketplace 안내 및 계획/보고서의 Markdown 상대 파일 링크 검사 통과.
- `node scripts/slack-manifest.mjs --bootstrap`: JSON 생성 확인, 연결 전 event subscription 없음.
- `node scripts/slack-manifest.mjs --origin https://organization-ingress.example.com`: JSON 생성 확인, Events/Interactivity/`/rhwp`가 해당 origin의 `/slack/events`에 연결됨.
- CLI/environment 표를 기존 소스와 운영 문서에 대조. `git diff --check` 통과.
- 문서만 변경하여 엔진·브라우저·변환 테스트를 반복하지 않음. 외부 조직 실제 설치/배포가 검증됐다는 뜻은 아님.

## 남은 작업

Stage 1 문서 준비 완료이며 **#4 전체는 진행 중**이다. 공개 배포·Marketplace 제출은 실행하지 않았다. 다음은 #16의 OAuth와 workspace별 토큰/파일/세션/큐/설정 격리, 설치 제거/철회, 인증된 브라우저 편집 경로다. 사용자 사이드 대화에서 확정한 하나의 배포 앱 + 우리 호스팅 + Add to Slack 방향을 반영했다. #4에서 중복 구현하지 않고 #16 수용 결과를 연결한다.

조직 가이드는 PR #12의 Pages 기능을 포함한 릴리스와 소스/이미지 접근 조건 확정이 필요하다. 새 조직 계정에서 설치·갱신·복구를 재현한 뒤 검증 완료 안내로 바꾼다. 현재 private 저장소를 공개로 바꾸거나 라이선스를 임의 지정하지 않았다. 별도 앱으로 자체 호스팅한 설치를 중앙 배포 앱의 활성 설치 실적으로 합산하지 않는다.

중앙 외부 앱의 새 자격 증명, 배포/수집 범위, 공개 지원/개인정보 페이지는 구현된 결과에 맞춰 확정해야 한다. 이 문서 PR에는 #4를 닫는 closing keyword를 사용하지 않는다.

## 선행 PR 통합 검토 — 2026-09-20

사용자 승인에 따라 PR #12(`59e9a02`) → #14(`7de70dc`) 순으로 병합한 기준을 이 브랜치에 통합했다. 충돌은 오늘할일 문서 한 곳이며 양쪽 타스크를 보존했다. 제품 코드에 별도 수정을 추가하지 않았다.

PR #15의 최초 push CI run `35467825627` attempt 1은 Linux container의 `slack-flow.spec.ts` 전체 테스트 90초 초과로 실패했다. 같은 head의 PR CI와 실패 job 재실행은 통과했다. 다만 `/tmp/test-results`가 tmpfs 및 `docker run --rm` 안에 있어 실패 trace가 보존되지 않았으므로 구체적 지연 단계·제품 원인은 미확정이다. 재실행 통과를 원인 해결로 간주하지 않는다. 시간 제한을 늘리지 않고 단계별 시간 및 실패 자료 보존을 별도 추적한다.
