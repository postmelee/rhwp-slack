# Task #4 Stage 5 — 다른 사용자 복구와 자동 심사 피드백

GitHub Issue: [#4](https://github.com/postmelee/rhwp-slack/issues/4)
구현계획서: [task_m010_4_impl.md](../plans/task_m010_4_impl.md)

## 단계 목적

#41 배포 후 실제 다른 사용자 재시도를 확인하고 Marketplace의 오래된 미검증 설명을 갱신한다. 최종 제출은 제외한다. 사용자 순차 진행 승인을 적용했다.

## 산출물

| 파일 | 변경 요약 |
|---|---|
| docs/marketplace.md | 최신 수용·양식 저장 범위·자동 피드백과 남은 요건 |
| mydocs/orders/20260924.md | #4 진행 상태 |
| 이 보고서 | 직접 관측과 사용자 확인, 미완료 범위 구분 |

## 본문 변경 정도 / 본문 무손실 여부

이전 날짜의 관측 기록을 보존하고 최신 결과를 추가했다. 제품 코드·사양·권한·배포는 변경하지 않았다. 공개 /review/는 설치·사용 안내가 유효해 재배포하지 않았다.

## 검증 결과

공개 소스 `2d6501ba778bc3cf5e345628adac722f192e0392`, ingress `rhwp-beta-ingress-00009-vjz`, worker `rhwp-beta-worker-00009-gbt`에서 시험했다. PR #42 병합본의 기능을 사용했다.

| 단계 | 근거 | 결과 |
|---|---|---|
| 요청·탈퇴 | Chrome의 Sherlock Holmes로 test 원본 카드 추가 페이지 요청 후 채널 나가기 | 직접 실행 |
| 변환 중단 | 읽기 전용 작업/카드 조회 | PDF ready, 이미지 failed, recovery failed/access_denied |
| 다른 사용자 클릭 | 사용자가 melee 계정으로 재시도 클릭 완료라고 응답 | 사용자 확인 |
| 복구 완료 | 같은 카드 재조회 | PDF ready, 이미지 ready, recovery 없음 |
| 최초 요청자 | 재시도 중 Sherlock을 채널에 재참여시키지 않음 | 다른 사용자에 의한 복구 확인 |
| 접수·진행 중 UI | 이번 클릭은 사용자 실행 중 중간 화면을 직접 캡처하지 않음 | 이번 회차 직접 관측 미검증; #41의 공통 경로 UI 검증과 구분 |
| 편집 권한 철회·재참여 | 앞선 사용자 실제 시험 보고 | 사용자 확인, 이번 회차 재실행하지 않음 |

내부 추적: team `T0B3KRJ67LG`, channel `C0C2ZCX509K`, 카드 `b21cfeb4-cbc9-4208-a1df-67e1a5bc8fb5`, 원본 메시지 `1790138451.115919`, 중단 작업 `e7d63f484e622ddd738432518ae540507227c0ac962f69a5bef0e62ba91aed19`. 조회 도구는 `/private/tmp/task4-retry-inspect.py`이며 토큰·문서 원본은 기록하지 않았다.

Marketplace는 Chrome의 공개 앱 `A0C329NJ85C`에서 확인했다.

- 새 How to test your app 설명과 본문 내 공개 화면 URL은 전체 재로드 후 유지됐다. 오래된 다른 사용자 검증 미진행 문장은 제거됐다.
- 사용자 진행 승인에 따라 약관 체크를 적용했고 재로드 후 checked 상태를 확인했다.
- 스크린샷 전용 URL 및 Contact Email 입력은 유지되지 않았고 Contact Number는 빈 상태다. 일반 오류와 Next 비활성화가 발생했다. 저장 완료로 보고하지 않는다.
- 사용자가 수동 입력 후 항목 이동 시 값 유지됨을 확인했다. 이후 에이전트가 전체 URL을 다시 열어 확인한 DOM에서는 Contact Email·Contact Number·스크린샷 URL이 빈 값이었다. 항목 간 이동에서의 유지와 전체 재로드 후 영구 저장을 구분하며 미해결로 남긴다.
- 메뉴 5. Automated checks의 실제 Automated Feedback은 활성 워크스페이스 10개 미만을 제출 차단 사유로 표시했다. Submit App for Review는 disabled였다. 최종 제출하지 않았다.
- 공식 요건 페이지 재확인: 활성 워크스페이스 10곳·주간 활성 사용자 10명 기준. 시험용 설치 2곳을 충족 근거로 사용하지 않는다. [공식 기준](https://docs.slack.dev/slack-marketplace/slack-marketplace-app-guidelines-and-requirements/).

문서 변경은 `git diff --check` 및 변경 문서의 상대 링크 존재 여부로 검증한다. 제품 소스 변경이 없으므로 변환·브라우저 전체 회귀를 반복하지 않는다.

## 잔여 위험

활성 설치·사용자 기준은 미충족이며 양식 일부 저장 문제도 미해결이다. 자동 피드백 페이지 접근은 모든 검사 통과나 제출 준비 완료를 뜻하지 않는다. 별도 조직 자체 호스팅 재현도 남는다.

## 다음 단계 영향

실제 사용 조직 확보와 양식 저장 문제를 해결한 뒤 자동 피드백을 재확인한다. 최종 제출은 별도 결정하며 #4를 닫지 않는다.

## 승인 범위

사용자의 기존 순차 진행 지시에 따라 이번 수용 결과를 문서 PR로 통합한다. Marketplace 최종 제출은 승인 범위에서 제외한다.
