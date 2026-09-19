# Task #16 Stage 2 — 설치별 작업·요청 분리 기반

## 구현

설치 generation별 metadata store factory, 매 호출 시 설치 유효성을 재확인하는 API/store, generation을 포함한 Cloud Tasks delivery ID를 추가했다. 재설치·폐기 이후 보관된 API/store와 과거 큐 delivery는 새 설치에 접근하지 못한다. 실제 store factory는 후보 런타임에서 독립 Firestore namespace로 연결해야 한다.

분산 receiver는 기존 Bolt ExpressReceiver의 raw-body 서명 검사를 통과한 뒤에만 설치를 조회한다. app/team 불일치·Grid 요청을 제외하고 기존 단일 tenant handler를 선택한 설치와 함께 실행한다. worker는 같은 OIDC 게이트를 유지할 수 있도록 execute 인터페이스만 수용한다. 기존 single entrypoint에는 연결하지 않았다.

## 검증

합성 두 workspace 검사 4/4 통과: 동일 키 저장 분리·토큰 선택, 재설치/폐기와 보관된 인스턴스, 큐 ID 교차 이동, 실제 로컬 HTTP 서명 확인 및 app/team 위조 거부. 초기 테스트에서 slash command에 없는 `team` 객체를 읽어 503을 내던 경로를 발견해 `team_id` 형식을 지원하도록 수정 후 재실행했다. TypeScript 검사 통과.

## 미완료

Firestore namespace factory·실제 OAuth/lifecycle 연결·편집 사용자 인증·Pages workspace 전달·최종 통합 검사와 실제 수용은 후속 단계다. 완료된 분리 기반과 아직 연결되지 않은 운영 경로를 구분한다.
