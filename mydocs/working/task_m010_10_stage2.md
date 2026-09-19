# Task #10 Stage 2 — PDF/PNG 게시 병렬화

GitHub Issue: [#10](https://github.com/postmelee/rhwp-slack/issues/10)
구현계획서: [task_m010_10_impl.md](../plans/task_m010_10_impl.md)
Stage: 2

## 단계 목적

이미 생성된 PNG가 PDF 게시 완료를 기다리는 애플리케이션 콜백 대기를 제거한다.

## 산출물

| 파일 | 변경 요약 |
|---|---|
| src/server/cloud/application.ts | PDF 작업 1개와 기존 PNG pool을 독립 실행. Promise.allSettled로 lease 반환 전 양쪽 회수. 전부 공유된 경우 중복 최종 사전 갱신 생략 |
| tests/slack/cloud-application.test.ts | PDF 전송을 막아 둔 동안 PNG 시작, 실패 뒤 PDF만 재시도·PNG receipt 재사용 검증 |

## 본문 변경 정도 / 본문 무손실 여부

converter의 onPdf/onPage 콜백 계약은 유지한다. 애플리케이션이 PDF 게시 작업을 등록한 뒤 스트림 소비를 계속한다. 기존 권한·fence·직렬 메타데이터 쓰기를 유지한다.

## 검증 결과

`npm run typecheck`, `npm run test:slack`, `npm run test:security`: 타입 검사 통과, Slack 81/81, 보안 28/28.

PDF를 지연시키고 PNG 전송 시작 전에는 gate를 풀지 않는 테스트로 실제 독립 실행을 확인했다. 정상·PDF 실패 각각 확인, 실패 시 PNG 업로드 1회 유지. 기존 PNG 실패→PDF 재사용, lease 소실 회귀 통과.

## 잔여 위험

실제 Slack API 지연과 화면 갱신 시간은 Cloud Run 검증에서 비교한다. 업로드 총 동시성은 PDF 1개 + 설정된 PNG 1 또는 2개로 유한하다.

## 다음 단계 영향

변환 출력은 동일하며 다음 단계에서 runtime의 수명만 확장한다.

## 승인 요청

동일 스레드에서 승인한 순서에 따라 Stage 3을 진행한다.
