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

## 2026-09-22 후속 — 실제 화면 공개 반영

PR #27에서 합성 예시를 승인된 국립국어원 HWP의 실제 Slack 응답 이미지로 교체하고 모바일 확대 링크를 제공했다. Marketplace용 Slack 화면 3장, 브라우저 편집 보조 화면 1장과 소개문·재현 절차를 저장소에 보관했다. 공개 exporter는 홈페이지 JPEG 한 장만 배포한다.

검토·배포 source `9815658`, production Pages `0d4c8640`; 공개 페이지/설치 리디렉션/이미지 일치와 기존 편집기 유지 확인은 [Stage 3](../working/task_m010_21_stage3.md)에 기록했다. Linux viewer/container 통과.

홈페이지 배포는 완료했다. Slack 앱 설정의 새 긴 소개·지원 이메일·이미지 3장 저장 확인은 남아 있다. 브라우저 자동 입력 후 Save Changes 비활성화와 기존 2장 표시를 확인해 사용자에게 저장을 요청했다. #21을 닫거나 Marketplace 제출 준비 전체 완료로 보고하지 않는다. 실제 사용자·설치 철회 수용과 활성 설치/사용 요건, 최종 제출은 #4에서 계속 관리한다.

## 2026-09-22 후속 — 홈페이지 문구 명확화

사용자가 승인한 “한글 문서도 Slack 안에서 자유롭게” 제목과 자동 변환·한컴오피스 없이 열람·브라우저 무료 편집 설명을 적용했다. “자동 변환 합니다.” 표기는 사용자 요청을 그대로 사용한다. 제목 위 HWP · HWPX / SLACK을 제거하고 기능·시작 안내·푸터 제목도 완결된 문장으로 바꿨다. 한국어 단어 중간 줄바꿈을 줄이기 위해 홈페이지 본문과 제목에 keep-all을 적용했다.

기존 공개 exporter 검사 1/1 통과, 프로그램 버전 fb123639… 유지, 데스크톱과 모바일 390px 직접 판독에서 잘림·가로 넘침 없음. 이미지·설치 링크·서버 동작은 변경하지 않았다. 배포·최종 CI 결과는 후속 문구 수정 PR에 기록한다. Slack 설정 저장 대기와 Marketplace #4의 조건은 그대로 남는다.
