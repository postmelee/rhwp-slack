# Task #4 Stage 10 — Community Standards 문서 준비

대상: [#4](https://github.com/postmelee/rhwp-slack/issues/4), [구현계획](../plans/task_m010_4_impl.md).

## 변경

루트에 CODE_OF_CONDUCT.md, CONTRIBUTING.md, SECURITY.md를 작성했다. README와 docs/README.md에서 연결했다. 행동 기준·기여 절차·비공개 취약점 신고를 기존 운영자 이메일과 개인 운영 범위에 맞췄다. 임의의 응답 SLA·버그 바운티·장기 지원 보장을 추가하지 않았다. 앱·배포 파일과 GitHub 설정은 변경하지 않았다.

## 확인

- GitHub Community profile: code_of_conduct_file/contributing=null. 사용자 화면도 행동 강령·기여 안내·보안 정책이 미충족이었다.
- 기존 issue form은 name/description과 body가 있으며 사용자 화면에서 체크됨. REST 응답의 legacy issue_template=null을 폼 실패로 판단하지 않았다.
- 비공개 취약점 신고 기능은 enabled=false. 문서는 실제 제공 중인 지원 이메일을 사용하고 GitHub 신고 버튼이 있다고 안내하지 않는다.
- GitHub 공식 문서에서 인식 파일 위치와 보안 정책 내용(지원 버전·신고 방법)을 확인했다.
- 새 문서 3개와 인덱스 2개의 상대 링크 28개 모두 존재. Node/npm 버전·npm run check를 package.json과 대조했다.
- git diff --check 통과. 문서만 변경하여 앱 테스트와 웹 배포는 반복하지 않았다.

## 상태와 한계

로컬 초안 준비 완료. 원격 push·PR·기본 브랜치 병합과 GitHub 화면의 최종 체크 확인은 아직 하지 않았다. 파일 존재만으로 보안 감사를 통과한 것이 아니며 Community Standards 충족과 Marketplace 제출 조건은 별개다.

## 근거

- [Community profile](https://docs.github.com/en/communities/setting-up-your-project-for-healthy-contributions/about-community-profiles-for-public-repositories)
- [행동 강령](https://docs.github.com/en/enterprise-cloud%40latest/communities/setting-up-your-project-for-healthy-contributions/adding-a-code-of-conduct-to-your-project)
- [기여 안내](https://docs.github.com/en/communities/setting-up-your-project-for-healthy-contributions/setting-guidelines-for-repository-contributors)
- [보안 정책](https://docs.github.com/en/code-security/how-tos/report-and-fix-vulnerabilities/configure-vulnerability-reporting/add-security-policy)
