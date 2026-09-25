# Task #34 Stage 3 — 통합 및 공개 편집기 수용

구현계획: [task_m010_34_impl.md](../plans/task_m010_34_impl.md)

## 자동 검증

소스 `7a81041e1fb1a7af1bfe910bc36982fc61c2f836`: typecheck, Playwright 32/32, security 53/53, Slack 95/95, unit 10/10, conversion 9/9, diff check 통과. Linux CI는 [run 35720417884](https://github.com/postmelee/rhwp-slack/actions/runs/35720417884)에서 실행하며 최종 결과는 PR에 기록한다.

## 배포와 수용

- Pages `rhwp-slack` production/devel 배포 `b7a3b8fd`에 검증한 프로그램과 기존 홈페이지만 업로드.
- 프로그램 namespace `ea2d06d323e9c93b29e683feb45cdfedd8705b0f6ccf912f143e158d7b881451`; 실제 새 편집창의 script src와 일치 확인.
- Cloud Run API/worker는 PR #32 배포 상태 유지. 이번 변경은 Pages 호스트/Studio 연동만 필요하며 API 형식·원본 인증·서버 변환·자원 사양은 변경하지 않았다. 내부 embed 앱의 Cloud Run 정적 파일에는 이번 변경을 배포하지 않았다.
- Alhanguel `test`의 기존 합성 원본에서 새 편집 창을 열고 `첫 저장 수정 검증 · ` 입력 후 왼쪽 화살표로 커서를 이동했다.
- 저장 버튼 한 번 클릭 → 저장 성공 → `편집본과 PDF를 Slack에 저장했습니다.`; 문서 상태 `변경 없음`.
- 댓글 `1790075914.711579`, 편집본 `F0C3L2SFNUA`: HWP, PDF, 2페이지 PNG. 서버 card도 pdf/imageState=ready, pageCount=2.
- Slack 이미지 뷰어에서 첫 페이지의 한글 접두어·기존 제목·표 내용 보존을 직접 확인했다.

로컬 UI 증적: 현재 Codex 작업의 `rhwp-slack-screenshots-20260922/task34-first-save-success.png`, `task34-saved-page.png`. 개인정보/인증 정보를 추가로 공개하지 않으며 합성 결과만 검증했다. 과거 설치 철회에서 관측한 첫 저장 실패는 이 경로로 해결됐으며 #5의 실제 공유 해제 검증을 대신하지 않는다.

## 남은 범위

수정 전 동일 HWP 회귀 실패 → 수정 후 통과. HWPX는 전후 모두 통과했다. 전체 OS별 IME 전수 검증 및 내부 rhwp-pro 배포는 이번 공개 앱 수용에 포함하지 않는다. 최종 head의 CI·검토 후 병합한다.
