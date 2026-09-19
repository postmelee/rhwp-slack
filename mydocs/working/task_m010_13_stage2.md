# Task #13 Stage 2 — 다운로드 전 중복 조회 제거

기준 a20d51c와 변경 후 `ensureSource`를 같은 합성 입력·단일 멤버 목록 페이지에서 각3회 실행했다. 원본 bytes를 저장하거나 권한을 요청 간 캐시하지 않는다.

| 경로 | Slack 논리 호출 전→후 | metadata get 전→후 | 다운로드 |
|---|---|---|---|
| 원본 | 9→6 | 5→4 | 양쪽1회 |
| 수정본(root 확인 포함) | 15→12 | 5→4 | 양쪽1회 |

각3표본의 호출 수는 같았다. 이는 source 함수 내부만의 합성 비교이며 세션 확인 등 HTTP 전체 호출 수, 네트워크 실제 전송 횟수, Firestore 과금 read 수, 실제 지연/요금 감소율을 뜻하지 않는다. 이전 코드는 git show a20d51c로 읽어 같은 의존성/fixture에서 실행했다. 원시 숫자는 ignored `.cache/task13/call-counts.json`에 보존했다.

공개 authorize는 기존 card 반환 계약을 유지하고 내부에서 source 정보도 함께 검증·반환한다. ensureSource가 이 source를 받아 다운로드한 뒤 기존과 같이 다시 카드/채널/파일/root 권한과 내용 해시를 확인한다.

Node 24.21.0 typecheck 통과, cloud-application 10/10. 원본/수정본 연속 요청의 호출 수와 다운로드 중 멤버 제외·root 공유 해제·card 무효화·내용 변경 차단을 검증했다. 운영 사양과 배포는 변경하지 않았다.
