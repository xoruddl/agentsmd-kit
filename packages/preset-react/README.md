# @agentsmd/preset-react

[`@agentsmd/cli`](https://www.npmjs.com/package/@agentsmd/cli)의 React 프론트엔드 프리셋입니다.

```bash
npx @agentsmd/cli init --preset git,typescript,react   # Git·TypeScript 규칙과 함께 (권장)
npx @agentsmd/cli init --preset typescript,react       # TypeScript 규칙과 함께
```

- 규칙 문서: 컴포넌트·훅, 폴더, 화면 상태 4가지, 접근성, React·jsx-a11y 린트 규칙
- Testing Library·MSW 화면 테스트, 공개 환경변수·XSS·인증 토큰 등 브라우저 보안
- 타입 규칙, 검증 명령, `.nvmrc`는 넣지 않습니다. [TypeScript 프리셋](https://www.npmjs.com/package/@agentsmd/preset-typescript)을 함께 고르면 더해집니다.
- Git 훅·GitHub 설정은 설치하지 않습니다. `AGENTS.md`는 고른 프리셋에 맞춰 만들어집니다.
