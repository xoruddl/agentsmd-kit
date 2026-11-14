# 린트 · 포맷 · CI

## 필수 스크립트

`package.json` 에 아래 여섯 스크립트를 둔다. CI 와 에이전트가 이 이름으로 실행한다.

| 스크립트 | 하는 일 | 예 |
| --- | --- | --- |
| `lint` | 린트 | `oxlint` 또는 `eslint .` |
| `format` | 포맷 고치기 | `prettier --write .` |
| `format:check` | 포맷 검사 (고치지 않음) | `prettier --check .` |
| `typecheck` | 타입 검사 | `tsc -b` 또는 `tsc --noEmit` |
| `test` | 테스트 1회 실행 | `vitest run` |
| `build` | 배포용 빌드 | `tsc -p tsconfig.build.json`, `vite build` 등 |

작업을 마치기 전에 `format` 을 뺀 다섯 개를 실행하고 결과를 그대로 보고한다.

```bash
pnpm lint && pnpm format:check && pnpm typecheck && pnpm test && pnpm build
```

## 린트 규칙

oxlint 를 쓰면 `.oxlintrc.json` 에 아래 규칙을 켠다.

```json
{
  "$schema": "./node_modules/oxlint/configuration_schema.json",
  "plugins": ["typescript", "oxc"],
  "options": {
    "typeAware": true
  },
  "rules": {
    "typescript/no-explicit-any": "error",
    "typescript/no-non-null-assertion": "error",
    "typescript/no-floating-promises": "error",
    "typescript/no-misused-promises": "error",
    "typescript/only-throw-error": "error"
  }
}
```

- `no-floating-promises` 처럼 타입 정보가 필요한 규칙은 `options.typeAware` 를 켜고 `oxlint-tsgolint` 를 `devDependencies` 에 추가해야 동작한다.
- `oxlint-tsgolint` 는 TypeScript 7(typescript-go) 기반이다. tsconfig 가 TypeScript 7 에서 지원하지 않는 옵션을 쓰면 먼저 정리한다.

| 규칙 | 막는 것 | 관련 문서 |
| --- | --- | --- |
| `typescript/no-explicit-any` | `any` | [rules.md](rules.md) |
| `typescript/no-non-null-assertion` | `value!` | [rules.md](rules.md) |
| `typescript/no-floating-promises` | 기다리지도, 처리하지도 않은 Promise | [rules.md](rules.md) |
| `typescript/no-misused-promises` | `async` 함수를 `void` 를 기대하는 콜백에 넘기는 것, 조건문에 Promise 를 쓰는 것 | [rules.md](rules.md) |
| `typescript/only-throw-error` | 문자열이나 일반 객체를 `throw` 하는 것 | [rules.md](rules.md) |

ESLint 를 쓰면 typescript-eslint 로 같은 규칙을 켠다. `recommendedTypeChecked` 설정을 쓰면 위의 타입 정보가 필요한 규칙이 함께 켜진다.

React 같은 프레임워크를 쓰면 그 프레임워크 프리셋 문서의 린트 규칙을 위 설정에 더한다.

## 포맷

- Prettier 에 맡긴다. 손으로 정렬하지 않는다. 설정은 저장소의 `.prettierrc` 를 따른다.
- 고칠 때: `pnpm format` (`prettier --write .`)

## CI

어떤 CI 서비스를 쓰든 아래 순서로 실행한다. 작업을 마치기 전에 돌리는 검증 명령과 같다.

```bash
pnpm install --frozen-lockfile
pnpm lint && pnpm format:check && pnpm typecheck && pnpm test && pnpm build
```

- Node 버전은 `.nvmrc`, pnpm 버전은 `package.json` 의 `packageManager` 를 따른다.
- npm·yarn 을 쓰면 설치 단계와 명령을 맞게 바꾼다.
