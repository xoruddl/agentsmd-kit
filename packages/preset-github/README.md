# @agentsmd/preset-github

[`@agentsmd/cli`](https://www.npmjs.com/package/@agentsmd/cli)의 GitHub 프리셋입니다.

```bash
npx @agentsmd/cli init --preset git,github,typescript   # Git 규칙 + GitHub + 언어 규칙
npx @agentsmd/cli init --preset github                  # GitHub 템플릿만
```

- 이슈 템플릿(기능·버그, 빈 이슈 막기)과 PR 템플릿
- `docs/github/repository-setup.md`: gh 명령, 머지 방식·룰셋 설정, CI 연결 방법
- CI 설정 파일은 설치하지 않습니다. GitHub를 써도 CI는 GitHub Actions, Jenkins 등 무엇이든 쓸 수 있어서, 연결 방법만 문서로 안내합니다.
- Git 작업 규칙과 PR 규칙 검사 스크립트(`.githooks/check-pr`)는 [Git 프리셋](https://www.npmjs.com/package/@agentsmd/preset-git)을 함께 고르면 더해집니다.
