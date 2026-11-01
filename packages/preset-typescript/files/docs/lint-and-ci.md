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
  "rules": {
    "react/rules-of-hooks": "error",
    "react/exhaustive-deps": "error",
    "react/no-danger": "error",
    "typescript/no-explicit-any": "error",
    "typescript/no-non-null-assertion": "error",
    "typescript/consistent-type-imports": "error"
  }
}
```

| 규칙 | 막는 것 | 관련 문서 |
| --- | --- | --- |
| `react/rules-of-hooks` | 조건문·반복문 안의 훅 호출 | [structure.md](structure.md) |
| `react/exhaustive-deps` | 의존성 배열 누락으로 오래된 값을 쓰는 것 | [structure.md](structure.md) |
| `react/no-danger` | `dangerouslySetInnerHTML` | [env-and-security.md](env-and-security.md) |
| `typescript/no-explicit-any` | `any` | [typescript.md](typescript.md) |
| `typescript/no-non-null-assertion` | `value!` | [typescript.md](typescript.md) |
| `typescript/consistent-type-imports` | 타입을 일반 `import` 로 가져오는 것 | [typescript.md](typescript.md) |
| `jsx-a11y` 플러그인 | `alt` 없는 이미지 등 접근성 문제 | [structure.md](structure.md) |

ESLint 를 쓰면 typescript-eslint, eslint-plugin-react-hooks, eslint-plugin-jsx-a11y 로 같은 규칙을 켠다.

## 포맷

- Prettier 에 맡긴다. 손으로 정렬하지 않는다. 설정은 저장소의 `.prettierrc` 를 따른다.
- 고칠 때: `pnpm format` (`prettier --write .`)

## Git 훅

공통 훅(커밋 형식, 파일 수)은 [git-conventions.md](git-conventions.md) 의 자동 검사를 따른다.
TypeScript 프리셋은 포맷 검사 하나를 더한다.

| 파일 | 검사 |
| --- | --- |
| `.githooks/pre-commit.d/prettier` | 스테이징된 파일만 `prettier --check`. `package.json` 과 설치된 Prettier 가 있을 때만 |

## CI

[.github/workflows/ci.yml](../.github/workflows/ci.yml)

- Node 버전은 `.nvmrc`, pnpm 버전은 `package.json` 의 `packageManager` 를 따른다.
- `install --frozen-lockfile` → `lint` → `format:check` → `typecheck` → `test` → `build`
- npm·yarn 을 쓰면 설치 단계와 명령을 맞게 바꾼다.
