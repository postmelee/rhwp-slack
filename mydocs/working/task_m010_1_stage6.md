# Task #1 Stage 6 — Linux 실행과 실제 Slack 연결 검증

GitHub Issue: [#1](https://github.com/postmelee/rhwp-slack/issues/1)
구현계획서: [task_m010_1_impl.md](../plans/task_m010_1_impl.md)
Stage: 6 / 검증일: 2026-09-15

## 단계 목적

기준 `8d935f3`에서 Linux 배포 입력과 실행 경계를 마련하고 실제 Slack 연결을 확인했다. 사용자의 Stage 6 진행, .env 설정, 비공개 테스트 채널 초대 및 Cloudflare 임시 HTTPS 연결 승인을 적용했다. 구현과 자동 검증은 완료했으며 아래 실제 수용의 잔여 항목은 출시 완료와 구별한다.

## 산출물

| 파일 | 변경 요약 |
| --- | --- |
| Dockerfile, .dockerignore, compose.yaml | 고정 Node 이미지·lockfile, non-root release, 읽기 전용/자원 제한, 테스트 전용 smoke 계층 |
| scripts/check.mjs, container-smoke.mjs, healthcheck.mjs | 순차 통합 검사, 실제 PDF/HTTP/Studio와 합성 Slack API 검사, 상태 확인 |
| scripts/slack-manifest.mjs, slack-preflight.ts | 앱 생성/연결 manifest, 비밀값을 출력하지 않는 설치 확인 |
| package.json, package-lock.json, prepare-studio.mjs | 실제 runtime 의존성 분류, upstream 준비 제한 시간 |
| src/conversion/worker-env.mjs, convert.mjs | 파서·Chromium에 Slack 비밀 환경변수 상속 차단 |
| src/server/config.ts, main.ts | 기본 localhost, 컨테이너 명시적 수신 주소 |
| src/server/slack-api.ts, access.ts | 실제 Slack GET/form 인코딩 및 일반 hosted 파일 공유 응답 대조 보정 |
| src/server/documents.ts, receiver.ts, commands.ts | 기본 카드 제목으로 편집, 과거 열기 action 안내, 명령 URL 자동 치환 안내 |
| .github/workflows/ci.yml, tests/, playwright.config.ts | Linux 검사 job, 실제 응답 형태·회귀 검사, read-only 테스트 산출 경로 |
| README, docs/, 계획·orders·보고서 | 실제 동작과 미검증, 메모리 실측, 임시 HTTPS 설정 인계 |

## 본문 변경 정도 / 본문 무손실 여부

원래 Studio 메뉴·편집 UI와 비영속 문서 정책, `/rhwp` 이름을 유지했다. 별도 PDF 화면과 상단 테스트 상자는 재도입하지 않았다. 과거 단계 보고서는 수정하지 않고 현재 API 보정 근거를 계획에 추가했다. 사용자 원본·비밀값·실제 Slack 응답과 화면은 Git에 포함하지 않는다.

## 검증 결과

### 자동 검사

환경: macOS ARM64, Node 24.21.0/npm 11.19.0, rhwp 0.8.6; Docker Linux ARM64/Colima.

```sh
npm run check
docker build --target smoke -t rhwp-slack:smoke .
docker run --init --network none --read-only \
  --tmpfs /tmp:rw,nosuid,nodev,size=512m,mode=1777 --shm-size=256m \
  --memory=4g --cpus=2 --pids-limit=256 --cap-drop=ALL \
  --security-opt=no-new-privileges rhwp-slack:smoke
docker build --target release -t rhwp-slack:stage6 .
git diff --check
```

- `npm run check`: typecheck 성공; unit 7, Slack 19, security 22, 브라우저 정상 16 = **정상 64개**. 기존 B-004 expected-failure 1개는 그대로 재현되어 runner 요약은 브라우저 17 passed다. 이를 결함 해결로 세지 않는다.
- 최신 v7 smoke: Node 48개, production HTTP→Studio 실제 편집→저장 검증→revision PDF 브라우저 1개 통과. Slack API만 합성이다. ExitCode 0, OOMKilled false, cgroup oom_kill 0, peak **2,937,827,328 bytes**.
- 서버 단독 실제 HWP/HWPX PDF: 2 GiB에서 OOM 실패, 4 GiB에서 성공(peak 2,259,009,536 bytes). 이에 Compose/CI를 4 GiB로 설정했다. 이 실측 이후 adapter/UI를 보정하고 최신 전체 smoke를 다시 통과했다.
- release 이미지: `sha256:c5a16329720f8bfcd466783ddcf9c225bc394f87bf71de12475b1d9890392e7a`, USER node. smoke는 production 3000 서버를 상시 실행하지 않으므로 production HEALTHCHECK의 unhealthy와 테스트 프로세스 통과는 구별한다. 실제 호스트 서버의 `/healthz`는 임시 HTTPS 경유로 확인했다.
- 로컬 증적: `.cache/validation/stage6-check-thread-final.log`, `stage6-docker-build-v7.log`, `stage6-v7.log`, `stage6-release-v7.log` (Git 제외).
- CI 설정은 추가했지만 원격 CI 실행은 아직 하지 않았다. 위 결과는 이 보고서와 함께 저장한 소스 변경에 대한 로컬 결과다.

### 실제 Slack 시나리오

사용자가 만든 비공개 테스트 채널과 이 저장소의 2페이지 합성 HWP만 사용했다.

| 시나리오 | 결과와 직접 관찰 |
| --- | --- |
| 앱 등록·서버 연결 | OK — 명령/이벤트/interactivity 주소 저장, URL 검증, file entity·허용 domain·allow-same-origin 활성화, auth.test 및 `/rhwp help` 응답 |
| 원본 공유·인증 다운로드 | OK — 실제 업로드 후 production 권한 검사와 다운로드 성공. 웹 저장 후 원본을 다시 내려받아 fixture SHA-256 일치 확인 |
| 웹 Studio 열기·편집·저장 | OK — 기본 카드 열기로 2페이지 표시, `Slack edit verification ` 입력, 미저장 상태, 저장 후 변경 없음/편집본과 PDF 저장 성공 안내 확인 |
| 최신 카드 | OK — 별도 문서 열기 버튼 없음, PDF로 보기 유지, 제목 클릭으로 데스크톱 Studio 직접 열림 |
| 수정본 스레드 누적 | OK — 수정 후 실제 새 카드에서 편집/저장 실행. 오른쪽 스레드의 최초 PDF·수정본 HWP·수정본 PDF 3개 답글을 확인하고 files.info의 private 공유 thread_ts가 모두 카드 부모와 같음을 대조했다. `.cache/validation/stage6-live-thread.json`에 로컬 증적 보존 |
| 데스크톱 Studio | 열기 직접 확인, 입력/저장은 사용자 확인 — 자동 입력에서는 문단 창이 열렸지만 사용자 직접 입력/저장은 정상이라는 답변과 저장 완료 화면을 받았다. 사용자가 저장 위치가 채널 최상위임을 보고해 카드 스레드 누적을 보정했다 |
| PDF로 보기 URL action | 부분 확인 — 실제 Slack PDF permalink로 연결. 웹의 새 탭/앱 선택 화면을 거치므로 무조건 인라인 열기라고 판정하지 않음 |
| 데스크톱 PDF 첨부 | OK — Slack 기본 pdf-viewer에서 2페이지, 한글 제목·표·둘째 페이지 색상 사각형을 직접 시각 확인 |
| HWPX 실제 Slack·다중 파일 메뉴·권한 회수·저장 장애 | 미검증 — HWPX 변환/편집과 권한·만료·재시도는 자동 검사로 확인했지만 실제 Slack 시나리오 전체를 실행한 것은 아님 |

원본 불변 검증 SHA-256: `176179dea7ddccc397b0497a980e8a2ea1dd2dfe576f5fbee8b8cdf3f995325c`, 13,824 bytes. 페이지 수/해시는 레이아웃 일치의 대체 근거가 아니다. 시각 확인은 합성 입력의 표시 확인이며 한컴 출력 정합성 전수 검증이 아니다.

### 실제 환경에서 수정한 원인

1. 조회 JSON POST와 업로드 JSON 인수가 실제 API에서 무시/거절되어 공식 GET query와 SDK 방식 form 인코딩으로 수정했다.
2. 일반 hosted 파일은 제한 공유 flag를 생략한다. visible·동일 team·완전한 공유 목록·현재 채널·사용자 참여 증거 조합을 요구하도록 보정했다. 명시적 제한은 거절한다. [Slack 파일 예제](https://docs.slack.dev/messaging/working-with-files/)와 실제 응답을 대조했다.
3. 별도 열기 action의 trigger는 `entity.presentDetails`에서 invalid_trigger_id였다. 기본 카드의 entity_details_requested는 성공했으므로 카드 제목을 편집 진입으로 사용한다.
4. 최상위 카드의 thread_ts가 비어 저장본이 새 채팅으로 올라갔다. 사용자 요청에 따라 게시 응답 ts를 부모로 보관하고 기존 스레드는 부모를 유지한다. 최초 PDF·편집 세션·두 수정본 모두 같은 부모로 공유하며, 부모 식별 실패는 거절한다. 서로 다른 부모/답글 ts 및 스레드 미지정 production 저장을 회귀 검사했다.
5. Slack 입력기가 URL을 파일 제목으로 바꾸면 명령이 URL을 받지 못한다. 붙여넣기 직후 실행 취소 1회로 URL을 복원하거나 메시지 메뉴를 사용하도록 안내한다.

## 잔여 위험

- 실제 수용 전체와 운영 출시를 완료한 상태가 아니다. 실제 권한 회수·장애 경로, 모바일과 일반 배포/Marketplace는 별도 확인 대상이다.
- PDF URL action은 [공식 동작](https://docs.slack.dev/messaging/work-objects-implementation/)상 브라우저를 연다. 기본 PDF 첨부 미리보기와 버튼의 클라이언트 이동을 구분한다.
- 임시 tunnel은 프로세스 종료 시 사라지고 주소가 바뀔 수 있다. 서버 문서/세션도 메모리 보관이며 재시작 후 오래된 카드 대신 명령을 다시 실행해야 한다.
- Chromium 내부 sandbox는 기본 launch에서 꺼져 있다. 컨테이너 제한과 worker 비밀 환경변수 차단을 완전한 악성 파일 격리로 주장하지 않는다. 최대 입력의 메모리 상한도 미검증이다.
- B-003 HWPX 그림 문단, B-004 혼합 서식 undo는 엔진 후속 과제로 유지한다.

## 다음 단계 영향

남은 실제 수용을 보완하고 정식 HTTPS·운영 worker 경계를 정한다. 첫 페이지 썸네일·전체/지정 페이지 PNG·ZIP은 B-002 후속 범위로 보존한다. 원격 push/PR/이슈 close는 아직 수행하지 않았다.

## 승인 요청

이 보고서는 구현·검증 인계 자료다. 남은 실제 수용 결과와 사용자 확인을 반영한 뒤 PR 게시 단계로 진행한다.
