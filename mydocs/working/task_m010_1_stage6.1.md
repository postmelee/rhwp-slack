# Task #1 Stage 6.1 — 수정본 카드와 미리보기 통합

GitHub Issue: [#1](https://github.com/postmelee/rhwp-slack/issues/1)
구현계획서: [task_m010_1_impl.md](../plans/task_m010_1_impl.md)
Stage: 6.1 / 기준: `1d1df32`, `local/task1`

## 단계 목적

사용자가 요청한 저장본 재편집, 중복 안내 제거, 같은 스레드의 수정본 카드·PDF·썸네일 통합을 구현한다. 기존 Studio 직접 진입과 문서 비영속 정책을 유지한다.

## 산출물

| 파일 | 변경 요약 |
| --- | --- |
| src/server/documents.ts | 원본/수정본 Work Object, 수정본 번호·계보, 같은 메시지의 PDF·PNG 참조, 내부 PDF 링크 |
| src/server/saves.ts, uploads.ts | 비공개 업로드와 실제 카드 공유 확인 분리; 응답 유실 시 동일 파일/카드 재확인 |
| src/server/jobs.ts | 검증된 수정본 bytes를 기존 200 MiB·15분 캐시 안에 보관 |
| src/conversion/, src/server/pdf-jobs.ts | 동일 print DOM에서 PDF와 제한된 첫 페이지 PNG를 한 변환 작업으로 생성 |
| tests/slack/, tests/viewer/slack-flow.spec.ts | 수정본 재열기·재저장·원본 접근 회수·게시 응답 유실·공유 지연 회귀 |
| README, docs/, 계획·orders·통합 보고서 | 동작·Slack 표시 제약·검증 경계 갱신 |

## 본문 변경 정도 / 본문 무손실 여부

원본 문서와 엔진을 수정하지 않았다. 저장본은 `원본명_편집본_1.hwp`처럼 번호가 붙은 새 파일이며, 그 수정본의 제목으로 Studio를 다시 연다. 수정본 접근 시 해당 파일과 최초 원본의 권한을 확인한다. 같은 UUID/bytes 재시도는 동일 업로드와 카드만 재확인하며 공유가 확인되지 않으면 clean 처리하지 않는다. 재시작을 넘는 중복 방지는 기존과 같이 미지원이다.

본문의 `문서 제목을 눌러 편집 · PDF로 보기` 문구와 URL action 버튼을 제거했다. PDF는 실제 Slack 파일 permalink를 사용하는 mrkdwn 링크다. PNG는 Slack 파일로 보관하고 Work Object preview에서 참조한다. 파일 업로드 완료 시 channel_id를 생략하고 카드 metadata의 자동 공유를 사용하므로 별도 PDF 댓글을 생성하지 않는다.

## 검증 결과

### 자동 검증

- `npm run check`: Node 51개(단위 7·Slack 22·보안 22), 브라우저 정상 16개 통과. 기존 B-004 expected-failure 1개 재현. 로그: `.cache/validation/stage61-final-check.log`.
- 실제 production HTTP → Studio 편집 → HWP 저장 → PDF/PNG 생성 → 수정본 재열기: 원본 bytes 불변, 수정본 캐시/업로드 bytes 일치, 파일명과 새 편집 세션 확인. PNG 및 PDF 첫 페이지를 직접 보아 한글·표·추가 문구를 확인했다. 합성 fixture이며 한컴 출력 일치의 증거는 아니다.
- Linux ARM64: `docker --context colima build --target smoke -t rhwp-slack:smoke .` 후 network none·non-root·read-only·4 GiB·CPU 2·PID 256에서 Node 51 + production 브라우저 1 통과. cgroup peak **2,848,636,928 bytes**, OOM kill 없음. 로그: `.cache/validation/stage61-final-linux.log`.
- release 이미지 `rhwp-slack:stage61`: `sha256:4ed99abb79ceb381726967157405e91ae4503dd82125b549445c81a86c33b4ca`.
- `git diff --check` 통과. `.env`와 검증 캐시는 Git 제외 확인.
- 최종 서버/변환 source diff SHA-256: `38b6a00f0ffbb930d4e5cb5489f20570bdb0da813f74fbe68d615e974b6f31dd` (`git diff -- src/server src/conversion | shasum -a 256`).

### 실제 Slack 검증

사용자 승인된 비공개 `rhwp-slack-test` 채널의 합성 문서만 사용했다.

- [최종 원본 카드와 수정본 스레드](https://rhwphq.slack.com/archives/C0C1X3ENGD8/p1789466064356859).
- 원본 제목 → Slack 안의 Studio → `Revision one ` 추가 → 저장. 첫 수정본 카드 한 개가 부모 스레드에 생성됐다.
- 첫 수정본 제목 → Studio 재열기. 실제 화면에서 저장한 `Revision one`과 표를 확인했다. `Revision two `를 추가해 재저장했다.
- 스레드 댓글은 **두 개**이며 수정본 1·2가 같은 부모 아래 표시됐다. 별도 PDF 완료 댓글은 없었다.
- 둘째 수정본의 PDF 링크 → 같은 Chrome 탭의 Slack 미디어 뷰어. 두 페이지와 `Revision two Revision one` 누적 문구를 확인했다.
- macOS Slack에서도 원본 카드 메시지의 **PDF로 보기 링크 자체**를 클릭해 `Slack PDF 뷰어`의 두 페이지와 한글·표를 확인했다. 외부 브라우저로 이동하지 않았다. 증거: `.cache/validation/stage61-desktop-pdf.jpeg`.
- 기존 임시 터널 만료로 승인된 Cloudflare 연결을 갱신하고 앱 매니페스트의 명령·이벤트·상호작용·embed 도메인과 `.env` 주소를 일치시켰다. `/healthz`와 실제 명령·편집 수신을 확인했다. 개발 서버 4173은 공개하지 않았다.

### Slack 표시 방식의 실제 제약

Work Object에 썸네일이 있으면 내부 추가 필드가 카드의 잘린 영역 밖에 표시되는 것을 확인했다. PDF 링크는 같은 메시지 상단에 두어 항상 조작할 수 있게 했다. Slack은 화면/펼침 상태에 따라 HWP 카드와 PDF를 같은 댓글의 첨부 두 개로 묶고 썸네일을 접어서 표시한다. 앱이 Slack의 이 표시 방식을 강제하지 않는다.

공식 근거: [Work Objects 파일 자동 공유와 필드](https://docs.slack.dev/messaging/work-objects-implementation/), [files.completeUploadExternal](https://docs.slack.dev/reference/methods/files.completeUploadExternal/). 실제 클라이언트 결과와 합성 API 테스트를 구분했다.

## 잔여 위험

- 임시 HTTPS와 메모리 카드/세션이다. 서버 재시작 또는 원본/수정본 캐시 만료 후에는 `/rhwp open`으로 다시 준비한다. 과거 카드/테스트 메시지를 자동 이동·수정하지 않았다.
- 실제 사용자 탈퇴/공유 회수·네트워크 장애 주입·모바일·배포형 앱 조건은 별도 수용 범위다. 관련 보안/재시도 계약은 합성 API에서 검증했다.
- 최대 20 MiB·200페이지 입력의 자원 보장은 아니다. 기존 worker/Chromium 격리 한계와 엔진 B-003/B-004는 유지한다.
- Slack 원본 파일 분류 자체는 binary일 수 있다. 새 수정본의 rhwp 카드가 직접 편집 경로를 제공하며 파일 형식을 거짓으로 변경하지 않는다.

## 다음 단계 영향

첫 페이지 카드 썸네일은 완료했다. `/rhwp`의 첫 페이지 이미지 단독 명령, 전체/지정 페이지 PNG·ZIP은 후속 범위다. 원격 push/PR/이슈 close는 수행하지 않았다.

## 승인 요청

이 단계의 구현·검증을 인계한다. 후속 범위 또는 PR 게시 절차는 다음 지시에 따라 진행한다.
