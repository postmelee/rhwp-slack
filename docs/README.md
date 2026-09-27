# 관리자·개발자 문서

일반적인 설치·사용법은 [사용 안내](https://rhwp-slack.pages.dev/guide/)를 참고하세요. 아래 문서는 조직에서 직접 운영하거나 앱 코드를 수정할 때 사용합니다.

## 조직에서 운영하기

- [자체 호스팅](self-hosting.md): 조직 소유 Slack 앱·Cloud Run·Pages 구성과 수용 검사.
- [외부 브라우저 배포 구성](external-beta.md): OAuth 설치, 워크스페이스별 인증 정보와 실행 설정.
- [정적 프로그램 호스팅](static-hosting.md): 브라우저 프로그램과 인증 API 분리.
- [Cloud Run 운영](cloud-run.md): 실행 사양, 비용 관찰과 복구. 기존 운영 기록은 조직별 설정 예제가 아니므로 실제 ID·주소를 그대로 복사하지 마세요.

## 기여하기

이슈·PR 작성과 변경별 검증은 [기여 안내](../CONTRIBUTING.md), 취약점 신고는 [보안 정책](../SECURITY.md)을 참고하세요.

## 로컬에서 개발하기

Node **24.21.0**, npm **11.19.0**, Git이 필요합니다.

```sh
nvm install
nvm use
npm ci
npm exec playwright install chromium
npm run dev
```

[로컬 편집기](http://127.0.0.1:4173/editor/?devtools=1)에서 테스트 파일을 선택합니다. 이 서버는 Slack 인증 서버를 대신하지 않습니다. 일반 `/editor/`에는 파일 선택 도구가 없습니다.

- [Slack 개발 서버](development.md): 단일 워크스페이스용 로컬 서버·내부 embed·컨테이너 검사. 공개 배포는 자체 호스팅 안내의 분산 서버 경로를 사용하세요.
- [인증·파일 처리 구조](architecture.md): 세션, 채널·파일 접근 권한과 저장 흐름.
- [의존성과 갱신](dependencies.md): 고정 엔진·소스 해시·폰트와 검증 한계.
- [MIT License](../LICENSE) · [제3자 고지](../THIRD_PARTY_NOTICES.md).

`src/editor/`는 편집기 호스트, `src/conversion/`은 PDF·이미지 변환, `src/server/`는 Slack·권한·저장·작업 처리, `studio/`는 upstream 버전과 빌드 정책입니다.

## 변경 검증

```sh
npm exec playwright install chromium
npm run check
git diff --check
```

Linux에서는 `npm exec playwright install --with-deps chromium`으로 브라우저 의존성을 설치합니다. 검사가 사용하는 포트의 개발 서버는 먼저 종료하세요. 로컬 자동 검사와 실제 Slack에서의 설치·로그인·편집·저장 검증은 구분합니다.

테스트 문서는 `node scripts/create-preview-fixture.mjs`로 생성할 수 있습니다. 비밀값·사용자 원본·변환 결과를 Git에 넣지 마세요.
