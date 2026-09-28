# Task #60 Stage 2 — 제한 실패 종료와 안내

명시적 변환 제한 5종은 첫 실패에서 카드·task를 실패로 기록한다. 같은 영수증 재전달/알림 실패/지연 watchdog에서 변환을 반복하지 않고 통지만 복구한다. 기존 timeout·업로드 장애 재시도와 PDF ready 상태는 보존한다.

cloud-state/cloud-application 29개 통과. 최초 sandbox 실행의 localhost EPERM은 테스트 환경 제약으로, 권한을 허용한 재실행으로 검증했다. 새 회귀는 영구 실패의 1회 실행, 통지 재시도, 안내·편집 버튼 및 기존 PDF 링크 보존을 검사한다.
