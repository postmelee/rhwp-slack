# #8 Stage 1 — 운영 편집기 기준 A

GitHub Issue: [#8](https://github.com/postmelee/rhwp-slack/issues/8)
구현계획서: [task_m010_8_impl.md](../plans/task_m010_8_impl.md)
Stage: 1

## 단계 목적

#10 배포를 고정하고 실제 편집 화면이 준비될 때까지의 시간·전송량을 측정한다.

## 산출물

- `scripts/benchmark-editor.mjs`: 테스트용 Chromium context를 분리하는 재현용 계측. 각 회차 새 context → 같은 문서 새 창 → 다른 편집본 새 창. 티켓 발급 시간은 탐색 시간에서 제외한다.
- 비공개 `.cache/validation/task8-editor-A.json`: 9회 상세 결과. URL fragment/토큰/본문/문서명은 기록하지 않는다.
- 기준 source `93943c7`, ingress `rhwp-ingress-00012-6hv`, image `sha256:bda18bbfb4cd3182e5692749beea87b531107bc37ec707a6f18fac24b8f5906a`.

## 본문 변경 정도 / 본문 무손실 여부

제품 코드와 운영 구성은 바꾸지 않았다. 기존 합성 HWP와 저장된 편집본만 열었으며 메시지나 파일을 새로 게시하지 않았다.

## 검증 결과

`node --check scripts/benchmark-editor.mjs`

`node --import tsx scripts/benchmark-editor.mjs .cache/task8-provider.ts`

macOS ARM64 테스트 클라이언트에서 2026-09-20 KST 측정. 원본/편집본 모두 2페이지이며 별개 파일이다. ingress min=1의 가동 중인 서버를 사용했다. 서버 인스턴스 cold start 실험은 아니며 브라우저 HTTP cache 조건만 바꿨다.

| 브라우저 조건 | n/성공 | 편집 준비 중앙값(범위), 초 | 정적 리소스 전송 중앙값 | 문서 정보/원본 요청 중앙값, 초 |
|---|---|---|---|---|
| 최초 | 3/3 | 10.818 (10.078–11.027) | 12,394,784 B | 2.260 / 1.839 |
| 같은 문서 재열기 | 3/3 | 10.396 (10.357–10.398) | 12,394,784 B | 2.384 / 2.070 |
| 다른 편집본 열기 | 3/3 | 12.094 (11.919–12.792) | 12,394,784 B | 3.360 / 2.807 |

편집 준비는 실제 Studio loadFile 완료 후 저장 버튼 표시까지이다. 첫 픽셀이 그려지는 정확한 시점은 이 값과 구분한다. 전송량은 iframe ResourceTiming 합계로, HTML navigation과 HTTP 헤더 전체를 포함한 청구서 바이트가 아니다. 현재 Cloud Run 프런트에서 압축된 전송이 관찰되므로 모든 정적 파일의 디스크 크기를 네트워크 비용으로 계산하지 않는다.

## 잔여 위험

- 3회/조건의 실측이며 p95·일반 사용자 속도 보장이 아니다. Slack 실제 내장 화면과 네트워크 편차는 최종 단계에서 별도 검증한다.
- A/B 동일 합성 자료로 비교한 뒤 긴 문서/HWPX는 별도 회귀 확인한다.
- 운영 최초/재사용 모두 12.39 MB를 다시 받는다. 정보 조회와 원본 조회는 서버에서 동일 파일 다운로드를 반복한다.

## 다음 단계 영향

정적 자산 캐시와 메타데이터/원본 분리를 순차 적용하여 효과를 분리한다. 비공개 문서/인증 응답에는 캐시를 적용하지 않는다.

## 승인 요청

동일 스레드의 #8 진행 승인 범위로 Stage 2를 계속한다. 추가 비용/권한 확대 없음.
