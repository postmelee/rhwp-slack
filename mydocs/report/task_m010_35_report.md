# Task #35 최종 보고 — 무효 편집 링크 복구 안내

GitHub Issue: [#35](https://github.com/postmelee/rhwp-slack/issues/35)
마일스톤: M010 문서 계열 (GitHub milestone 미지정)

## 작업 요약

3단계로 로그인 실패 표현과 복구 경로를 개선했다. code/state가 있는 callback의 일반 HTTP 400 대신 고정 안내 주소로 이동한다. 기존 문서 접근 거절을 해제하지 않는다.

## 변경 파일 목록과 영향 범위

| 경로 | 변경 | 영향 |
|---|---|---|
| src/server/installations/signin-result.ts | 고정 분류·HTML | 오류 안내 |
| src/server/installations/signin.ts | 신원·문서 실패 구분 | 기존 검증 유지 |
| src/server/installations/browser-routes.ts | 303 결과 경로·헤더 | 실패/취소 응답 |
| tests/security/*signin*, browser-routes.test.ts | 회귀·권한 발급 없음 | 자동 수용 |
| docs/marketplace.md | #35 완료와 남은 제출 준비 | 운영 정본 |

## 문서 위치 검증

수행계획의 docs/marketplace.md 정본과 mydocs 계획·단계·결과 증거 배치를 따랐다. 별도 사용자 설명 정본을 만들지 않았다.

## 변경 전·후 정량 비교

| 항목 | 전 | 후 |
|---|---|---|
| 옛 연결 거절 | callback HTTP 400, Chrome 오류 화면 관측 | 고정 result 200 HTML, 문서 연결 불가 안내 |
| 실패 코드/문구 분류 | 일반 문구 | 만료·연결 불가·인증 실패·취소 4개 |
| 실패 요청 권한 발급 | 0 | 0 유지 |
| 정상 현재 연결 | 2페이지 문서 열림 | 2페이지 문서 열림 유지 |

성능 개선을 주장하지 않는다.

## 검증 결과

| 수용 기준 | 결과 |
|---|---|
| 새 회귀의 원인 검출 | OK — 수정 전 400 !==303, 수정 후 통과 |
| 보안 | OK — 56/56, 입력·예외 미반영과 ticket 발급 없음 |
| 기존 Slack 동작 | OK — 95/95 |
| Linux | OK — 코드 8448f3e의 push/PR viewer·container 4개 통과 |
| 실제 화면 | OK — desktop·mobile 잘림 없음 |
| 운영 링크 | OK — 실제 옛 카드 거절/현재 카드 문서 표시. Slack 버튼부터의 전 여정은 아님 |
| 배포 범위 | OK — 공개 ingress만 image 변경, revision spec의 나머지 값 동일 |

### 단계별 검증 결과

- [Stage 1](../working/task_m010_35_stage1.md): 구현·원인 검출·보안.
- [Stage 2](../working/task_m010_35_stage2.md): 코드 SHA·CI·이미지 digest·revision·직접 화면 증거.
- [Stage 3](../working/task_m010_35_stage3.md): 리뷰와 심사 준비 연결.

## 잔여 위험과 후속 작업

- ERR_BLOCKED_BY_CLIENT의 확장 프로그램 원인은 미확정이다. 서비스 측 오류 응답을 개선했다.
- 오류 문구는 가능 원인을 안내하며 backend 일시 오류와 영구 권한 거절을 완전히 식별하지 않는다.
- 다른 사용자의 실제 채널 탈퇴 후 차단은 협력자 부재로 #4에 남긴다.
- Marketplace 테스트 자료 URL은 양식에 입력했지만 약관 동의/Next 전 서버 저장은 미완료다. 활성 설치 요건, 최종 제출은 별도다.

## 작업지시자 승인 요청

사용자의 순차 진행 지시에 따라 검토·최종 head CI 확인 후 PR을 병합한다. Marketplace 최종 제출은 하지 않는다.
