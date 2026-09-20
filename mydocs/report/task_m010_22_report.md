# Task #22 최종 보고서 — 조직용 Cloud Run·Pages 자체 호스팅

GitHub Issue: [#22](https://github.com/postmelee/rhwp-slack/issues/22) · 마일스톤 M010

## 작업 요약

조직 소유 Slack 앱·GCP·Pages와 distributed browser runtime 설치 안내를 작성했다. OAuth/OpenID·설치 키·IAM·TTL·고정 origin·업데이트·복구·비용 책임을 설명한다.

## 변경 파일 목록과 영향 범위

docs/self-hosting.md · site/support/index.html. 기존 내부 앱과 서비스의 revision/traffic, 예산과 사양은 유지했다.

## 문서 위치 검증

수행계획서의 공식 문서는 README/docs/site, 작업 증적은 mydocs/working/report에 두는 결정과 실제 diff가 일치한다.

## 변경 전·후 비교

| 변경 전 | 변경 후 |
|---|---|
| 내부 embed 중심 안내 | 브라우저 편집과 내부 embed 구성 구분 |

## 검증 결과

문서의 진입점과 필수 환경변수를 distributed.ts/config.ts 및 배포 환경에 대조. 공개 지원 안내와 문서 내부 링크 확인.

### 단계별 검증 결과

- [Stage 1](../working/task_m010_22_stage1.md)

배포 runtime SHA 9607091, image sha256:8d033521e12cbcdd7b21ce0bc3785ff5c299c28bf20bc2af1db9c425da409ced. 후속 2718167은 smoke 입력과 소개를 보완했으며 release runtime 코드는 같다. Linux [35495364805](https://github.com/postmelee/rhwp-slack/actions/runs/35495364805)의 viewer/container 통과. 최종 문서 head의 CI는 PR checks에서 확인한다.

## 잔여 위험과 후속 작업

새 조직의 빈 계정에서 전체 설치는 미검증. 원클릭 배포, 소스 공개와 배포 라이선스 확정은 미포함.

## 작업지시자 승인

같은 스레드의 순차 진행 및 codex/public-beta-launch push·CI·PR·검토 후 병합 승인을 적용한다. 별도 재승인을 요구하지 않는다.
