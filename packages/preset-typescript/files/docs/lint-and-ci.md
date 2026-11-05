# 린트 · 포맷 · CI

## 필수 스크립트

`package.json` 에 아래 다섯 스크립트를 둔다. CI 와 에이전트가 이 이름으로 실행한다.

| 스크립트 | 하는 일 | 예 |
| --- | --- | --- |
| `lint` | 린트 | `oxlint` 또는 `eslint .` |
| `format:check` | 포맷 검사 (고치지 않음) | `prettier --check .` |
| `typecheck` | 타입 검사 | `tsc -b` 또는 `tsc --noEmit` |
| `test` | 테스트 1회 실행 | `vitest run` |
| `build` | 배포용 빌드 | `vite build` |

작업을 마치기 전에 모두 실행하고 결과를 그대로 보고한다.

```bash
pnpm lint && pnpm format:check && pnpm typecheck && pnpm test && pnpm build
```

## 린트 규칙

oxlint 를 쓰면 `.oxlintrc.json` 에 아래 규칙을 켠다.

```json
{
  "$schema": "./node_modules/oxlint/configuration_schema.json",
  "plugins": ["react", "typescript", "oxc", "jsx-a11y"],
  "options": {
    "typeAware": true
  },
  "rules": {
    "react/rules-of-hooks": "error",
    "react/exhaustive-deps": "error",
    "react/no-danger": "error",
    "typescript/no-explicit-any": "error",
    "typescript/no-non-null-assertion": "error",
    "typescript/consistent-type-imports": "error",
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
| `react/rules-of-hooks` | 조건문·반복문 안의 훅 호출 | [structure.md](structure.md) |
| `react/exhaustive-deps` | 의존성 배열 누락으로 오래된 값을 쓰는 것 | [structure.md](structure.md) |
| `react/no-danger` | `dangerouslySetInnerHTML` | [env-and-security.md](env-and-security.md) |
| `typescript/no-explicit-any` | `any` | [typescript.md](typescript.md) |
| `typescript/no-non-null-assertion` | `value!` | [typescript.md](typescript.md) |
| `typescript/consistent-type-imports` | 타입을 일반 `import` 로 가져오는 것 | [typescript.md](typescript.md) |
| `typescript/no-floating-promises` | 기다리지도, 처리하지도 않은 Promise | [typescript.md](typescript.md) |
| `typescript/no-misused-promises` | `async` 함수를 `void` 를 기대하는 콜백에 넘기는 것, 조건문에 Promise 를 쓰는 것 | [typescript.md](typescript.md) |
| `typescript/only-throw-error` | 문자열이나 일반 객체를 `throw` 하는 것 | [typescript.md](typescript.md) |
| `jsx-a11y` 플러그인 | `alt` 없는 이미지 등 접근성 문제 | [structure.md](structure.md) |

ESLint 를 쓰면 typescript-eslint, eslint-plugin-react-hooks, eslint-plugin-jsx-a11y 로 같은 규칙을 켠다.
typescript-eslint 는 `recommendedTypeChecked` 설정을 쓰면 위의 타입 정보가 필요한 규칙이 함께 켜진다.

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
