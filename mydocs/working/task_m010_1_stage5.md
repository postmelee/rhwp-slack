# Task #1 Stage 5 — Work Objects 내부 편집과 Slack 편집본 저장

GitHub Issue: [#1](https://github.com/postmelee/rhwp-slack/issues/1)
구현계획서: [task_m010_1_impl.md](../plans/task_m010_1_impl.md)
Stage: 5

## 단계 목적

사용자의 “진행해줘”를 Stage 5 진입 승인으로 적용했다. 기준 `6c028e0`에서 Work Object 카드·편집 세션·새 파일 저장·PDF 공유 adapter를 구현했다. 실제 Slack 자격 증명과 HTTPS 주소가 없어 외부 메시지 전송·앱 설정 변경은 수행하지 않았으며 합성 Slack API로 검증했다.

## 산출물

| 파일 | 변경 요약 |
| --- | --- |
| `src/server/documents.ts`, `receiver.ts` | Work Object 게시·PDF 상태 갱신, entity_details_requested·block_actions, 사용자별 편집 진입 |
| `sessions.ts`, `editor-routes.ts` | 60초 일회용 ticket, 10분 idle·60분 최대 세션, 인증 원본·저장·결과 API, production 정적 자산·CSP |
| `uploads.ts`, `saves.ts`, `pdf-jobs.ts` | 실제 Slack upload adapter, 동일 요청 결속·완료 응답 재확인, 원본 보존·새 편집본·별도 PDF 큐 |
| `validate-document.ts`, `src/conversion/validate-child.mjs` | Slack 자격 증명 없는 격리 파서, 20 MiB·200페이지·30초 저장 입력 검증 |
| `src/editor/main.ts`, `save.ts`, `style.css` | ticket 교환·인증 원본 로드, 실제 세션 저장 버튼·미저장 상태·같은 요청 재확인 |
| `studio/vite.config.ts` | 현재 revision 비교와 clean 처리를 같은 Studio 실행 단계에 묶는 overlay |
| `.env.example`, `slack/manifest.json` | APP_ORIGIN, files:write, entity_details_requested |
| `tests/slack`, `tests/security`, `tests/viewer` | 실제 HTTP·Studio·격리 파서·PDF와 합성 Slack API를 연결한 검증 |
| README·docs·계획·orders | 실행과 아키텍처·현재 범위·검증/미검증 인계 |

## 사용자 동작

“문서 열기”는 PDF 준비를 기다리지 않고 자체 호스팅 Studio 편집기로 진입한다. “PDF로 보기”는 공유 완료된 PDF의 Slack permalink를 사용한다. 채널에 게시하는 카드에는 ticket을 넣지 않고 권한을 재확인한 사용자별 details 응답에만 넣는다.

편집기 상단에 별도 메뉴·모드 전환을 추가하지 않았다. 전체 화면의 원래 Studio 메뉴와 도구막대를 유지하고 실제 편집 세션에만 하단 저장 영역을 표시한다. 편집본은 원래 채널/스레드에 새 HWP/HWPX로 저장하며 원본을 덮어쓰지 않는다. 이후 PDF 생성 실패는 HWP/HWPX 저장 성공을 취소하지 않는다.

현재 revision의 epoch/changeSeq/hash가 export 시점과 같을 때만 Studio 내부에서 clean 처리한다. 저장 중 추가 편집과 저장 실패는 dirty 상태 및 저장 영역의 미저장 표시를 유지한다. HTTP 응답이 끊겼을 때도 같은 세션·UUID·bytes로 재확인하고 파일 ID별 완료 호출을 반복하지 않는다.

## 검증 결과

환경: macOS arm64, Node 24.21.0/npm 11.19.0, Bolt 5.1.0, rhwp/core/editor/Studio 0.8.6, Playwright 1.63.0/Chromium 153.

```sh
npm run typecheck
npm test
npm run test:slack
npm run test:security
npm run test:viewer
git diff --check
```

- 타입·production/development 빌드·diff 검사 통과.
- Node 검사: 단위 7개 + Slack 16개 + 보안 18개 = **41개 정상 통과**.
- 브라우저: **16개 정상 통과**, 기존 B-004 expected-failure 1개 재현. Playwright 요약의 “17 passed”는 expected-failure를 포함하므로 정상 통과 수로 합산하지 않는다.
- 실제 서명된 entity event와 Work Object flexpane action에서 event.user/channel/trigger_id 및 container.channel_id 계약을 검사했다. 중복 이벤트·action은 preview 응답을 반복하지 않는다. PDF 변환 대기 중에도 Studio ticket이 발급되며 채널 metadata에는 ticket이 없다.
- ticket 재사용·60초 만료·권한 확인 도중 무효화, 세션 만료, 잘못된 Origin·bearer, 다른 채널, 권한 취소 후 source/document/save/status 접근을 거절했다.
- 업로드 URL의 host/path·redirect 제한과 bot token 미전달, 최종 공유 직전 권한 확인을 검사했다. 완료 응답 손실 시 기존 파일 공유를 확인하고 동일 파일 ID로만 재확인했다. 같은 저장 ID에 다른 bytes는 충돌로 거절했다.
- 실제 HWP/HWPX를 격리 파서로 검증했다. 파서 오류·201페이지·deadline 입력은 거절했다. PDF 생성 실패 후에도 저장 영수증은 성공을 유지한다.
- production Studio에서 실제 키보드 편집·export·저장을 실행했다. 업로드를 대기시키고 추가 입력한 뒤 첫 export에 후속 입력이 없음을 core로 확인했으며 현재 문서는 dirty였다. 이어 현재 revision을 저장하면 clean 상태가 됐다. 실패 후 재확인은 같은 요청 ID·bytes를 보냈다.
- production HTTP 서버 → 실제 ticket 교환 → Studio 편집 → 격리 파싱 → Slack upload adapter → 실제 PDF 변환을 한 흐름으로 검증했다. Slack API와 업로드 대상만 합성 응답이며 외부 Slack 전송은 없다. 원본/PDF/새 HWP의 공유 대상이 원래 thread_ts인 것을 확인했고 보관 원본 bytes는 불변이었다.
- 실제 편집본 PDF는 A4 2페이지이며 `Saved revision`과 원래 한글·표·두 번째 페이지 문구가 추출됐다. 669×863 편집 화면과 PDF 첫 페이지를 직접 열어 입력 문구·제목·표가 표시되고 새 상단 영역 없이 저장 버튼이 하단에 보임을 확인했다. 이는 합성 문서 검증이며 한컴 정답지와의 일치 판정이 아니다.
- 기존 undo/redo·export 왕복·복구/최근/이력 기록 차단·sandbox·개발 입력 비노출·원본 PDF 유지 회귀도 실행했다. 엔진 B-003/B-004는 미해결로 보존한다.

로그: `.cache/validation/stage5-checks.log`, `stage5-viewer.log`.
소스 manifest: `.cache/validation/stage5-source-manifest.json`, SHA-256 `3e4ba455e2b9a9639ccf17d29c0dad948f6110e09f367d27a82b79904640eb3f`.
이미지/PDF: `test-results/slack-production-flow.png`, `slack-save-hwp.png`, `slack-save-hwpx.png`, `slack-edited.pdf`, `slack-edited-page1.png`. 이 파일들은 합성 검증 산출물이며 Git에는 추가하지 않는다.
검증 기준은 위 manifest와 이번 보고서를 묶어 커밋한 소스다. 기존 CanvasKit Node 모듈 외부화·큰 청크 빌드 경고는 유지한다.

## 미검증과 인계

- 실제 Slack 앱 설정·manifest 수용·files:write 권한·Work Objects embeds·Slack 웹/데스크톱 PDF 기본 보기·편집본 업로드는 **미검증**이다. 합성 API 통과를 실제 Slack 수용으로 표시하지 않는다.
- Slack의 필수 파일/채널 권한 필드가 실제 응답에 없으면 fail-closed로 거절한다. 실환경 응답을 대조하기 전 허용 조건을 완화하지 않는다.
- source bytes는 15분 뒤 만료된다. 세션·중복 기록은 메모리에만 있어 재시작을 넘는 복구·exactly-once를 보장하지 않는다. 이미 브라우저로 받은 bytes를 세션 만료로 회수할 수는 없다.
- 서버 파서/PDF는 프로세스와 deadline으로 분리하지만 OS 메모리·CPU 하드 제한은 아직 없다. 원본 보관 200 MiB 외에 저장·PDF 큐와 엔진 메모리가 추가된다. Linux 컨테이너·비root 실행·운영 격리는 Stage 6 범위다.
- 파일 공유 성공 후 permalink 조회가 실패하면 파일은 저장된 상태다. PDF 링크 버튼은 확인된 permalink가 있을 때만 제공한다. PDF 전용 재시도 버튼은 없으며 저장된 HWP에 `/rhwp pdf`를 사용한다.
- 다음 단계는 **Stage 6 — Linux 실행과 실제 Slack 통합 검증/인계**다. 첫 페이지 썸네일·전체/지정 PNG·ZIP 요구는 B-002 후속 task로 유지한다.
