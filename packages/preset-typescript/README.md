# @agentsmd/preset-typescript

[`@agentsmd/cli`](https://www.npmjs.com/package/@agentsmd/cli)의 TypeScript 프리셋입니다. 프론트엔드·백엔드·라이브러리 어디에나 쓰는 공통 규칙을 담습니다.

```bash
npx @agentsmd/cli init --preset git,typescript         # Git 작업 규칙과 함께
npx @agentsmd/cli init --preset git,typescript,react   # React 프론트엔드
npx @agentsmd/cli init --preset typescript             # Git 규칙 없이 (프로젝트 방향 문서는 함께 설치된다)
```

- 규칙 문서: 필수 tsconfig 옵션, `any`·`as`·`!` 금지, 외부 값 경계 검증, Promise·오류 처리, 기능 단위 폴더, Vitest·MSW 테스트, 환경변수·보안
- 린트·포맷·CI 명령 문서, `.nvmrc`
- tsconfig·린트 설정 파일은 덮어쓰지 않고 문서로 안내합니다.
- React 컴포넌트·접근성·화면 테스트 규칙은 [React 프리셋](https://www.npmjs.com/package/@agentsmd/preset-react)을 함께 고르면 더해집니다.
- Git 훅·GitHub 설정은 설치하지 않습니다. CI 문서에는 특정 서비스와 무관하게 실행할 명령만 적습니다.
- Git 작업 규칙과 훅은 [Git 프리셋](https://www.npmjs.com/package/@agentsmd/preset-git)을 함께 고르면 더해집니다. `AGENTS.md`는 고른 프리셋에 맞춰 만들어집니다.
