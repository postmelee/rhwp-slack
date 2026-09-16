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
