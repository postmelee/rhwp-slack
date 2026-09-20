# Task #21 최종 보고서 — 공개 베타 홈페이지·지원·개인정보

GitHub Issue: [#21](https://github.com/postmelee/rhwp-slack/issues/21) · 마일스톤 M010

## 작업 요약

공개 사이트와 설치/사용/지원/데이터 처리 안내를 게시했다. 기존 내부 Pages와 별도 rhwp-slack.pages.dev를 사용하고 공개 exporter는 opt-in이다.

## 변경 파일 목록과 영향 범위

site/ · scripts/export-pages.mjs · scripts/public-site.mjs · tests/unit/public-site.test.mjs · README.md · docs/. 기존 내부 앱과 서비스의 revision/traffic, 예산과 사양은 유지했다.

## 문서 위치 검증

수행계획서의 공식 문서는 README/docs/site, 작업 증적은 mydocs/working/report에 두는 결정과 실제 diff가 일치한다.

## 변경 전·후 비교

| 변경 전 | 변경 후 |
|---|---|
| 공개 안내 없음·beta editor 주소 | 공개 HTML 4개·일관된 홈페이지/편집기 주소 |

## 검증 결과

로컬 1280×900/390×844 표시, 공개 4페이지·editor HTTP 200, 없는 경로/.env 404. CORS 정확한 origin 204/다른 origin 403, worker 비공개403. 새 배포에서 같은 스레드 편집본·PDF·PNG 생성.

### 단계별 검증 결과

- [Stage 1](../working/task_m010_21_stage1.md)
- [Stage 2 배포 확인](../working/task_m010_21_stage2.md)

배포 runtime SHA 9607091, image sha256:8d033521e12cbcdd7b21ce0bc3785ff5c299c28bf20bc2af1db9c425da409ced. 후속 2718167은 smoke 입력과 소개를 보완했으며 release runtime 코드는 같다. Linux [35495364805](https://github.com/postmelee/rhwp-slack/actions/runs/35495364805)의 viewer/container 통과. 최종 문서 head의 CI는 PR checks에서 확인한다.

## 잔여 위험과 후속 작업

Marketplace 미제출. 활성 설치/사용자 요건과 심사용 이미지·실제 다른 사용자/철회 수용은 #4. 공존 이벤트 안내는 #25.

## 작업지시자 승인

같은 스레드의 순차 진행 및 codex/public-beta-launch push·CI·PR·검토 후 병합 승인을 적용한다. 별도 재승인을 요구하지 않는다.
