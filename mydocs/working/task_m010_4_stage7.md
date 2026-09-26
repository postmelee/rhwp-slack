# Task #4 Stage 7 — MIT·사용자 문서·공개 전 이슈 정리

GitHub Issue: [#4](https://github.com/postmelee/rhwp-slack/issues/4)
구현계획서: [task_m010_4_impl.md](../plans/task_m010_4_impl.md)

## 단계 목적

승인된 홈페이지 최종안을 보존하면서 공개 소스의 MIT 선택을 반영하고, 사용자가 읽을 문서와 개발 진입점을 정리한다. 공개 전 열린 이슈의 상태를 실제 완료 범위와 일치시킨다. 저장소 공개 방식은 아직 미확정이다.

## 산출물

| 파일/대상 | 변경 |
|---|---|
| LICENSE, package.json, package-lock.json | 앱 MIT 원문과 메타데이터. npm private는 유지 |
| THIRD_PARTY_NOTICES.md | 고정 rhwp 0.8.6·원저작자·폰트·직접 실행 의존성 출처와 고지 |
| README.md, docs/installation.md | 설치·업로드·편집·저장·설정·지원 중심으로 재작성 |
| docs/README.md, docs/development.md | 관리자/개발자 목록과 단일 서버 문서의 적용 범위 |
| docs/self-hosting.md | 라이선스 미정·초대 후 기본 중지 등 오래된 안내 정정 |
| docs/marketplace.md | 내부 기록 표시, 사용자 최종 UI 승인과 공개 준비 상태 |
| site/licenses/index.html, 각 footer | 앱 MIT 원문·제3자 고지와 원본 출처 접근 |
| scripts/public-site.mjs, export-pages.mjs | 명시적 라이선스 파일 배포와 no-cache 경로 |
| tests/unit/public-site.test.mjs | 원문과 배포본 일치·로컬 링크·내부 문서 비노출 |

## 본문 변경 정도 / 본문 무손실 여부

README/설치 안내는 사용자 관점으로 재작성했다. 개발 실행·검증 명령은 docs/README.md로 옮기고 자세한 기존 기술 문서는 유지했다. 심사 기록은 README에서 제외했지만 파일·Git 이력을 삭제하지 않았다. MIT는 앱 자체 코드·문서에 적용하며 엔진·폰트·외부 라이브러리의 라이선스를 대체하지 않는다. 기존 Studio 라이선스 파일과 프로그램 namespace를 유지한다.

## 이슈 정리 — GitHub 적용 완료

각 본문을 수정 직전 재조회해 이전 snapshot과 동일한지 대조하고, 적용 후 API 본문을 임시 Markdown 원문과 비교했다.

| 이슈 | 처리 | 근거/남은 범위 |
|---|---|---|
| #13 | completed 종료 | PR #14 merge 7de70dcc8ddef55850b55b3e7823c27fe417525f, viewer/container 4 checks success. 계측·호출 감소 완료, 실제 비용·체감 시간 측정과 구분. 후속 재시도 PR #42/#43 연결 |
| #6 | open·갱신 | 사용자 결정: 전체/지정 PNG·ZIP은 나중에 진행 |
| #44 | open·갱신 | 내부 embed 구현은 유지. 공개 앱 적용 검증으로 명확화. 9/24 사용자가 제공한 timeout·네트워크 화면을 기록하되 원인 확정·probe 원복 입증과 구분 |
| #25 | open·갱신 | 두 앱 공존의 불필요한 실패 안내는 미해결. 재현에 불필요한 실제 채널 링크를 현재 본문에서 제외 |
| #3 | open·갱신 | 다중 사용자 수용 연결, 실제 월 비용·모바일·지속 관찰 남음 |
| #4 | open·갱신 | 완료된 설치/제거/복구/릴리스와 공개 준비·활성 조직·양식 저장·제출을 분리 |

## 검증 결과

```sh
node --test tests/unit/public-site.test.mjs
node scripts/export-pages.mjs https://rhwp-beta-ingress-aaj47f2u5q-uc.a.run.app --public-site
git diff --check
```

- Node 24.21.0에서 공개 export 검사 1/1 통과. 라이선스 원문 바이트 일치, 모든 public HTML의 로컬 링크 존재, opt-in·CSP·비밀파일/내부 문서 제외 확인.
- 변경 Markdown 전체의 상대 링크 41개를 최종 확인했고 누락 없음.
- export 81 files, headers 75. 프로그램 namespace `ea2d06d323e9c93b29e683feb45cdfedd8705b0f6ccf912f143e158d7b881451`, programBytes 43,299,074로 기존 프로그램과 동일.
- 로컬 `/licenses/`를 1440×900과 390×844에서 직접 판독. 제목·본문·링크·모바일 footer 표시 확인, 모바일 scrollWidth=390으로 가로 넘침 없음. 화면 크기를 복원했다.
- 앱 runtime·엔진·조판 변경은 없어 전체 Slack/변환 회귀를 반복하지 않았다. 이번 변경의 Linux CI는 아직 실행하지 않았다.

### 공개 기록의 1차 점검

읽기 전용으로 Git reachable local refs의 1,022개 blob 중 4 MiB 이하 텍스트 999개를 패턴 검사했다. 실물 인증정보로 확인한 항목은 없다. Slack 토큰 모양의 후보는 `tests/security/editor-signin.test.ts`의 과거 4개 버전에서도 synthetic 테스트 문자열임을 확인했다. 민감 파일명 후보는 `.env.example`만 나왔다. 운영 workspace/channel 식별자·로컬 경로 등이 포함된 과거 텍스트 blob 40개가 존재한다(고유 파일 수가 아님).

GitHub의 전체 이슈/PR 본문 50개, 이슈/PR 대화 댓글 13개, review inline 댓글 0개도 같은 종류의 자격 증명 패턴을 점검했다. 후보 없음. 이슈/PR 본문 2개에는 운영 식별자가 남아 있다. 이 기록은 기존 저장소를 공개하면 함께 보일 수 있다.

이 점검은 패턴 기반 1차 확인이다. 바이너리·전체 영상 프레임·원격 전용 ref·Actions 로그/아티팩트·과거 GitHub 본문 편집 이력까지 전수 검증한 결과가 아니다. 공개 자료로 승인된 영상의 기존 대표 장면 검증은 Stage 6에 있다. 외부 의존성의 모든 라이선스 의무를 전수 감사한 결과로도 해석하지 않는다.

## 잔여 위험과 다음 단계

- 기존 Git·이슈·운영 기록을 함께 공개할지, 별도 공개 저장소로 나눌지 사용자 선택이 남았다. visibility는 PRIVATE로 확인했으며 변경하지 않았다.
- 새 코드·문서는 로컬 준비 상태다. 원격 push/PR·통합·Pages 게시와 최종 제출은 아직 실행하지 않았다.
- #44 시험의 과거 probe 복원 증거는 확보하지 못했다. 공개 browser 기본 코드는 그 증거의 대체물이 아니다.
- 라이선스 목록은 원문 출처 안내다. 배포물의 폰트별 개별 고지·전이 의존성까지의 추가 확인은 배포 범위에 맞춰 수행한다.

## 승인 범위

사용자는 MIT·문서 정리·이슈 갱신/종료와 최종 디자인을 승인했다. #6/#44 유지 결정도 반영했다. 이력 공개 범위 선택은 실제로 공개되는 자료가 달라지므로 답변을 기다린다. 기존 작업 승인을 다시 요청하지 않는다.
