# Task #4 Stage 11 — GitHub Sponsors 후원 안내

대상: [#4](https://github.com/postmelee/rhwp-slack/issues/4), [구현계획](../plans/task_m010_4_impl.md).

## 변경

사용자 요청에 따라 .github/FUNDING.yml의 github 계정을 postmelee로 지정했다. README와 지원 페이지에 무료 호스팅·서버 운영비·장기 유지에 대한 후원 안내와 선택 사항임을 설명했다. 홈페이지 하단에는 짧은 안내를 넣고 공개 페이지 6개의 하단 메뉴에 동일한 GitHub Sponsors 링크를 연결했다. 기존 히어로·영상 구성과 후원 계정의 결제·정산 설정은 유지했다.

## 확인

- GitHub GraphQL: postmelee의 hasSponsorsListing=true, sponsorsListing 존재 확인. 대상 URL은 https://github.com/sponsors/postmelee .
- [공식 안내](https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/customizing-your-repository/displaying-a-sponsor-button-in-your-repository)의 기본 브랜치 .github/FUNDING.yml, github 키 형식과 일치한다.
- Node 24.21.0: node --test tests/unit/public-site.test.mjs 1/1 통과. 공개 파일·링크·고지·CSP 범위 검사.
- scripts/export-pages.mjs --public-site 실행 성공: 81개 파일, 75개 헤더, 프로그램 namespace 유지.
- http://127.0.0.1:8770/에서 홈페이지 하단 1440×900·390×844 직접 확인. 모바일 가로 넘침 없음(scrollWidth=innerWidth=390), 후원 링크 줄바꿈 정상. 지원 페이지의 후원 설명도 390×844에서 확인했다.
- git diff --check 통과. 문구와 링크 추가로 앱 전체 테스트는 반복하지 않았다.

## 상태

로컬 준비 완료. Stage 10 커뮤니티 문서와 함께 원격 반영할 수 있다. 아직 push·PR·병합·Pages 배포 전이며 GitHub Sponsor 버튼의 실제 표시와 공개 홈페이지 안내 게시를 완료했다고 보고하지 않는다.
