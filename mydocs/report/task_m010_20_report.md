# Task #20 최종 보고서 — 직접 설치 302 호환

GitHub Issue: [#20](https://github.com/postmelee/rhwp-slack/issues/20) · 마일스톤 M010

## 작업 요약

설치 시작만 303에서 302로 바꾸고 OAuth state/cookie와 기존 callback 계약을 유지했다.

## 변경 파일 목록과 영향 범위

src/server/installations/routes.ts · tests/security/installations.test.ts. 기존 내부 앱과 서비스의 revision/traffic, 예산과 사양은 유지했다.

## 문서 위치 검증

수행계획서의 공식 문서는 README/docs/site, 작업 증적은 mydocs/working/report에 두는 결정과 실제 diff가 일치한다.

## 변경 전·후 비교

| 변경 전 | 변경 후 |
|---|---|
| /install HTTP 303 | HTTP 302 |

## 검증 결과

설치 security 8개 및 Linux viewer/container 통과. 실제 ingress 302와 Slack OAuth 목적지, Secure·HttpOnly 쿠키 확인. Slack 직접 설치 설정 저장 후 재열기 확인.

### 단계별 검증 결과

- [Stage 1](../working/task_m010_20_stage1.md)
- [Stage 2 배포 확인](../working/task_m010_20_stage2.md)

배포 runtime SHA 9607091, image sha256:8d033521e12cbcdd7b21ce0bc3785ff5c299c28bf20bc2af1db9c425da409ced. 후속 2718167은 smoke 입력과 소개를 보완했으며 release runtime 코드는 같다. Linux [35495364805](https://github.com/postmelee/rhwp-slack/actions/runs/35495364805)의 viewer/container 통과. 최종 문서 head의 CI는 PR checks에서 확인한다.

## 잔여 위험과 후속 작업

직접 설치 설정 저장은 Marketplace 심사 제출이나 승인이 아니다.

## 작업지시자 승인

같은 스레드의 순차 진행 및 codex/public-beta-launch push·CI·PR·검토 후 병합 승인을 적용한다. 별도 재승인을 요구하지 않는다.
