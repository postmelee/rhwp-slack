# Task #4 — 홈페이지·영상·MIT 공개 준비 결과

GitHub Issue: [#4](https://github.com/postmelee/rhwp-slack/issues/4)
마일스톤: M010 · 2026-09-27

## 작업 요약

이번 통합 범위는 Stage 6–8의 사용자 확정 홈페이지·시연 영상, MIT 라이선스, 사용자 문서와 공개 노출 점검이다. #4 전체 완료 보고가 아니며 Marketplace 제출·활성 설치 요건·새 조직 자체 호스팅 재현은 남아 있다. Stage 9의 PR/CI·배포·Public 전환은 이 보고서 작성 후 실행하고 해당 PR 및 #4에 실제 결과를 남긴다.

## 변경 파일 목록과 영향 범위

| 경로 | 변경 | 영향 |
|---|---|---|
| site/index.html, site/site.css, site/assets/demo/, site/review/index.html | 확정된 반응형 홈페이지와 수동 재생 영상 | 공개 페이지 |
| LICENSE, THIRD_PARTY_NOTICES.md, package*.json | 앱 MIT·제3자 고지 | 코드 사용 조건, npm private 유지 |
| README.md, docs/ | 사용자 안내와 관리자/개발자 진입점 분리 | 문서 탐색 |
| site/licenses/, 각 footer, scripts/public-site.mjs, scripts/export-pages.mjs | 라이선스 원문·고지의 명시적 export 및 미디어 CSP | 공개 정적 파일 |
| tests/unit/public-site.test.mjs | 공개 파일·링크·고지 원문·CSP 검증 | 배포 계약 |
| mydocs/ | 승인·노출 점검·검증 기록 | 작업 이력 |

서버 인증·변환·편집·저장 로직과 고정 Studio 프로그램은 변경하지 않는다.

## 문서 위치 검증

README는 사용자 진입점, docs/installation.md는 사용 안내, docs/self-hosting.md와 docs/README.md는 관리자·개발자 안내로 유지했다. docs/marketplace.md는 내부 제출 기록임을 표시하고 사용자 README 링크에서 제외했다. LICENSE/THIRD_PARTY_NOTICES.md는 루트, 웹 안내는 site/licenses/, 작업 기록은 mydocs/로 계획과 일치한다. 기존 개발·운영 문서와 Git 이력은 보존한다.

## 변경 전·후 정량 비교

| 항목 | 이전 | 준비본 |
|---|---|---|
| 웹 시연 영상 | 없음 | H.264 MP4 1개, 12,539,537 bytes |
| 앱 라이선스 | 미지정 | MIT 원문·제3자 고지·웹 안내 |
| 공개 export | 영상/라이선스 없음 | 81 files, headers 75 |
| 편집기 프로그램 namespace | ea2d06d323e9c93b29e683feb45cdfedd8705b0f6ccf912f143e158d7b881451 | 동일 |

## 검증 결과

- Node 24.21.0 `npm run typecheck`: 통과.
- `npm test`: 10/10 통과. 최초 sandbox 실행은 localhost listen EPERM으로 1개 실패했고, 동일 코드·명령을 서버 바인딩 가능한 환경에서 재실행해 모두 통과했다.
- `node --test tests/unit/public-site.test.mjs`: 1/1 통과. 링크, MIT/고지 바이트 일치, 내부 파일 제외, opt-in, CSP 검사.
- `git diff --check`: 통과.
- Stage 6의 데스크톱/모바일 직접 확인 및 사용자 최종 UI 승인, Stage 7의 라이선스 페이지 1440×900·390×844 확인을 연결한다. 이번 문서 승인 반영에서 레이아웃을 다시 바꾸지 않았다.
- Linux CI·production 배포·Public 전환은 실행 전이며 결과를 PR과 #4에 추가한다.

### 단계별 증거

- [Stage 6: 홈페이지·영상](../working/task_m010_4_stage6.md)
- [Stage 7: MIT·문서·이슈](../working/task_m010_4_stage7.md)
- [Stage 8: Git·GitHub·Actions·미디어 노출](../working/task_m010_4_stage8.md)

## 잔여 위험과 후속 작업

노출 점검에서 실물 장기 비밀키로 확인된 항목은 없었다. 패턴·OCR 검사로 모든 비밀정보 부재를 보증하지는 않는다. Projects V2 보드는 별도 권한이 없어 미검증이며 저장소 공개와 별도다. 사용자 소유 파일명과 만료된 60초 일회용 ticket 일부가 영상에 남는 것을 사용자가 수용했으므로 원본과 Git 이력을 유지한다.

Marketplace의 활성 설치·심사 정보 최종 재확인과 실제 제출은 #4에 남긴다. #6 후속 기능과 #44 내부 임베드 코드를 유지한다. 조직의 깨끗한 계정에서 자체 호스팅 설치·업데이트·복구는 아직 미검증이다. 이번 시연 영상은 설치 OAuth·앱 제거의 전체 시나리오 영상이 아니다.

## 승인과 실행 범위

사용자가 2026-09-27 “public 전환까지 진행해줘”로 PR 게시·CI·병합, 확정 홈페이지/영상/라이선스 게시와 기존 저장소 공개를 승인했다. 동일 범위의 승인을 다시 요청하지 않고 단계별 결과를 확인해 진행한다.

## Linux CI에서 확인한 컨테이너 고지 누락

첫 PR CI의 container job은 공개 export 검사에서 `/app/LICENSE` ENOENT로 실패했다. 로컬 저장소에는 파일이 있지만 Dockerfile의 명시적 COPY에 포함되지 않은 것이 원인이다. 공통 dependencies layer에 LICENSE와 THIRD_PARTY_NOTICES.md를 복사하고 .dockerignore에서 고지 파일을 허용했다. 따라서 smoke 검사와 최종 release 이미지에 모두 앱 고지가 포함된다. 서버 실행 로직·권한·메모리 제한·검사 조건은 바꾸지 않았다. 실패 실행: https://github.com/postmelee/rhwp-slack/actions/runs/36276582590 . 수정 head의 Linux CI 결과를 PR에 기록한다.

## 후속 Community Standards 준비

공개 게시·전환의 실제 완료 결과는 [PR #51 배포 기록](https://github.com/postmelee/rhwp-slack/pull/51#issuecomment-5850599931)에 있다. 이후 사용자 요청으로 행동 강령·기여 안내·보안 정책의 로컬 초안을 준비했다. 위치 판단·확인 결과·아직 원격 반영 전인 범위는 [Stage 10](../working/task_m010_4_stage10.md)을 따른다.

## 후속 후원 안내 준비

사용자 요청으로 기존 postmelee GitHub Sponsors를 연결하는 FUNDING.yml과 README·홈페이지·지원 페이지 안내를 준비했다. 서버 운영비와 장기 유지에 도움이 되는 선택적 후원임을 설명했다. 검사·시각 확인과 게시 전 상태는 [Stage 11](../working/task_m010_4_stage11.md)에 기록했다.

2026-09-27 사용자가 Stage 10–11 공개를 승인했다. Linux CI·병합·실제 공개 확인 결과는 해당 PR의 배포 완료 기록에 연결한다. Stage 10–11의 “로컬 준비”는 승인 전 검증 시점의 상태다.

## README 굵게 표시 보완

사용자 제보를 GitHub Markdown API(mode=gfm)로 확인했다. 코드·링크를 감싼 닫는 `**` 바로 뒤에 조사가 붙은 두 곳에서 별표가 일반 텍스트로 남았다. `/rhwp` 뒤는 “명령어로”로 연결하고 개인정보 안내는 링크 안쪽에서 제목만 강조하도록 수정했다. GitHub 렌더링 HTML에서 두 `<strong>`과 일반 텍스트의 `**` 잔여 없음, `git diff --check`를 확인했다. 문구 서식만 변경하므로 홈페이지 배포·앱 검증은 추가하지 않는다.

## Stage 12 — 푸터 가로 배치 미리보기

6개 공개 페이지의 푸터를 소개·후원 안내와 메뉴·연락처의 두 열로 정리하고 독립 운영 고지를 아래에 배치했다. 900px 이하에서는 한 열로 전환한다. 기존 footer 링크와 본문·헤더는 유지했다. 헤더 GitHub는 보조 텍스트 링크를 추천하며 이번 변경에는 추가하지 않았다.

- Node 24.21.0 `node --test tests/unit/public-site.test.mjs`: 1/1 통과.
- 공개 export: 81 files, headers 75. 편집기 프로그램 namespace는 기존과 동일하다.
- `git diff --check`, 여섯 페이지의 기존 footer 링크 보존·중복 ID 없음·footer 외 HTML 동일 확인.
- 로컬 미리보기 1440×900 직접 확인: footer 높이 약 162px. 기존 공개 페이지는 같은 1160px 콘텐츠 폭에서 약 242px였다.
- 390×844, 320×740 직접 시각 확인: 메뉴 줄바꿈·이메일·후원·독립 고지 표시 정상, 문서 가로 넘침 없음. 검사 후 viewport 설정 복원.
- 미리보기: http://127.0.0.1:8770/#sponsor . 이 단계는 로컬 수정이며 원격 게시·production 배포는 아직 하지 않았다.
