# Task #39 Stage 2 — Linux·공개 배포·실제 재시도

## 목적·산출물

코드 a60d5c05647e0cfc912d597b218959a24a18de1b를 Linux와 공개 서비스에서 확인했다. 소스 추가 변경 없음.

## 검증

- CI push 35820864522 / PR 35820961596: viewer/container 총 4 SUCCESS.
- Cloud Build 2e80e6a1-20a8-4e15-9751-f1754aeb282c SUCCESS. git archive의 추적 파일만 빌드.
- image sha256:0ff687439344dfa1e0a12961e274140288486ab4052bf6aa4e475010ac35a23d.
- rhwp-beta-worker-00008-stt / rhwp-beta-ingress-00008-4x6 100%. 이전 각각 00007-2pg / 00007-kzs. 양쪽 runtime spec(image 제외) 및 IAM 정책 동일. 내부 앱 revision 유지.
- 기존 실패 카드 d61d29ec-2f9c-4507-aafb-01c66b039568는 사용자가 재참여한 뒤 기존 15분 watchdog으로 failed가 됐다. 배포 후 Chrome의 기존 계정 melee로 실제 ‘문서 미리보기 다시 준비’를 클릭했다.
- 동일 카드·메시지 1790138593.520059, 원래 편집본 파일 F0C3X541Y5S 유지. 재시도 작업 a98dc5c12c0d84de618a906cd1ed822d97286b87d19e54f7690eb5c0ea1db1ec done, pdf/imageState ready, recovery 없음. Slack 실제 화면에서 PDF·PNG·원본 편집본 표시를 직접 확인했다.

## 한계·후속

새 계정의 채널 탈퇴 자체를 배포 후 다시 조작하지 않았다. 사용자 제공 탈퇴 실수용과 서버 로그, 새 코드의 자동 권한 철회 회귀를 구분한다. 실제 사용자 편집 파일·이미지는 Git에 보관하지 않는다.

재시도 버튼 접수에서 HTTP404 약3초, task lock 경합과 뒤늦은 ‘요청 처리 실패’ ephemeral을 관측했다. 이후 큐는 변환을 완료했다. 이 별도 접수 지연은 #13 후속으로 남긴다. 이번 수정의 재현된 pending 상태 결함과 구분한다.

## 다음 단계

검토·보고·PR 정리. 사용자 수정 진행 승인으로 계속한다.
