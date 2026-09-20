# Task #23 최종 보고서 — 미저장 편집 보존과 재인증

GitHub Issue: [#23](https://github.com/postmelee/rhwp-slack/issues/23) · 마일스톤 M010 · 2단계

## 작업 요약

세션 만료 후 원래 Studio를 유지하고 실제 Slack OIDC 로그인으로 인증을 갱신한다. 같은 문서·사용자·워크스페이스·채널을 확인한 후에만 bearer를 바꾸며 같은 저장 요청과 내보낸 바이트를 재시도한다. 복구 실패 시 현재 편집본을 다운로드할 수 있다.

## 변경 파일 목록과 영향 범위

| 경로 | 변경 | 영향 |
|---|---|---|
| src/editor/reconnect.ts, main.ts, save.ts, style.css | popup source/origin/nonce 검증, 동일 identity, 요청 보존, 다운로드 | 외부 브라우저 편집 |
| src/server/editor-routes.ts, installations/{signin,state,browser-routes}.ts | OIDC state에 reconnect 결속·metadata identity·안전한 오류 코드 | 기존 인증 검증 유지 |
| studio/vite.config.ts | 공유 캐시 realpath, 필수 overlay 누락 시 빌드 실패 | 기존 dirty/Slack 영속 저장 금지 정책 보장 |
| tests/security, tests/viewer | 만료·다른 계정·위조·취소·동일 저장 회귀 | 실제 Studio 사용 |

## 문서 위치 검증

계획의 제품 안내 site/guide 및 docs/external-beta, 작업 증적 mydocs/working/report와 실제 위치가 일치한다.

## 변경 전·후 비교

| 상황 | 변경 전 | 변경 후 |
|---|---|---|
| 세션 만료 | 같은 창에서 저장 연결 복구 불가 | Studio와 미저장 상태 보존 후 Slack 재로그인·동일 요청 저장 |
| 복구 불가 | 미저장 편집 보관 경로 부족 | 현재 편집본 다운로드 |
| 캐시 symlink 빌드 | 필수 overlay 조용히 생략 가능 | canonical path 적용·누락 시 실패 |

## 검증 결과

- [Stage 1 구현·로컬 검사](../working/task_m010_23_stage1.md): Node 24.21.0 typecheck, unit10/security53/Slack87/conversion9 통과. Playwright 전체29 시나리오 통과(기존 upstream undo expected-failure 포함).
- 새3 시나리오: 동일 iframe·원본 재다운로드 없음·같은 저장 ID/bytes, 이후 입력 dirty 유지; 다른 사용자 거부/다운로드; 위조 source/nonce·popup 취소.
- [Stage 2 실제 Slack 복구](../working/task_m010_23_stage2.md): 정책 변경 없이 10분 비활성 만료→별도 Slack OIDC→원래 편집 유지→같은 스레드 편집본4·PDF·PNG2장. Slack 이미지 뷰어에서 재로그인 전 입력 문구 보존 직접 확인.
- [Linux 35496357780](https://github.com/postmelee/rhwp-slack/actions/runs/35496357780): cd8e4ee viewer/container 모두 통과. 이후 변경은 검증 기록이며 최종 head는 PR checks에서 확인.

배포 소스9607091, image sha256:8d033521e12cbcdd7b21ce0bc3785ff5c299c28bf20bc2af1db9c425da409ced. Pages namespace fb123639846d0d2a6359dcfcd15f5ebef5a628a16271afdcee5d5f057f637c05. 최종 홈페이지 안내 배포17a7e1a3은 동일 프로그램과 바뀐 공개 이름 안내를 제공한다.

## 잔여 위험과 후속 작업

실제 복구는 Chrome과 같은 운영자 계정으로 검증했다. 다른 브라우저·다른 동료 로그인과 실제 권한 회수/제거·재설치는 추가 수용이 필요하다. popup이 차단되면 안내/다운로드를 사용하며 인증을 완화하지 않는다. #25의 두 앱 공존 이벤트 안내는 별도 문제다. Cloud Run 사양/예산과 내부 운영 앱은 유지했다.

## 작업지시자 승인

동일 스레드의 순차 진행과 codex/public-beta-launch push·CI·PR·검토 후 병합 승인을 적용한다.
