# 외부 워크스페이스 베타 구성 — 검증 중

현재 외부 설치 링크는 아직 개방하지 않았다. 이 문서는 #16 후보 구현과 수용 절차이며, 현재 운영 중인 단일 워크스페이스 앱의 배포 완료 안내가 아니다.

## 사용자 흐름

운영자가 제공하는 고정 HTTPS 주소에서 **Add to Slack**을 선택한다. 워크스페이스의 설치 승인 후 채널에 봇을 초대하고 설치자가 `/rhwp settings`에서 자동 감지 또는 멘션 전용을 선택한다. 새 설치의 채널은 기본 중지 상태다.

봇은 PDF와 페이지 이미지를 원본 메시지의 스레드에 게시한다. **rhwp에서 편집**은 브라우저에서 Slack 로그인 후 열린다. 실제 로그인한 사용자가 해당 파일과 채널에 접근할 수 있어야 한다. 수정본은 같은 스레드에 저장한다. 사용자에게 앱 생성이나 봇 토큰 입력을 요구하지 않는다.

서버는 변환 중 문서 bytes를 처리하고 결과 파일은 Slack에 저장한다. Firestore에는 연결·작업·세션 메타데이터와 암호화한 설치별 봇 토큰이 남는다. 모든 처리가 사용자 기기 안에서만 실행되는 구성은 아니다.

## 후보 운영자 설정

기존 `src/server/cloud/main.ts`와 분리된 `src/server/cloud/distributed.ts`를 사용한다. Docker 이미지에는 두 진입점이 포함되며 후보 실행 명령은 `node dist/cloud/distributed.cjs`다. 기존 서비스 명령을 덮어쓰지 않는다.

- 기존 운영과 별도의 Slack 앱, Cloud Run ingress/worker, Cloud Tasks 큐, Pages 프로젝트/주소를 사용한다.
- 최초 후보는 ingress/worker 최소 0·최대 1, 기존과 같은 ingress 1 CPU/1GiB·worker 2 CPU/4GiB, worker 동시 요청 1을 유지한다. 이는 비용·상시 응답 성능 수용 완료를 뜻하지 않는다. 프로젝트 예산·지출 한도를 올리지 않는다.
- `CLOUD_ROLE`, `GOOGLE_CLOUD_PROJECT`, `CLOUD_ENVIRONMENT=beta`, `TASK_QUEUE`, `TASK_SERVICE_ACCOUNT`, `WORKER_ORIGIN`, `APP_ORIGIN`, `EDITOR_ORIGIN`, `SLACK_APP_ID`를 구성한다.
- `SLACK_SIGNING_SECRET`, `INSTALLATION_KEY_ID`, `INSTALLATION_KEYS_JSON`은 ingress/worker에 필요하다. 마지막 값은 키 ID를 32바이트 난수의 base64 값에 대응시킨 JSON이다. 키는 Secret Manager에 보관한다.
- ingress에만 `SLACK_CLIENT_ID`, `SLACK_CLIENT_SECRET`을 추가한다. 전역 `SLACK_BOT_TOKEN`이나 `SLACK_TEAM_ID`는 사용하지 않는다.
- registry와 문서 메타데이터는 환경·앱·설치 generation으로 나뉜다. 다른 앱/환경에 키와 namespace를 재사용하지 않는다. Firestore TTL은 임시 기록의 `expiresAt`에만 적용한다.
- 설치 갱신·재설치는 새 generation을 만들며 이전 티켓·세션·큐를 무효화한다. 현재 후보에서는 과거 generation의 카드 연결이 자동 이전되지 않으므로 새 설치에서 미리보기를 다시 만든다. 암호화 키 교체는 기존 키를 읽기용으로 유지하고 새 key ID로 기록한다. 사용 중인 과거 키를 바로 삭제하지 않는다.

앱 설정 초안은 다음 명령으로 생성한다. bootstrap은 앱 정의만 만들며 설치 권한을 부여하지 않는다.

```sh
node scripts/slack-beta-manifest.mjs --bootstrap
node scripts/slack-beta-manifest.mjs --origin https://YOUR-BETA-INGRESS
```

등록 callback은 `/oauth/callback`, `/browser/callback` 두 개다. 설치는 bot scopes만, 편집 로그인은 `openid profile`만 별도로 요청한다. signing secret·client secret·암호화 키를 Pages 정적 파일이나 Git에 넣지 않는다. Pages의 API origin을 후보 ingress로 빌드하고, 정확한 Pages origin만 API CORS에 허용한다. worker는 task caller만 호출할 수 있어야 한다.

Enterprise Grid 조직 설치와 Slack 토큰 회전은 지원하지 않는다. Marketplace 제출 전 개인정보·지원·삭제 정책과 보안 검토는 별도 #4에서 마무리한다.

## 실제 수용 및 복구

1. Linux CI와 비밀값 없는 컨테이너 테스트를 통과한 SHA/이미지를 고정한다.
2. 후보 앱 OAuth·OpenID redirect, 이벤트 서명, 배포 설정을 확인한다. 기존 앱의 이벤트 주소는 유지한다.
3. 같은 후보 앱을 두 workspace에 설치한다. 각각 합성 파일의 PDF·PNG·브라우저 편집·같은 스레드 저장을 확인한다.
4. 다른 workspace의 링크/티켓/세션과 비참여 채널 접근을 거부하는지 확인한다. 설치 취소·앱 삭제·재설치 이후 이전 연결 거부도 확인한다.
5. 새 인스턴스의 초기 응답·처리 지연과 비용을 측정한다. 로컬 fake Slack 성공과 실제 Slack 성공을 따로 기록한다.
6. 공개 베타 전 정책·지원 주소와 실제 설치 안내를 확정한다. 실패 시 후보 큐/서비스 사용을 중지하며 기존 앱은 계속 운영한다. 기존 사용자에게 후보 앱으로의 재설치를 자동 강요하지 않는다.
