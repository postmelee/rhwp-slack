# Stage 6.4 — 로고와 편집 카드 안내

GitHub Issue: [#1](https://github.com/postmelee/rhwp-slack/issues/1) · M010
구현계획서: [task_m010_1_impl.md](../plans/task_m010_1_impl.md)
Stage: 6.4 · 검증일: 2026-09-16 · 브랜치: local/task1
계획 커밋: b77b17a. 검증 대상 제품 소스는 이 보고서와 같은 커밋이다.

## 단계 목적

사용자 제공 로고를 봇·편집 카드에 통일하고, 편집 안내를 카드 안으로 옮기며 추가 이미지 버튼의 의미를 명확히 한다.

## 산출물

| 파일 | 변경 요약 |
| --- | --- |
| src/server/documents.ts | display_type에 편집 안내, 위쪽 context 제거, 추가 페이지 이미지 버튼 문구 |
| slack/rhwp-logo.png | 원본 전체 픽셀을 보존한 1147×1147 RGBA 정사각형 로고 |
| README.md | 현재 카드 동작과 아이콘 재설정 자산 안내 |
| mydocs/plans/task_m010_1_impl.md, mydocs/orders/20260916.md | 실제 Slack 제약과 최종 구현·완료 상태 |

Slack 앱 Basic Information의 앱 아이콘도 로고로 교체했다. 카드는 기본 앱 아이콘을 상속한다. 별도 product_icon을 지정할 때 나타난 중복 배지는 최종 구현에서 제외했다.

## 본문 변경 정도 / 본문 무손실 여부

원본 로고를 재생성하거나 리사이즈하지 않았다. 사용자 승인대로 투명 여백만 추가했고 원본 영역의 RGBA bytes 일치를 검사했다. 초기 이미지 생성 시도 결과는 채택하거나 배포하지 않았다. 문서 bytes, 접근 권한, PDF·PNG 생성, 갤러리, 편집·저장 동작은 변경하지 않았다.

## 검증 결과

```sh
npm run typecheck
npm run test:slack
npm run test:security
node scripts/build-host.mjs
git diff --check
```

- typecheck 성공. Slack 33개 및 security 22개 통과. security 검사는 중간 표시 구현에서 실행했으며 이후 변경은 카드 metadata·안내와 로고 자산에 한정된다. 최종 소스에서 typecheck·Slack 33개·host build를 다시 통과했다.
- production host·변환 print build 성공. 엔진/Studio source는 변경하지 않아 전체 엔진·Linux smoke를 반복하지 않았다.
- Pillow로 정사각형 크기와 투명 모서리, 원본 영역의 픽셀 완전 일치를 확인했다.
- 최종 소스로 테스트 서버 재시작 후 /healthz 정상. 기존 임시 HTTPS 연결 유지.
- 실제 Slack의 새 합성 12페이지 카드에서 봇·카드 동일 로고, 첫 3페이지 갤러리, 변경한 버튼, 파일명 아래 편집 안내, 중복 안내 제거를 직접 확인했다.
- 최종 카드 PDF 링크를 클릭해 Slack 미디어 뷰어 내부에서 12페이지 표시 확인. 같은 카드에서 Slack 내부 Studio 1 / 12 쪽 및 편집본 저장 버튼 확인. 이번 표시 변경 검증에서는 실제 수정본 저장을 재실행하지 않았다.

최종 시험 카드: https://rhwphq.slack.com/archives/C0C1X3ENGD8/p1789570554026509

## 잔여 위험

- Slack의 간단한 파일 카드는 custom_fields 설명 줄을 표시하지 않았다. display_type에 `rhwp에서 편집 · 이 카드를 클릭하세요`를 합쳤다. 실제 Slack은 첫 글자를 대문자로 표시하고 `in rhwp`를 덧붙인다.
- 기존 카드의 문구를 일괄 수정하지 않았다. 새로 생성되는 카드부터 적용되며 앱 아이콘은 기존 카드에도 반영된다.
- 앱 아이콘은 Slack 앱 설정에 저장된다. 재설치/다른 앱 구성 시 저장소의 로고를 앱 설정에 등록해야 한다.
- 테스트 서버는 로컬 Mac과 임시 HTTPS에 의존한다. 재시작·15분 TTL로 편집 세션이 만료되면 원본에서 다시 요청해야 한다.

## 다음 단계 영향

현재 권한·변환·갤러리 구조를 유지한다. 원격 push·PR·이슈 종료는 수행하지 않았다.

## 승인 요청

사용자가 승인한 UI 수정·실제 Slack 검증·시험 환경 반영을 완료했다. 추가 기능이나 원격 PR 단계는 별도 지시에 따른다.


## 2026-09-17 후속 조사 — 편집기 진입 뒤 비공개 권한 안내

사용자 요청으로 원인을 조사했다. 제품 소스는 aa8a47c에서 변경하지 않았다. 별도 임시 실행기에 요청 종류·주소 일치 여부·실패 호출 위치만 기록했으며, 토큰·trigger 값·문서 내용·원문 URL은 기록하지 않았다.

### 실제 재현에서 확인한 직접 원인

한국 시간 00:30:17.888 및 00:30:18.337에 카드 `4189d65f…`의 `entity_details_requested`가 들어왔다. 둘 다 `refType=document`, `urlMatches=true`였고 오류 안내가 기록되지 않았다. 사용자는 편집 창이 열린 것을 확인했다.

00:30:20.388에는 다른 카드 `086406b6…`를 가리키는 `entity_details_requested`가 추가로 수신됐다. `refType=document`, `hasTrigger=true`지만 `urlMatches=false`였다. 2ms 뒤 동일 요청 문맥에서 `chat.postEphemeral` 권한 오류가 기록됐다. 호출 위치는 `receiver.ts:179`의 catch → `receiver.ts:36`의 notice다. `Documents.authorize` 실패는 기록되지 않았다.

따라서 이번 재현은 `receiver.ts:176`의 `e.entity_url !== documents.url(ref.id)` 검사에서 거절된 것이다. 실제 파일 권한 검사 이전의 카드 참조/주소 불일치를 `denied()`가 일반적인 접근 권한 오류로 표시했다. 정상 파일 업로드나 봇의 파일 재공유 이벤트가 직접 발생시킨 오류는 아니다.

### 범위와 미확인 사항

- 최초 00:08 사례에는 요청 기록이 없어 이번 재현과 동일 원인이었다고 소급 확정하지 않는다.
- 추가 요청이 왜 다른 카드 ID/주소를 사용했는지는 아직 미확인이다. 이전 카드 캐시, 이전 HTTPS 주소, ID와 URL의 잘못된 조합을 구분하려면 주소 원문 대신 origin 일치·경로 유형·경로 ID 일치 여부를 추가 계측해야 한다.
- 로컬 모의 API 재현에서 정상 업로드·봇 재공유·정상 편집 요청은 안내 0개였고, 불일치 URL 및 없는 카드 요청은 해당 문구를 재현했다. 이는 실제 추가 요청 생성 원인까지 입증하지 않는다.
- 초기 디버거 연결이 서버 응답을 지연시켜 종료하고 임시 요청 추적 실행기로 재시작했다. 이후 로컬 및 공개 HTTPS healthz 정상, 실제 사용자 요청 수신을 확인했다. 재시작으로 기존 메모리 카드/세션은 소실됐다. 현재 재현은 복구 후 새로 만든 카드로 수행했다.

수정 방향은 카드 주소/참조 불일치와 실제 권한 거절을 구분하는 것이다. 주소 검사나 파일 접근 검사를 제거하지 않는다. 이번 조사는 제품 동작 수정·원격 push·PR을 포함하지 않는다.


### 추가 분석 — 실패 요청은 9월 15일의 이전 테스트 카드

테스트 채널의 파일 목록 중 HWP/HWPX 19개의 `files.info.entity_id`만 대조했다. 실패한 `086406b6-d333-42de-9c6e-79f00d89e812`는 파일 `F0C2S8ALU00`, `rhwp-slack-합성테스트_편집본_2.hwp`, 생성 시각 2026-09-15 18:57:16 KST와 정확히 일치했다. 새 재현 업로드 `F0C2668CD9T`의 entity ID는 정상 요청의 `4189d65f-dda2-4e1c-a289-2d2f11f87fbd`였다. 두 요청은 서로 다른 실제 파일을 참조한다.

과거 카드의 실제 Slack 화면을 읽어 다음 등록 링크를 확인했다:

`https://dave-hansen-event-night.trycloudflare.com/documents/086406b6-d333-42de-9c6e-79f00d89e812`

현재 앱의 canonical origin은 `https://builds-beneath-scheduled-apartment.trycloudflare.com`이다. 따라서 과거 카드 URL과 현재 `documents.url(ref.id)`는 도메인이 다르다. 실제 요청 원문 URL을 보존하지는 않았으나, 실패한 ID의 등록 URL·이전 origin·수신 시 urlMatches=false가 일치해 이전 서버 주소의 카드 요청을 현재 서버가 거절한 것으로 판단한다. 신규 문서의 카드 ID가 섞였다고 단정할 근거는 없으며, 서로 다른 새 카드 정상 요청과 예전 카드 실패 요청이 연달아 들어왔다.

Slack 공식 문서는 flexpane 재열기/새로고침에서 entity_details_requested가 발생하고, 이미 열었던 flexpane에는 10분 refresh TTL이 있다고 설명한다. 따라서 열려 있던 이전 화면/탭의 갱신이 가능한 설명이다. 어느 Slack 클라이언트·탭이 예전 요청을 생성했는지는 관측하지 못했다.

확인된 문제는 이전 임시 origin의 카드가 Slack에 남아 있는데, 수신 서버는 현재 origin과의 문자열 동일성만 검사하고 이를 일반 권한 오류로 안내한다는 것이다. 추가로 카드 매핑은 메모리에만 있고 Work Object ID가 준비 작업 UUID여서, origin을 통과시키는 것만으로 재시작 이전 카드를 복원할 수 없다. ID 안정성과 매핑 영속화는 별도 내구성 문제이며 이번 이전 주소 요청의 유일한 생성 원인으로 단정하지 않는다.

권장 수정: 승인된 이전 origin의 만료 카드와 실제 접근 거절을 구분하고, 유효한 요청에는 상태 안내를 해당 카드/편집 화면에 표시한다. 고정 origin·안정적인 문서 ID·파일/원본/스레드 매핑 보존과 재조회 시 접근 검증을 마련한다. 알 수 없는 도메인/ID 조합의 검사를 제거하거나 예전 문서를 새 문서로 연결하지 않는다. 이번 분석은 기존 카드 삭제·메타데이터 일괄 변경·제품 소스 수정을 수행하지 않았다.

참고:
- https://docs.slack.dev/messaging/work-objects-implementation/#flexpane-content-refresh
- https://docs.slack.dev/messaging/work-objects-overview/#slack-marketplace-submission-and-launch-considerations
- 이전 카드: https://rhwphq.slack.com/archives/C0C1X3ENGD8/p1789466240257979?thread_ts=1789466064.356859
