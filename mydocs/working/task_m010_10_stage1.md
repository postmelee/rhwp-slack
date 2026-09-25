# Task #10 Stage 1 — 기준 측정

GitHub Issue: [#10](https://github.com/postmelee/rhwp-slack/issues/10)
구현계획서: [task_m010_10_impl.md](../plans/task_m010_10_impl.md)
Stage: 1

## 단계 목적

#2 병합 커밋 19d33b9의 출력·시간을 고정한다.

## 산출물

`.cache/task10-bench.mjs`, `.cache/validation/task10-before` (ignored, 원본 내용 비공개).

## 본문 변경 정도 / 본문 무손실 여부

소스 변경 없음.

## 검증 결과

`node .cache/task10-bench.mjs .cache/validation/task10-before`와 동일 69페이지 입력 지정 재실행. Node 24.15 macOS ARM, 각 입력 3회, 매 변환 새 child/browser. 최초 요청은 모듈/OS cache 비용도 포함하며 Cloud Run 수치가 아니다.

| 입력 | 페이지 | 전체 변환 중앙값 ms |
|---|---|---|
| one | 1 | 1030 |
| hwp | 2 | 640 |
| hwpx | 2 | 655 |
| long | 69 | 9638 |

12/12 성공. 초기 large.hwp는 69페이지가 아닌 1페이지 스트레스 fixture였음을 확인하고 기준에서 제외했다. 원래 #2의 69페이지 사양서로 다시 측정했다.

## 잔여 위험

서버 측 PDF/PNG 게시 지연은 로컬 변환 시간에 포함되지 않는다.

## 다음 단계 영향

readFrames의 onPdf 대기는 애플리케이션 콜백에서 제한된 독립 작업으로 분리할 수 있다. converter 콜백 계약 자체는 유지한다.

## 승인 요청

같은 스레드에서 승인한 순서에 따라 Stage 2를 진행한다.
