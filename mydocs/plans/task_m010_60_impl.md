# 변환 실패 진단과 제한 오류 재시도 개선

GitHub Issue: #60 · M010

## 목적·배경
SVG 생성 실패가 원인 없이 conversion_output으로 합쳐지고 모든 실패가 지연으로 안내된다. 합성 공유 그림 HWP에서 누적 SVG 100 MiB 제한을 재현했다. 고객 사례 원인은 미확정이다.

## 범위·설계
고정 실패 이유 및 페이지 번호/페이지 수/SVG bytes를 child IPC에서 검증한 뒤 로그로 전달한다. 원시 예외·문서 내용은 기록하지 않는다. 명시적 제한 초과·페이지 geometry 오류는 영속 task에서 종료하고, 일시 오류와 알려지지 않은 엔진 예외의 재시도는 유지한다. 실패 영수증 재전달·watchdog은 통지만 복구한다. 메시지는 제한별 조치와 일반 실패를 구분한다.
엔진·리소스·한도·반복 이미지 구조·고객 데이터 수집은 제외한다.

## 문서 위치 판단
내부 작업 기록은 기존 mydocs/plans, working, report, orders에 작성한다. 운영 계약 변경은 기존 docs/cloud-run.md에 추가한다. 새로운 문서 체계는 만들지 않는다.

## 단계·변경 파일
1. conversion child, failure protocol, convert typings/telemetry 및 보안 회귀.
2. cloud tasks/application, document-message 및 영속 재시도/UI 회귀.
3. 실제 합성 HWP 변환·전체 회귀·CI·고정 이미지 배포 및 보고.

## 검증
허용 목록/수치 경계/원시 데이터 배제, 실제 2페이지 성공·80페이지 svg-limit·후속 성공, 영구 오류 1회 종료 및 redelivery 미재변환, transient 재시도, PDF ready 보존. 타입/단위/Slack/security/viewer/container 회귀와 배포 readiness/트래픽 확인.

## 리스크·승인
제보 원본 없이 해당 문서의 해결은 단정하지 않는다. 모든 변환 실패를 영구 오류로 처리하지 않는다. 사용자가 2026-09-28 수정 적용 및 배포를 명시 승인했으며 해당 범위의 기록·검증·PR 통합·배포를 이어 진행한다.
