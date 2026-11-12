# Task #72 Stage 1 — 확정 무효화 종료

동일 tenant의 영속 removed tombstone을 시작 전에 확인하고 정상 done으로 종료한다. 내부 removed-write/접근 거부 경쟁에는 fresh tombstone을 재확인한다. 저장소·lease·변환·Slack 일시 오류는 삼키지 않는다. 원본 파일 미발견만으로 취소를 확정하지 않는다.

카드가 아직 없는 prepare는 별도 원자적 취소 계약이 없으므로 기존 retry를 유지한다. 구현계획의 범위를 이에 맞게 좁혔다. 권한 검사는 변경하지 않았다.

Node 24.21.0 타입 및 cloud-application 27개 회귀 통과. 기존 실패 종료 bookkeeping, 삭제 후 재전달/watchdog, 삭제 경쟁, 다른 tenant, 저장소 장애 회귀 포함. removed preview는 generation 1 done, terminal notice 없음.
