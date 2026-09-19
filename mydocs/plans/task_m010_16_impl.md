# Task #16 구현계획

[수행계획](task_m010_16.md). 기준 `a15f7d9`, M010.

| Stage | 구현과 산출물 | 검증·완료 기준 |
|---|---|---|
| 1 | `installations/` 저장 추상화·AES-GCM·설치 generation·브라우저 결속 state·OAuth client | 위조/동시 callback/취소/암호문 이동/잘못된 app/team/token 응답 거부, 기존 테스트 |
| 2 | 검증된 이벤트 tenant 선택·API/DB/큐/세션 설치 분리 | 두 설치 교차 접근, 폐기·재설치, 기존 single 설치 회귀 |
| 3 | 외부 브라우저 사용자 인증과 Add to Slack UI | 설치/사용자 scope 분리, CSRF·만료·권한 검사, 같은 스레드 저장 |
| 4 | 별도 후보 구성 및 실제 수용 | Linux CI와 실제 두 workspace를 구분하여 기록 |
| 5 | docs·보고·운영 전환/복구 | 실제 지원 기능만 안내, 현재 C 복구 가능 |

각 단계는 관련 코드와 `mydocs/working/task_m010_16_stageN.md`를 함께 커밋한다. 공식 문서는 기존 `docs/` 경로를 사용한다. 구현이 되어도 실제 OAuth 설정·테스트를 완료하지 않으면 공개 베타 완료로 표시하지 않는다.
