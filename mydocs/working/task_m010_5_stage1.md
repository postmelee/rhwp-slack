# Task #5 Stage 1 — 서명 이벤트 재현

기준 소스 a1dd629. 공식 file_unshared 예제처럼 채널 정보 없는 서명 이벤트를 실제 Bolt HTTP receiver로 전달했다. 합성 API는 동일 루트와 수정본이 공개 CTEST·비공개 CPRIVATE 두 채널에 공유된 상태를 제공한다.

`node --import tsx --test tests/slack/channel-revocation.test.ts`: 수정 전 6/6 실패. Cloud/로컬 모두 지연된 공유 해제 및 다른 채널 보존 실패. API 장애 시 Cloud는 조회 자체를 하지 않고 영구 무효화했다. 로컬은 수정본의 준비 bytes가 남았다. 최초 sandbox listen EPERM은 환경 실패로 제외했고 loopback 허용 후 실제 assertion 실패를 확인했다.

이 검사는 실제 Slack 계정에서 발생한 이벤트 관측이 아니라 공식 이벤트 형태와 합성 API를 사용하는 자동 회귀다. 실제 공유 해제/재설치 수용은 별도다.
