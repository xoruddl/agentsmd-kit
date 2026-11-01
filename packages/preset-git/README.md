# @agentsmd/preset-git

[`@agentsmd/cli`](https://www.npmjs.com/package/@agentsmd/cli)의 공통 Git 작업 규칙 프리셋입니다. 언어 프리셋(`java`, `typescript`)을 설치하면 함께 설치됩니다.

- 문서: Git 작업 규칙(이슈 → 브랜치 → PR → merge 커밋), 에이전트 작업 흐름, 리뷰 반영 기준, 문체
- 훅: `commit-msg`(형식·50자·마침표·AI 서명), `pre-commit`(커밋당 파일 수, 언어별 검사 실행)
- GitHub: PR 규칙 검사 워크플로, 이슈·PR 템플릿
- Claude Code 설정: 훅 우회와 force push 차단
