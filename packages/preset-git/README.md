# @agentsmd/preset-git

[`@agentsmd/cli`](https://www.npmjs.com/package/@agentsmd/cli)의 언어와 무관한 Git 작업 규칙 프리셋입니다.

```bash
npx @agentsmd/cli init --preset git                     # Git 규칙만
npx @agentsmd/cli init --preset git,typescript          # 언어 프리셋과 함께 (java도 가능)
npx @agentsmd/cli init --preset git,github,typescript   # GitHub 템플릿까지
```

- 문서: Git 작업 규칙(이슈 → 브랜치 → PR → merge 커밋), 에이전트 작업 흐름, 리뷰 반영 기준, 문체
- 훅: `commit-msg`(형식·50자·마침표·AI 서명), `pre-commit.d/max-files`(커밋당 파일 수)
- PR 규칙 검사: `.githooks/check-pr`(브랜치 이름·PR 제목·이슈 연결 `Closes #N`/`Refs #N`). 환경변수만 넘기면 GitHub Actions, GitLab CI, Jenkins 어디서든 부를 수 있습니다.
- Claude Code 설정: 훅 우회와 force push 차단
- 호스팅·CI 설정 파일은 설치하지 않습니다. GitHub 이슈·PR 템플릿은 [GitHub 프리셋](https://www.npmjs.com/package/@agentsmd/preset-github)에 있습니다.
