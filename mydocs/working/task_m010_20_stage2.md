# Task #20 Stage 2 — 실제 직접 설치 주소 검증

2026-09-20 배포 ingress `/install`에서 HTTP 302, 목적지 `https://slack.com/oauth/v2/authorize`, Secure·HttpOnly·SameSite 쿠키를 확인했다. state와 쿠키 원문은 증적에서 제외했다. Slack Basic Information의 Install from Slack Marketplace와 직접 설치 URL을 저장하고 새로 열어 보존을 확인했다. 이 설정은 Marketplace 제출·승인이 아니다.

서버 소스 9607091, build 02357b57-af33-4128-954f-ff3c3dc5ce26, image sha256:8d033521e12cbcdd7b21ce0bc3785ff5c299c28bf20bc2af1db9c425da409ced. beta ingress 00005-vbp, worker 00006-fjm. 기존 내부 두 서비스 revision/traffic 변화 없음.
