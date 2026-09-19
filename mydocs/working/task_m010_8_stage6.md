# #8 Stage 6 — Pages C 운영 전환

GitHub Issue: [#8](https://github.com/postmelee/rhwp-slack/issues/8)
구현계획서: [task_m010_8_impl.md](../plans/task_m010_8_impl.md)
검증일: 2026-09-20 KST

## 목적과 변경 범위

사용자의 C 전환 요청에 따라 공개 편집기 프로그램을 Pages에서 제공한다. API·권한·문서 전달·저장·변환은 기존 Cloud Run을 유지한다. 속도 우위가 아닌 프로그램 전송 비용 분리가 선택 이유이며 월 실청구 절감은 아직 측정하지 않았다.

실행 소스 `c6e609dcf3af0ff2d8f546ac91c3bc015f419121`와 B의 ingress 이미지 `sha256:cecce003ca327ca3cc8660bc1a7d02fd2e08db82b8a13890d702a8f5b2d61ebd`를 그대로 사용했다. 이 단계의 Git 변경은 계획·결과·운영 문서뿐이다. CPU/메모리/min/max/동시성/worker/예산/OAuth scope/Firestore namespace는 바꾸지 않았다.

## 배포 결과

| 대상 | 운영 값 |
|---|---|
| Pages 프로젝트·고정 origin | `rhwp-slack-editor` · `https://rhwp-slack-editor.pages.dev` |
| Pages deployment | `30c658f9-ca1e-4584-9372-8a5a189cb452` |
| 프로그램 namespace | `78e373467afb21ac634c3312ea53441245d94e2470baff0e1e8f34adc4399d0f` |
| API·APP_ORIGIN | `https://rhwp-ingress-aaj47f2u5q-uc.a.run.app` |
| ingress | `rhwp-ingress-task8-c1`, 100%, EDITOR_ORIGIN에 고정 Pages 주소 |
| worker | `rhwp-worker-00008-6t7`, 100%, 변경 없음 |
| 즉시 복구 리비전 | `rhwp-ingress-task8-b2` |

Slack Work Object Previews의 embeds 허용 목록에 정확한 Pages hostname을 추가하고 저장·재조회했다. 기존 도메인과 sandbox 설정은 보존했다. 별도 preview URL이나 wildcard를 허용하지 않는다. Pages는 프로그램만 제공하며 Functions·DB·비밀값·문서 산출물을 배포하지 않는다.

Pages CLI의 source `1803d1c`는 전환 계획 커밋이며 프로그램 source SHA와 구분한다. 동일 namespace/58개 identity 파일/43,294,079 bytes가 Linux manifest와 SHA-256 전수 일치했다. 전체 manifest는 압축 representation 차이로 동일하지 않아 압축 해시와 identity 검증을 혼동하지 않았다.

## 검증 결과

| 확인 | 결과 | 비공개 로컬 증거 (`.cache/validation/`) |
|---|---|---|
| 공개 프로그램 일치 | 58개 identity hash 일치, 원격 Studio HTML·두 WASM hash 일치 | `task8-c-pages-build.json`, `task8-c-pages-http.json` |
| Pages HTTP | editor 200·고정 API meta·CSP·no-referrer, 없는 API/버전 404 | `task8-c-pages-http.json` |
| 운영 Origin 경계 | 정확한 Pages preflight 204, 다른 origin 403 | `task8-c-production-cors.json` |
| 실제 인증·저장 | 독립 Chromium 열기·문자 입력·편집본 6 저장·PDF ready, page error 0 | `task8-c-browser-accept.json` |
| Slack 웹 내부 편집 | B에서 만든 기존 카드→Pages iframe→입력→편집본 7 저장 완료 | `task8-c-slack-web-saved.png` |
| Slack 데스크톱 내부 편집 | 편집본 7 카드→내부 Studio→문자 붙여넣기→편집본 8 저장 완료 | `task8-c-slack-desktop-saved.jpeg` |
| 저장 연결·산출물 | 편집본 6/7/8 모두 같은 원본 스레드, 2페이지·PDF ready·PNG 2개 ready | `task8-c-saved-cards.json` |
| 복구·재전환 | B2 100%에서 기존 편집본 열기 성공 후 C1 100% 복귀·같은 편집본 열기 성공 | `task8-c-rollback.json` |

트래픽 검증 시각은 UTC 2026-09-19 19:26:18(B2) → 19:26:33(B 열기) → 19:26:39(C1 복귀) → 19:27:32(C 열기)다. mutation 응답만 신뢰하지 않고 services describe로 100% 배정을 확인했다. 처음 0%·untagged 후보의 latestReady가 B를 가리켰으나 `editor-c` tag 부여 후 C readiness가 True임을 확인하고 전환했다.

복구 검사 도구에서 B 검증 후 종료한 Firestore client를 C 검사에 재사용해 로컬 오류가 한 번 발생했다. 운영 C 복귀는 이미 성공했으며 C 열기를 새 프로세스에서 재검증했다. 제품 오류로 집계하지 않는다. 데스크톱 붙여넣기 도구도 clipboard 완료 신호를 기다리다 timeout을 반환했지만 화면에 정확한 문자열·dirty 상태가 확인되어 반복 입력하지 않고 저장했다.

웹·데스크톱 화면에서 합성 문서의 한국어·표·2페이지와 입력 문자열을 직접 확인했다. 엔진 변경은 없으며 한컴 정답지 비교나 69페이지 전수 시각 검증을 새로 수행하지 않았다. 사용자 원본·본문·스크린샷·인증정보는 Git/PR에 포함하지 않는다.

## 복구와 운영 한계

- B2로 트래픽을 복구하면 새 편집은 Cloud Run에서 열린다. 기존 Pages 창은 카드에서 다시 열어야 할 수 있다. 미저장 내용 자동 복구는 지원하지 않는다.
- 버전 HTTP·legacy 갱신 회귀는 Stage 2–5 결과를 유지한다. 이번에는 동일 프로그램의 B/C provider 전환과 실제 기존 카드 재진입을 추가 검증했다. 서로 다른 새 엔진 버전의 운영 교체를 시험한 것은 아니다.
- C의 PDF/PNG 생성·같은 스레드 연결은 확인했다. 데스크톱 PDF 뷰어 재확인은 Mac 잠금으로 완료하지 않았으며 B 단계의 기존 뷰어 검증과 구분한다. 편집·저장 수용과 실제 산출물 확인은 잠금 전에 완료했다.
- Stage 5의 C 속도 수치는 lab 주소에서 n=3으로 측정한 값이다. 새 운영 hostname의 성능이나 월 청구를 재측정한 값으로 표시하지 않는다.
- Pages에 프로그램을 옮겨도 ingress min1 대기·API·worker 변환·Firestore/Tasks 비용은 남는다. 예산 알림은 강제 상한이 아니다.
- 비교 lab/tag는 PR 리뷰·복구 확인을 위해 보존하며 추가 min instance는 없다. Marketplace/다중 workspace 작업은 범위 밖이다.

## 문서와 제출

공식 운영 위치는 기존 `docs/cloud-run.md`, `docs/static-hosting.md`, `docs/development.md`를 갱신했다. 작업 결과는 본 문서와 최종 보고서·오늘할일에 연결한다. 기존 [PR #12](https://github.com/postmelee/rhwp-slack/pull/12)에 반영하며 병합·이슈 close는 수행하지 않는다. 최종 head의 CI는 PR Checks를 확인한다.
