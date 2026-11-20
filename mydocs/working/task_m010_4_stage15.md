# Task #4 Stage 15 — 처리 현황 확인 (2026-11-18)

- 제품 기준: origin/devel f108091. tickets 60초, OAuth state 600초, session 유휴 600초/최대 3600초, terminal tasks 7일. Firestore physical TTL의 현재 활성 상태는 미확인하므로 자동 삭제 보장을 제거한다.
- Installations.revoke는 sealed/fingerprint를 제거하고 revoked 설치 메타데이터를 남긴다. 앱 제거와 전체 기록 삭제는 다르다.
- 별도 rhwp-slack-ops의 overlay usage-events.ts는 설치·PDF 준비·Slack 게시 시각 및 해시 키를 기록하며 본문/파일명 필드와 자동 만료 필드가 없다. usage_store.py와 ops/README.md의 팀 삭제 절차는 원시 이벤트·파생 집계와 연결 경로를 별도로 다룬다. 제품 저장소에서 writer가 검색되지 않는다고 이용 기록 설명을 삭제하지 않는다.
- 공개 live /editor/의 API origin 및 /의 install URL은 rhwp-beta-ingress Cloud Run이다. ops README의 Heroku 전환은 내부 단일 워크스페이스만 해당하고 beta는 제외한다.
- Pages canonical e40449f8-44ee-48db-88fe-724a9be81805, production_branch devel. API의 build_config에 Web Analytics tag/token이 존재하고 live / 및 /editor/에 beacon 삽입을 확인했다. deployment_configs 아래 analytics 필드 부재는 비활성화 근거가 아니다. RUM 상세 API는 403이므로 세부 규칙·분석 보관 기간은 미확인이다. 설정은 변경하지 않았다.
- 기존 CSP는 외부 beacon 도메인을 허용하지 않는다. 삽입 관측과 브라우저 실행·수집 성공을 구분하며 정책에는 CSP/브라우저에 따라 실행이 제한될 수 있다고 표시한다.
- 지원 메일·운영자: 기존 site/support 및 live 공개 페이지의 Taegyu Lee / meleeisdeveloping@gmail.com.
- 최신 Slack 공식 가이드의 수집·이용·보관·접근/이전/삭제·연락처 항목을 대조했다. 사람 번역 요청은 사용자 전달 심사 피드백이며 AI 초안만으로 충족하지 않는다.

근거: https://docs.slack.dev/slack-marketplace/slack-marketplace-app-guidelines-and-requirements/ 및 https://developers.cloudflare.com/pages/how-to/web-analytics/ .
