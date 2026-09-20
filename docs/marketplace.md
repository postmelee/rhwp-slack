# 외부 베타와 Marketplace 준비

2026-09-20 공식 문서 확인. 구현/검증/실제 제출을 각각 기록한다.

## 현재 상태

- 기존 내부 앱: C 구성 운영 유지. 외부 앱과 서비스 분리.
- 외부 베타: **PDF·PNG는 Slack, 편집은 브라우저**로 준비하기로 사용자 결정.
- 외부 설치: #16/PR #19 병합, Public Distribution 활성화. 같은 앱의 실제 2개 workspace에서 HWP/HWPX 변환·브라우저 편집·같은 스레드 저장·재열기 확인.
- 조직 자체 호스팅: 브라우저 편집 구성 안내 작성. 새 조직에서 설치 재현은 미검증.
- Marketplace: 미제출, 승인되지 않음.

## 미등재 시험 배포

OAuth 설치 흐름과 설치별 토큰 관리를 구현하고 Manage Distribution의 요구사항을 충족하면 Add to Slack 버튼/URL로 시험 설치를 받을 수 있다. 조직 정책에 따라 관리자 승인 또는 Marketplace 앱만 허용하는 제한이 있을 수 있다. 상업 배포를 위한 Marketplace 심사를 우회하는 수단으로 설명하지 않는다. [공식 배포](https://docs.slack.dev/app-management/distribution/)

## 제출 전에 충족할 조건

| 항목 | 필요 작업 | 현재 |
|---|---|---|
| 설치 | OAuth/state, 설치별 토큰 보호/선택, 재설치·삭제/철회 | 구현·자동 경계 검사, 실제 2개 workspace 설치 |
| 격리 | 파일·세션·큐·설정·관리자·작업량 제한을 workspace별로 분리 | 설치별 분리·자동 보안 검사, 운영 장기 관찰 필요 |
| 외부 편집 | 브라우저에서 사용자/채널/파일 권한 확인 후 편집, 같은 스레드 저장 | 두 workspace 합성 문서 수용 |
| 내부 embeds | 외부 배포용 pilot 초대 승인 | 별도 신청·승인 필요 |
| 공개 안내 | 설치·개인정보·처리/보관/삭제·지원 연락처·권한 사유 | 공개 홈페이지 게시·앱 소개 저장, 심사 자료 추가 준비 |
| 설치 실적 | 동일 앱의 활성 workspace·주간 활성 사용자 요건 충족 | 미충족 |
| 심사 자료 | 실제 설치/미리보기/편집/삭제 시연, 심사자 테스트 절차 | 준비 필요 |

2026-09-20 재확인한 [현재 심사 기준](https://docs.slack.dev/slack-marketplace/slack-marketplace-app-guidelines-and-requirements/)에는 활성 workspace 설치와 주간 활성 사용자 각각 10개/10명 기준이 있으며, 활성 workspace는 최근 28일 사용한 sandbox가 아닌 곳이다. 준비된 테스트 workspace 2곳을 이 심사 실적으로 단정하지 않는다. 2026년 9월 1일 공지에 따르면 2026년 7월부터 최소 **10개 활성 워크스페이스 설치**가 필요하고 심사 기간 내내 유지해야 한다. 과거 문서의 5개 기준을 사용하지 않는다. 여러 채널이나 구성원 수를 workspace 수로 계산하지 않는다. 조직이 각각 생성한 별도 앱 설치를 중앙 배포 앱의 설치 수에 합산하지 않는다. [공식 설치 요건](https://docs.slack.dev/changelog/2026/09/01/slack-marketplace-install-requirement/)

외부 앱의 Work Objects embeds는 초대제이며 일반 Marketplace 승인과 별개다. 중앙 베타가 미등재라는 이유로 내부 앱 예외가 적용된다고 가정하지 않는다. 사용자 선택에 따라 pilot을 기다리는 동안 브라우저 편집 경로를 구현한다. 현재 내부용 앱은 별도로 유지한다. [embeds 조건](https://docs.slack.dev/messaging/work-objects-embeds/)

## README와 공개 페이지

README는 기능·설치·자료 처리 위치·제약의 진입점으로 사용한다. 현재 저장소는 private이므로 이 README의 GitHub URL은 일반 사용자에게 공개 안내가 되지 않는다. 검증된 문서만 별도 공개 사이트에 게시하는 경로와 소스 저장소 공개를 구분한다. 저장소 공개·라이선스 선택은 소유자 결정 없이 변경하지 않는다.

공개 페이지에는 설치 버튼이 실제로 동작할 때만 추가한다. 비공개 지원 기록이나 사용자 파일 화면을 데모로 게시하지 않는다. 문서가 Cloud Run에서 임시 처리된다는 사실, 메타데이터 보관/삭제와 설치 제거 시 처리를 실제 구현에 맞춰 설명한다.

## 진행 순서

1. #13 원본/API 측정·중복 작업 개선과 #3 비용 관찰. 현재 사양 유지.
2. #4 README·설치/자체 호스팅 문서 준비. 내부 운영 앱 유지.
3. #16에서 하나의 배포 앱의 OAuth·설치별 토큰/설정/문서 격리·외부 브라우저 인증·Add to Slack·두 workspace 수용을 구현/검증. 기존 내부 운영을 보존하는 검증 환경과 전환 절차를 사용하고 새 비밀값/배포 설정을 구체적으로 확정.
4. #4에서 초대형 베타 모집·지원/정책 안내와 동일 앱의 활성 설치10곳 확보·유지를 추적한다. #16의 실제 조직 설치·삭제·권한 회수·비용/대기열 수용 결과를 연결한다. 자체 호스팅은 새 조직 환경에서 별도 재현.
5. 활성 설치 요건과 [Marketplace 심사 기준](https://docs.slack.dev/slack-marketplace/slack-marketplace-app-guidelines-and-requirements/)을 충족한 뒤 제출. 실제 제출/승인 상태는 증거와 함께 갱신.

## 공개 소개 입력값

- 짧은 소개: **Slack에서 한글 문서를 미리 보고 브라우저에서 편집**
- 설치 안내: https://rhwp-slack.pages.dev/
- 개인정보: https://rhwp-slack.pages.dev/privacy/
- 지원: https://rhwp-slack.pages.dev/support/
- 운영자/연락처: Taegyu Lee / meleeisdeveloping@gmail.com (공개 승인됨)
- Direct install URL: https://rhwp-beta-ingress-aaj47f2u5q-uc.a.run.app/install — 실제 302 + state/cookie 응답 확인 후 직접 설치 설정 저장.
- 가격 Free, 언어 Korean. 심사 연락처 전화번호는 사용자가 Slack 설정에 직접 입력하고 저장했다. 번호는 저장소에 보관하지 않는다. 스크린샷·최종 약관 동의·제출은 별도 준비한다.

설정 입력이나 Install from Slack Marketplace 선택은 심사 제출·승인을 의미하지 않는다.
