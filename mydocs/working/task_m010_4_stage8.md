# Task #4 Stage 8 — 공개 전 잔여 노출 점검

GitHub Issue: [#4](https://github.com/postmelee/rhwp-slack/issues/4)
구현계획서: [task_m010_4_impl.md](../plans/task_m010_4_impl.md)
선행 결과: [Stage 7](task_m010_4_stage7.md)
점검일: 2026-09-27 (KST)

## 결론

점검한 Git·GitHub 기록과 CI 자료에서 **운영용 비밀키·장기 토큰으로 확인된 항목은 없다.** 기존 저장소를 공개하는 방식을 유지할 수 있는 결과다. 다만 기록·운영 식별자가 없는 저장소라는 뜻은 아니다. 프로젝트/서비스 이름, 배포 주소, workspace/channel 식별자, 로컬 경로, 실패·운영 기록은 Git 및 이슈 이력에 남아 있다.

새 시연 영상에서는 만료된 일회용 편집 ticket의 주소 일부와 다른 로컬 문서 파일명이 보였다. 공개 배포본의 해당 화면을 가리는 정리를 권장한다. 이것을 장기 자격 증명 유출이나 Git 전체 이력 재작성의 필요 근거로 판정하지 않는다. 이번 작업은 점검만 수행했으며 영상·제품·원격 기록을 수정하지 않았다.

## 고정한 대상과 범위

- 원격 devel: `484cf629d80f3f43d6f0427fc51809f5d04f880d`
- 로컬 공개 준비 head: `53a814f1722153df165deebb98ea850ff41528c3`
- 저장소 visibility: 점검 후에도 PRIVATE.
- 공개 후보 영상: `site/assets/demo/rhwp-slack-20260926.mp4`
- 영상 SHA-256: `49ed025726721c917474122e1fc32581f709b4d34a0e97b69dc2e75818e52150`

| 표면 | 확인 범위 | 결과 |
|---|---|---|
| 원격 Git | mirror의 50 refs: branch 21, PR 27, tag 2. blob 971개, 4 MiB 이하 텍스트 952개. commit/tag 메시지도 검사 | 비밀정보 후보는 합성 테스트 문자열. 민감 파일명 후보는 `.env.example` |
| 선행 로컬 Git | Stage 7의 1,022 blobs/텍스트 999개 | 신규 공개 준비 파일 포함 선행 검사 연결 |
| GitHub 본문 | 이슈 23 + PR 27, 과거 본문 편집 99건 | 자격 증명 패턴 후보 없음. 삭제된 편집 항목 0 |
| 댓글·리뷰 | 대화 댓글 13개, 댓글 편집 2건, 리뷰 본문 3개, 리뷰 편집 0개. 선행 inline 댓글 0개 | 후보 없음, 조회 pagination 잔여 없음 |
| Actions | 실행 141건의 로그 144개(이전 재실행 attempt 3개 포함) + 보존 아티팩트 226개, 총 ZIP 370개/186,137,138 bytes | 다운로드 실패 0, 압축 파일 검사 누락 0 |
| 압축 내부 | 기본 ZIP 367개의 5,123 entries/중복 제거 2,105 payloads, 중첩 ZIP 6개. 이전 attempt 로그의 12 entries 추가 검사 | 아래 로컬 테스트 인증값 후보로 분류 |
| 문서 산출물 | PDF 690 entries→고유 683개, HWP 226 entries→고유 1개 | PDF 텍스트 추출 모두 성공. 합성 2쪽/12쪽/저장 수정본의 3가지 텍스트 유형. HWP도 엔진으로 추출해 `Saved revision` 합성 문서 확인 |
| 이미지 | Actions 고유 이미지 557 + Git 이력 이미지 17 + 신규 포스터 1 = 575개 로컬 OCR | OCR 실패 0, 자격 증명 후보 없음. Git 이미지와 대표 Actions 장면 직접 판독 병행 |
| 영상 | 65.4초, 30fps, 1,962프레임 전부 로컬 OCR, 2초 간격 contact sheet 및 의심 장면 직접 판독 | 아래 ticket/파일 목록 노출. 음성 레벨 mean/max -91dB, 가청 대화로 식별된 내용 없음 |
| Release | 2개 릴리스 본문 및 자산 목록 | 비밀정보 패턴 후보 없음, 첨부 asset 0개 |
| 기타 | 이슈/편집 기록 외부 업로드 첨부 링크 0개, Discussions 비활성화. Wiki git 조회는 not found | 별도 Projects 보드 내용은 미검증(아래 한계) |

## 후보 분류 근거

### CI 인증값

- 6개 Playwright trace의 network 기록에서 Bearer 후보 28건 발견.
- 모든 인증 요청의 대상은 `127.0.0.1:4176` 또는 `127.0.0.1:4177`. 실제 Slack/GitHub API 인증 요청으로 분류하지 않았다.
- 추가 camelCase/일반 secret·token 할당 검사에서 응답 JSON 8개 발견. JSON token과 앞선 로컬 요청 Bearer의 해시가 모두 일치했다. 값 자체는 보고서에 보존하지 않았다.
- [cross-origin.spec.ts](../../tests/viewer/cross-origin.spec.ts), [slack-flow.spec.ts](../../tests/viewer/slack-flow.spec.ts)의 로컬 receiver 생성과 FakeApi, [support.ts](../../tests/slack/support.ts)의 합성 설정을 대조했다.
- Git의 나머지 후보도 `tests/security/*` 및 테스트 지원 파일의 합성 입력이다. synthetic 이름이 없는 `xoxb-new-private`도 재설치 단위 테스트의 고정 가짜 입력임을 확인했다.
- 과거 workflow blob 4개에서 `secrets.*` 참조를 찾지 못했다. 이를 모든 자동 주입 자격 증명이 없었다는 주장으로 확대하지 않았다.

### 시연 영상에서 정리할 부분

| 위치 | 관측 | 권장 조치 |
|---|---|---|
| 약 00:00.50–00:01.53 | Finder에 시연 대상 외 문서 파일명·수정일·크기 노출. 해당 문서 본문은 표시되지 않음 | 시연 대상 행만 보이도록 가리거나 해당 구간 편집 |
| 00:26.500, frame 795 (0-based) | Firefox 주소 표시줄에 `/editor/#ticket=`와 값 앞부분이 한 프레임 보임 | 브라우저 주소 표시줄을 가림. OCR 검출 한 프레임만 지우는 방식보다 전환 구간 전체를 처리 |
| 브라우저 전환·버튼 hover 구간 | client ID, 배포 주소, workspace/document 식별자, 북마크 이름 노출 | 자격 증명은 아니며, 위 주소 표시줄/tooltip 정리에 함께 포함하면 깔끔함 |

[SharedSessions](../../src/server/cloud/sessions.ts)의 `issue()`는 60초 유효기간을 설정하고 `exchange()`는 grant를 일회 소비하며 만료·권한을 확인한다. [로컬 세션](../../src/server/sessions.ts)도 60초 ticket이다. 촬영일은 전날이므로 코드 계약상 해당 ticket은 이미 만료된 값이다. 실제 서비스에 해당 값을 재사용하는 검사는 하지 않았다. 영상에는 값 전체도 주소창에 들어가지 않는다.

영상이 로컬 commit에 이미 들어 있으므로 최신 영상만 가려도 과거 Git blob은 남는다. 이 항목은 만료된 일회용 값의 일부로, 그것만으로 비밀키 교체나 전면 이력 재작성을 요구하지 않는다. 앞으로 공개 자료에서는 인증 URL을 촬영하지 않는 편이 좋다.

## 방법과 한계

- GitHub API 목록을 끝까지 pagination하고 `git clone --mirror`의 모든 advertised refs를 읽었다. 로그·아티팩트는 0700 임시 디렉터리에 저장하고 값 대신 위치·유형을 출력했다.
- 토큰 prefix, PEM private key, Google/AWS 식별자, Slack webhook, JWT, credential 할당, Bearer, cookie, 서명 URL, URL 내 자격 증명 패턴을 검사했다. 일반 할당 추가 검사까지 기본 집합 3,645개 고유 payload와 이전 attempt 로그 12 entries를 검사했다. 이전 attempt 3개는 모두 다운로드·검사 성공, 추가 후보 없음.
- ZIP 내 중첩 trace, OCR 결과, PDF 추출 텍스트를 별도 검사했다. OCR은 macOS Vision 로컬 인식이며 외부 서비스에 업로드하지 않았다. PDF는 `pdftotext`, HWP는 현재 고정 `@rhwp/core`, 영상은 ffmpeg/ffprobe를 사용했다.
- 패턴 및 OCR 검사는 비정형·분할·인코딩된 모든 비밀정보 부재를 수학적으로 보증하지 않는다. 575개 이미지 모두 OCR을 했지만 Actions 이미지 557개를 각각 육안으로 전수 판독한 것은 아니다. 합성 문서 내용·생성 코드·대표 화면을 대조했다.
- GitHub가 제공하지 않는 삭제/만료 기록, advertised refs에서 도달 불가능한 객체, 개인 계정의 다른 저장소·클라우드 저장소는 범위 밖이다. 실행별 run_attempt를 확인해 재실행된 3건의 attempt 1 로그도 별도로 모두 검사했다.
- GitHub Projects V2는 현재 CLI 토큰에 `read:project` scope가 없어 보드 목록/내용을 조회하지 못했다. 권한을 확장하거나 보드 설정을 바꾸지 않았다. 저장소와 별도의 추가 확인 항목이다.
- 라이선스 전수 법률 검토 또는 애플리케이션 취약점 감사 결과가 아니다. 작업 이후 새 commit·댓글·CI 실행·영상 변경은 별도 대상이다.

## 후속 순서

1. 최종 영상의 주소 표시줄 및 Finder 목록 노출 구간 정리와 재확인.
2. 준비된 MIT·사용자 문서·footer·최종 홈페이지 변경을 PR/CI로 통합하고 게시.
3. 운영 이력·서비스 식별자가 함께 보인다는 점을 포함해 기존 저장소 공개를 확정. Projects를 사용 중이면 별도 보드 공개 설정 확인.
4. Marketplace 최종 정보 확인 및 제출. 이 점검으로 제출 요건 충족이나 제출 완료를 주장하지 않는다.

## 사본 정리

점검 원본 ZIP 370개, 추출 문서·이미지, OCR 텍스트, mirror와 임시 도구를 담은 점검 전용 디렉터리 전체를 삭제하고 경로가 존재하지 않음을 확인했다. 원본 저장소·GitHub 로그/아티팩트·사용자 촬영 원본은 변경하지 않았다. 보고서에는 값 없는 결과와 공개 후보 파일 해시만 남겼다.

문서 검증: 변경/신규 보고서와 계획의 상대 링크 10개 존재 확인, `git diff --check` 통과. 제품 소스 변경이 없어 앱 테스트·CI를 다시 실행하지 않았다.
