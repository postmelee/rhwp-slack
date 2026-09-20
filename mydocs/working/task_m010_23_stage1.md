# Task #23 Stage 1 — 편집 보존과 재인증 구현·로컬 검증

외부 편집 metadata의 문서·workspace·사용자·채널 identity와 새 OIDC 티켓을 비교한 뒤에만 bearer를 교체한다. 팝업 source/origin/임의 nonce를 검증하고 취소·실패 시 Studio와 미저장 변경을 유지한다. 저장 실패의 request ID/bytes는 그대로 재시도하고 현재 편집본을 로컬로 다운로드할 수도 있다. 인증 제한 시간과 접근 검사 자체는 완화하지 않았다.

## 검증

Node 24.21.0에서 typecheck, unit 10, security 53, Slack 87, 변환 9 통과. Playwright 전체 29개 시나리오 통과(기존 upstream 혼합 서식 undo expected-failure 포함). 새 3개 시나리오는 정상 재인증/동일 저장 재시도/이후 변경 dirty 보존, 다른 사용자 거부·다운로드, 위조 source·nonce 및 팝업 취소를 검증했다. 실제 Slack의 popup 정책·재로그인은 배포 후 확인하며 로컬 mock 성공과 구분한다.

## 검증 중 발견한 빌드 경로 결함

공유 Studio 캐시의 심볼릭 링크가 Vite에서 실제 경로로 해석되어 파일 경로가 일치하지 않았고 main.ts overlay가 조용히 생략됐다. 공개 작업 폴더에서 저장 테스트 6개가 dirty 신호 누락으로 실패하고 기존 작업 폴더의 3개 저장 테스트는 통과했다. 캐시 root를 realpath로 정규화하고 필수 overlay 3개 중 하나라도 빠지면 buildEnd에서 실패하도록 변경했다. 수정 후 동일 6개와 전체 29개를 통과했다. 공개 홈페이지의 초기 배포에는 이 미완성 빌드를 사용하지 않았고, 새 editor origin 연결 전에 검증된 빌드로 교체한다.

원격 CI와 실제 재로그인은 아직 미검증이다.
