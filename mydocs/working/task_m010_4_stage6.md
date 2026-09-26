# Task #4 Stage 6 — 새 시연 영상 공개 미리보기

계획: [Stage 6](../plans/task_m010_4_impl.md). 2026-09-26, 로컬 검증 완료·사용자 시각 승인 대기. 공개 배포와 Slack 양식 변경은 아직 수행하지 않았다.

## 변경

- 홈페이지의 시연 영상 보기 링크와 재생 영역, /review/의 사용 영상 추가. 기존 설치·로그인 스크린샷 보존. 새 채널 초대 시 자동 감지와 /rhwp 설정 진입 설명 갱신.
- 원본 영상은 Downloads에 그대로 두고 공개용 압축본·대표 프레임만 site/assets/demo/에 추가. 1662×1080, H.264/yuv420p, 60→30fps, CRF21, faststart, AAC128k. 원본 오디오 분석은 모든 샘플 -91dB 무음이다.
- 명시적 공개 파일 목록에 MP4/JPG 추가. 공개 사이트 export에만 media-src 'self'를 추가해 영상 로드를 허용하고, 비공개 export와 서버 편집기 정책은 유지.

## 영상 검토와 검증

| 항목 | 결과 |
|---|---|
| 원본 | 65.383초, 54,703,507 bytes, SHA256 26c91ee51f816441ab34e4f16b6f17840adcbb180f0f4864b86dcb7fc160b19e |
| 압축본 | 65.400초, 12,589,735 bytes, SHA256 f651961169747fd4c4299a7ce654bc80dbfdf60c0543ebf319134304a2453141 |
| 내용 | 주기별 contact sheet 및 0·20·28·37·46·64초 대표 프레임에서 업로드·PDF·Firefox 편집·저장 결과 확인. 모든 프레임을 직접 판독한 검사는 아님 |
| 전체 디코딩 | ffmpeg -i 압축본 -f null - 오류 없이 통과 |
| 공개 export 검사 | node --test tests/unit/public-site.test.mjs 통과 |
| CSP 회귀 | media-src 검사 추가 후 수정 전 해당 assertion 실패, export 정책 수정 후 통과. 비공개 export에 media-src 미포함도 확인 |
| Pages export | 78파일, 사이트 14,578,144 bytes, 헤더72개, 25MiB 파일 제한 통과 |
| 프로그램 namespace | ea2d06d323e9c93b29e683feb45cdfedd8705b0f6ccf912f143e158d7b881451 유지 |
| UI | Codex 브라우저 1280px/390px 홈페이지·review 확인. 390px에서 scrollWidth=390, 잘림·가로 넘침 없음 |
| 영상 재생 | export CSP를 적용한 로컬 서버에서 실제 재생과 후반 구간 이동 확인. 브라우저 오류 로그 없음 |

검증 명령은 Node24.21.0을 사용했다. 임시 검증 자료는 /private/tmp/rhwp-market-video/에 있다(contact.jpg, frame-*.png, csp-before.log, home-mobile.png, review-mobile.png, review-desktop.png). 배포 헤더를 적용한 로컬 미리보기는 http://127.0.0.1:8767/ 및 /review/이다. 이 서버는 확인용이며 배포되지 않는다.

## 남은 작업

사용자가 UI를 확인하면 PR·게시와 공개 URL 확인, Slack 전용 URL 입력·전체 재로드 검증을 진행한다. 이번 영상은 설치된 앱의 사용 시연으로 설치 OAuth·제거 영상은 포함하지 않는다. Slack 공식 review guide의 전체 심사 시연 권고를 보완할 자료가 필요하다. 활성 workspace10개 요건과 양식 영구 저장 문제는 Stage5의 미해결 상태로 유지하며 이번 작업을 제출 완료로 표시하지 않는다.

## 사용자 시각 피드백 반영

2026-09-26: 홈페이지 hero의 텍스트 열을 넓히고 이미지를 오른쪽에 정렬했다. 1280px 이상에서는 원본 PNG의 오른쪽 투명 여백112px을 CSS에서 보정해 실제 창 테두리를 헤더 끝에 맞췄다. 데스크톱에서 첫 안내 문장은 한 줄, 좁은 화면에서는 자연스러운 줄바꿈을 유지한다.

영상 영역 영문 소제목과 캡션을 제거하고 제목·설명을 사용자 지정 문구로 교체했다. 홈페이지 영상 폭을 최대960px로 줄이고 controls·autoplay·muted·playsinline을 적용했다. 실제 화면에서 무음 자동재생 진행(29초)을 관측했다. 브라우저의 사용자 자동재생 차단 설정을 강제로 우회하지 않는다. 390px 모바일 가로 넘침 없음과 상단·영상 영역을 직접 확인했다. /review/의 수동 재생 설정은 유지한다. 공개 게시 전 사용자 확인 대기를 유지한다.
