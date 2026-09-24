# #41 Stage 3 — 공개 배포와 Alhanguel 수용

## 단계 목적
검증한 코드를 공개 서비스에 반영하고 버튼 접수와 진행 표시를 실제 Slack에서 확인한다.

## 산출물
- source: `2d6501ba778bc3cf5e345628adac722f192e0392`
- Cloud Build: `7127801a-c5d8-442a-8b32-0c68e31e31c2` SUCCESS.
- image digest: `sha256:88442d803492bd03d441e5c3cb0a5ce68a412de563a13ea6038c9bdac1f9bb4a`
- worker: `rhwp-beta-worker-00008-stt` → `rhwp-beta-worker-00009-gbt`
- ingress: `rhwp-beta-ingress-00008-4x6` → `rhwp-beta-ingress-00009-vjz`
- 두 서비스 새 revision 트래픽 100%. IAM 및 image 외 container spec 비교 동일. 내부 rhwp-ingress/rhwp-worker revision 동일.

## 본문 변경 정도 / 본문 무손실 여부
추가 코드·제품 문서 변경 없음. Pages·엔진·서버 사양·최소 인스턴스·비밀값 변경 없음.

## 검증 결과
Alhanguel test의 Chrome 새 계정 Sherlock Holmes로 확인했다. 기존 탈퇴 상태에서 test에 재참여했다. rhwphq 관리자 계정은 사용하지 않았다.

| 단계 | 관측 |
|---|---|
| 실제 버튼 | 2026-09-24 15:43:39 KST, 기존 업무계획 편집본 2의 추가 페이지 이미지 보기 클릭 |
| HTTP 접수 | 06:43:40.267958Z, `/slack/events` 200, 1.531369792초 |
| 접수 상태 | ‘미리보기 요청을 접수했습니다. PDF·이미지를 준비할 차례를 기다리고 있습니다.’ |
| 실행 상태 | ‘PDF·이미지를 다시 준비하고 있습니다.’ |
| 완료 | PNG 10장 + HWP + PDF, 12개 첨부. 진행 문구 제거. 실패 안내 없음 |
| worker | event 3,580ms, images 40,978ms, 각각 attempt 1 완료 |
| 영속 상태 | 카드 PDF ready, imageState ready, recovery 없음 |

검증 카드: `a881ff3c-7bc1-4af0-960e-66c1c390ac83`.
[실제 응답](https://alhanguel.slack.com/archives/C0C2ZCX509K/p1790140756679899?thread_ts=1790138430.533979&cid=C0C2ZCX509K).
이미지 작업 ID: `6f25d6ddc5295f2839b0a33ee5b8782f31c6cad9abc62e1f67e6936218ba53cc`.

## 잔여 위험
이번 배포 후 UI 검증은 재시도와 동일 접수·예약·발행 경로를 쓰는 추가 이미지 버튼이다. 실패 카드의 재시도 버튼 자체와 다른 클릭 사용자 권한은 자동 회귀로 검사했으며, 이번 UI 실행과 구별한다. 사용자가 배포 전 확인한 다른 계정의 재시도 성공을 이번 배포의 실측으로 계산하지 않는다. 1.53초는 1회 관측이며 SLA나 콜드 스타트 상한이 아니다.

## 다음 단계 영향
#4 Marketplace 준비로 돌아갈 수 있다. 최종 제출은 하지 않는다. 장기 큐 장애/worker 정지 시 복구까지 보장하는 변경은 아니며 #13의 운영 지연 관측 범위로 남긴다.

## 승인 근거
사용자의 수정 진행·공개 배포·테스트 승인 범위에서 수행했다.
