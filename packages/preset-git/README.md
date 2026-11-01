# @agentsmd/preset-git

[`@agentsmd/cli`](https://www.npmjs.com/package/@agentsmd/cli)의 언어와 무관한 Git 작업 규칙 프리셋입니다.

```bash
npx @agentsmd/cli init --preset git              # Git 규칙만
npx @agentsmd/cli init --preset git,typescript   # 언어 프리셋과 함께 (java도 가능)
```

- 문서: Git 작업 규칙(이슈 → 브랜치 → PR → merge 커밋), 에이전트 작업 흐름, 리뷰 반영 기준, 문체
- 훅: `commit-msg`(형식·50자·마침표·AI 서명), `pre-commit.d/max-files`(커밋당 파일 수)
- GitHub: PR 규칙 검사 워크플로, 이슈·PR 템플릿
- Claude Code 설정: 훅 우회와 force push 차단
