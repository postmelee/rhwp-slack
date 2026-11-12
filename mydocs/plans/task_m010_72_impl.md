# Task #72 구현계획
수행계획: task_m010_72.md · M010

1. CloudApplication에서 동일 tenant의 removed/취소 영속 상태를 확인한다. 상태 확인 오류/tenant 불일치/missing만으로 취소하지 않는다. 카드 없는 prepare는 취소 확정 근거가 없으므로 유지한다. 별도 tombstone 계약 없이 파일 미발견을 취소로 처리하지 않는다.
2. files.info 호출 출처의 안전한 WeakMap 분류와 고정 한국어 안내를 추가한다. retry 정책과 분리하고 fresh authorization에 기반한 기존 notice target/identity 검사를 유지한다.
3. 삭제 전/도중/재전달/watchdog/교차 tenant/저장소 오류 테스트, 파일 미발견·가시성·인증·일시 장애·위조 오류 테스트. 독립 리뷰 후 전체 검증 및 실제 합성 Slack 검증.
4. 운영 baseline/private 계측/엔진 유지, 공개 delta를 분리 적용, 입력 manifest와 복구 재현 검증 후 고정 이미지로 배포. 실패시 기존 revision 보존.

사용자 전체 진행 승인 범위 안에서 수행하며 보안·데이터 범위가 바뀌면 중단한다.
