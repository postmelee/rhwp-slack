# Stage 6.3 — 자동 스레드 미리보기와 Slack 이미지 갤러리

GitHub Issue: [#1](https://github.com/postmelee/rhwp-slack/issues/1) · M010
구현계획서: [task_m010_1_impl.md](../plans/task_m010_1_impl.md)
Stage: 6.3 · 검증일: 2026-09-15 · 브랜치: local/task1
기준 소스: 9a9b36e, 계획 커밋: de0abe8. 검증 대상은 이 보고서와 같은 커밋의 제품 소스다.

## 단계 목적

HWP/HWPX 업로드 뒤 원본 스레드에 PDF 링크·페이지 이미지·Studio 편집 카드를 제공한다. 사용자 선택에 따라 자동 업로드 감지와 @rhwp 멘션을 함께 지원하고, 세로 이미지 블록을 Slack 기본 이미지 갤러리로 보정했다. 기본 3페이지에서 추가 요청 시 10페이지까지 같은 댓글에 붙인다.

## 산출물

| 파일 | 변경 요약 |
| --- | --- |
| src/server/receiver.ts, slack/manifest.json | file_shared·app_mention, history 권한 없는 위치 식별, 중복 처리·bot 재공유 제외 |
| src/server/documents.ts, pdf-jobs.ts, commands.ts | 같은 댓글의 PDF·native file_ids 갤러리·3→10페이지, 업로드 불확실성·순서·권한 검사 |
| src/conversion/convert.mjs, convert.d.mts, pdf-child.mjs | PDF/첫 3페이지 및 추가 PNG 모드, 번호·크기·개수 검증을 포함한 출력 봉투 |
| tests/slack/file-events.test.ts, pages.test.ts, editor-support.ts | 자동/멘션 중복, 채널·root 권한, 갤러리 순서, 동시 클릭·업로드 재확인 |
| tests/fixtures/preview-document.mjs, tests/viewer/pages.spec.ts | 실제 12페이지 HWP/HWPX 생성, 1~3·4~10 PNG와 PDF 검증 |
| scripts/create-preview-fixture.mjs | 사용자 시험용 합성 문서 두 형식 생성 |
| tests/viewer/slack-flow.spec.ts | 실제 Studio 편집·저장·수정본 PDF/PNG·재열기 연결 |
| README.md, docs/development.md, docs/architecture.md | 설치 scope·이벤트·갤러리 제약·사용자 시험 순서 |
| 기존 plans/orders/report 및 이 문서 | 승인·검증·잔여 범위 기록 |

## 본문 변경 정도 / 본문 무손실 여부

사용자 원본을 덮어쓰지 않는다. 수정본은 독립된 파일·카드로 원본 스레드에 누적한다. 초기 PDF와 PNG는 동일 print DOM/폰트를 사용하고 추가 PNG도 같은 원본 bytes에서 만든다. 엔진·Studio 버전 및 영속 복구 금지 정책은 유지했다. 이전 Stage 기록은 보존하고 제품 문서의 현재 동작만 갱신했다.

## 검증 결과

실행 명령:

```sh
npm run check
docker build --target smoke -t rhwp-slack:smoke .
docker run --rm --init --network none --read-only \
  --tmpfs /tmp:rw,nosuid,nodev,size=512m,mode=1777 \
  --shm-size=256m --memory=4g --cpus=2 --pids-limit=256 \
  --cap-drop=ALL --security-opt=no-new-privileges rhwp-slack:smoke
git diff --check
```

| 검사 | 결과·범위 |
| --- | --- |
| macOS 전체 검사 | 정상 80개: unit 7, Slack 33, security 22, browser 18. 기존 B-004 expected-failure 1개는 유지. typecheck·production/dev build 성공 |
| Linux smoke | Node 62개 + production Studio 저장/실제 PDF/PNG 1개 성공. non-root/read-only/network none/4 GiB에서 OOM kill 0, peak 2,946,560,000 bytes |
| 12페이지 변환 | HWP/HWPX 양쪽 최초 1~3과 추가 4~10 출력. PNG signature·번호·distinct bytes, 잘못된 범위 거절. 직접 본 HWP 1·10페이지와 HWPX 3페이지의 한글 제목·표 정상; 한컴 출력 일치 증거는 아님 |
| native 첨부 API | 공식 chat.update.file_ids로 기존 합성 댓글에 파일 추가 성공. 같은 ID 집합 재전송 후 파일 중복 없음 |
| 실제 자동 HWP 감지 | 멘션 없는 사용자 HWP 업로드에서 원본 스레드 자동 댓글 확인. 초기 검증에서 발견한 bot 원본 재공유 알림 문제를 share_user_id 판정으로 보정하고 회귀 검사 추가 |
| 실제 HWPX + 멘션 | 사용자 업로드와 실제 @rhwp를 함께 전송, 원본 스레드 댓글 1개. 최초 3 PNG → 버튼으로 10 PNG까지 같은 ts 유지. 보정 후 새 업로드에 이전의 재공유 오류 알림 발생 없음 |
| 실제 Studio·수정본 | 새 HWPX 편집 카드에서 Slack 내부 Studio 12페이지 표시. Gallery revision 입력 후 저장. 같은 원본 스레드에 수정본 댓글 1개 추가되어 총 2개, 수정본 PDF·PNG와 편집 카드 표시. 후속 사용자 조작이 섞인 화면 관찰은 자동 실행과 구분 |
| 실제 PDF·미디어 | 이번 작업의 HWP PDF 링크로 Slack PDF 뷰어 12페이지 확인. native PNG 클릭 시 Slack 이미지 뷰어와 좌우 화살표 확인. 마지막 HWPX revision PDF의 내부 열람은 별도 재실행하지 않았으며 변환·공유 및 기존 링크 경로 검증과 구분 |
| 권한 설정 | 실제 설치 token에 app_mentions:read·files:read 포함, channels:history/groups:history 없음. 일반 대화 내역을 조회하지 않음 |

최초 sandbox 실행은 localhost listen EPERM으로 중단되어 결과에서 제외하고, 로컬 수신이 허용된 실행으로 전체 검사를 다시 수행했다. 제품 실패를 통과로 바꾼 것이 아니다. 기존 Studio bundle 크기/외부화 경고 및 알려진 undo 결함을 숨기거나 baseline을 완화하지 않았다.

Linux smoke 이미지 manifest list: `sha256:1c4a5343bedf8d908dff6beece2a601ca24d2730124d3c0d8369b8793511dfad`.
제품/검사 입력의 경로·내용 digest (`src/tests/scripts/slack`): `8c20bec5334a97aadae8ede81d284f882dd8835611b47a7d25393e7bce4973ce`.

### 실제 시험 위치와 로컬 증적

- 최종 HWPX 원본: https://rhwphq.slack.com/archives/C0C1X3ENGD8/p1789473901688459
- 같은 스레드의 갤러리 댓글: https://rhwphq.slack.com/archives/C0C1X3ENGD8/p1789473905685909?thread_ts=1789473901.688459&cid=C0C1X3ENGD8
- 수정본 댓글: https://rhwphq.slack.com/archives/C0C1X3ENGD8/p1789474081353339?thread_ts=1789473901.688459&cid=C0C1X3ENGD8
- 사용자 입력: `.cache/test-documents/rhwp-12페이지-테스트.hwp`, `.hwpx`.
- 화면: `.cache/slack/stage63/gallery-desktop.png`, `saved-revision-desktop.png`. 변환 출력은 `test-results/pages-*/`.
- 실제 payload·token·ticket은 기록하지 않았고 합성 문서/산출물/스크린샷은 Git에 포함하지 않는다. 임시 테스트 서버·HTTPS는 사용자 시험을 위해 실행 상태로 남긴다.

## 잔여 위험

- 기본 갤러리의 썸네일 수·+N·격자/목록·펼침 상태는 Slack이 제어한다. 실제 macOS 메시지에서는 한 행 일부 썸네일과 +N을 확인했고, Studio 옆 패널에서는 파일 목록으로 바뀌었다. 메시지 안의 가로 스크롤을 제공한다고 주장하지 않는다.
- 전송 전 파일 카드나 사용자가 보낸 원본 HWP의 ‘이진’ 표시는 Slack 기본 UI다. 봇은 원본 스레드에 결과를 추가한다.
- 원본 bytes TTL 15분, 서버 재시작 시 세션/중복 기록 소실. 이미 게시한 PNG/PDF는 남지만 만료된 편집·추가 페이지는 원본 메시지 메뉴로 다시 요청한다.
- 초기 3페이지와 확장 7페이지는 변환·Slack 업로드로 지연된다. 이번 합성 사례에서 각각 수십 초가 걸렸으며 처리 SLA나 최대 문서 성능 보장은 아니다.
- 모호한 여러 사람의 파일 공유 위치·미관찰 이전 스레드는 메시지 메뉴로 안내한다. 멘션은 files:read를 대체하지 않으며, 파일/채널 접근 검사를 생략하지 않는다.
- 실제 공유 해제·탈퇴·장애·모바일·운영 규모 검증은 잔여 항목이다. 전체/지정 PNG·ZIP·thumbnail 단독 명령은 이번 3→10 미리보기와 별도 후속이다.

## 다음 단계 영향

- 출시에는 고정 HTTPS·운영 worker/자원 경계와 남은 실제 수용 검증이 필요하다.
- 전체/지정 PNG 명령은 현재 변환 범위와 파일 공유·갤러리 코드를 재사용할 수 있다.
- 기존 README/docs 위치와 issue #1/M010을 유지한다. 원격 push·PR·issue close는 수행하지 않았다.

## 승인 요청

이번 Stage의 사용자 시험을 위한 구현·검증·인계는 기존 지시 범위에서 완료했다. 다음 제품 범위와 원격 PR 단계는 별도 지시에 따라 진행한다.
