# @agentsmd/core

[`@agentsmd/cli`](https://www.npmjs.com/package/@agentsmd/cli)의 검사 로직과 프리셋 설치 로직입니다.
CLI 없이 코드에서 검사하고 싶을 때 씁니다.

```ts
import { checkRepository } from "@agentsmd/core";

const findings = await checkRepository({ root: process.cwd() });
// [{ ruleId: 'broken-link', file: 'AGENTS.md', line: 12, message: '링크 대상이 없습니다: docs/api.md' }]
```

검사 규칙은 [docs/rules.md](https://github.com/xoruddl/agentsmd-kit/blob/main/docs/rules.md)를 참고하세요.
