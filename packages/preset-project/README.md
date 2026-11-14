# @agentsmd/preset-project

[`@agentsmd/cli`](https://www.npmjs.com/package/@agentsmd/cli)의 프로젝트 방향 문서 프리셋입니다.

```bash
npx @agentsmd/cli init --preset git,typescript   # 언어 프리셋을 고르면 함께 설치된다 (java도 같다)
npx @agentsmd/cli init --preset project          # 방향 문서만
```

- `docs/project/direction.md`: 목표, 범위, 하지 않는 것, 지원 환경, 기술 스택, 설계 원칙, 진행 단계, 결정 기록
- 사람이 채우는 문서입니다. 에이전트는 모든 작업 전에 읽고, 범위 밖 작업이면 먼저 묻습니다.
- 언어와 무관한 문서라 따로 나눴습니다. TypeScript와 Java를 함께 쓰는 저장소에도 문서는 하나만 설치됩니다.
- 핵심 규칙, 검증 명령, Git 훅은 넣지 않습니다. `AGENTS.md`는 고른 프리셋에 맞춰 만들어집니다.
