# TypeScript 규칙

## 컴파일러 옵션 (필수)

앱 코드의 tsconfig(Vite면 `tsconfig.app.json`)에 아래 옵션을 켠다.
이미 진행 중인 프로젝트는 하나씩 켜고, 생긴 오류를 고친 뒤 다음 옵션을 켠다.

```json
{
  "compilerOptions": {
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "noImplicitOverride": true,
    "noFallthroughCasesInSwitch": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "verbatimModuleSyntax": true,
    "erasableSyntaxOnly": true
  }
}
```

| 옵션 | 막는 것 |
| --- | --- |
| `strict` | `null`·`undefined` 처리 누락, 암묵적 `any`. 이 옵션 없이는 아래 규칙 대부분이 의미가 없다 |
| `noUncheckedIndexedAccess` | 배열·객체 인덱스 접근 결과를 값이 있다고 가정하는 것 (`items[0].name`) |
| `noImplicitOverride` | 부모 메서드를 덮어쓰면서 `override` 를 빼먹는 것 |
| `noFallthroughCasesInSwitch` | `switch` 의 `break` 누락 |
| `noUnusedLocals`, `noUnusedParameters` | 쓰지 않는 변수·인자 |
| `verbatimModuleSyntax` | 타입만 가져오면서 `import type` 을 쓰지 않는 것 |
| `erasableSyntaxOnly` | `enum`, `namespace`, 생성자 매개변수 프로퍼티처럼 실행 코드를 만드는 TS 문법. 타입만 지우면 실행되는 코드로 유지한다 |

- `erasableSyntaxOnly` 를 켜면 생성자 매개변수 프로퍼티(`constructor(private readonly api: Api)`)를 쓸 수 없다. 필드를 선언하고 생성자에서 대입한다.

```ts
class MenuService {
  private readonly api: Api

  constructor(api: Api) {
    this.api = api
  }
}
```

- 타입 검사는 `typecheck` 스크립트로 따로 둔다. 빌드 도구는 타입 오류가 있어도 빌드하는 경우가 많다. → [lint-and-ci.md](lint-and-ci.md)

## 타입으로 오류를 덮지 않는다

| 금지 | 대신 |
| --- | --- |
| `any` | `unknown` 으로 받고 타입 가드로 좁힌다 |
| `value as User` | 타입 가드, `satisfies`, 검증 함수 |
| `value!` (non-null 단언) | `if (value === undefined) return` 처럼 직접 처리 |
| `// @ts-ignore` | 원인을 고친다. 정말 필요하면 `@ts-expect-error` 와 이유 한 줄 |

- 예외: `as const`, 테스트에서 일부 필드만 가진 가짜 객체.

## 외부에서 들어온 값은 경계에서 검증한다

타입 선언은 실행 중인 값을 보장하지 못한다. 아래 값은 들어오는 곳에서 한 번 검증하고, 그 뒤로는 검증된 타입만 쓴다.

- API 응답
- `localStorage`·`sessionStorage`, URL 파라미터
- 환경변수 → [env-and-security.md](env-and-security.md)

```ts
// 나쁨: 응답이 바뀌어도 타입 오류 없이 화면에서 터진다
const menu = (await res.json()) as Menu

// 좋음: 경계에서 검증하고 실패를 오류로 만든다
const menu = parseMenu(await res.json()) // 형식이 다르면 throw
```

- 검증 라이브러리(zod 등)를 쓸지는 [project-direction.md](project-direction.md) 의 기술 스택에 적는다.

## 타입 설계

- 상태는 boolean 여러 개 대신 구별된 유니언으로 표현한다.

```ts
// 나쁨: isLoading 과 error 가 동시에 참일 수 있다
type State = { isLoading: boolean; error?: Error; data?: Menu }

// 좋음: 가능한 상태만 표현된다
type State =
  | { status: 'loading' }
  | { status: 'error'; error: Error }
  | { status: 'success'; data: Menu }
```

- `enum` 대신 문자열 리터럴 유니언을 쓴다. 값 목록이 필요하면 `as const` 배열에서 타입을 만든다.

```ts
const CATEGORIES = ['korean', 'chinese', 'japanese'] as const
type Category = (typeof CATEGORIES)[number]
```

- 다른 모듈이 가져다 쓰는 함수는 반환 타입을 적는다. 모듈 안에서만 쓰는 함수는 추론에 맡긴다.

## 비동기 · 오류

- Promise 는 `await` 하거나, `.catch()` 로 처리하거나, 반환한다. 그냥 두면 실패가 아무 곳에도 보고되지 않는다.
- 결과를 기다리지 않는 것이 의도라면 `void` 를 붙여 드러낸다. (`void refetch()`)
- `async` 함수를 `void` 를 기대하는 자리(`onClick`, `forEach`, `setTimeout` 콜백)에 바로 넘기지 않는다. 안에서 오류를 처리하는 함수로 감싼다.
- 병렬로 실행할 수 있는 작업은 반복문 안에서 하나씩 `await` 하지 않고 `Promise.all` 로 묶는다.
- `catch` 로 받은 값은 `unknown` 이다. `Error` 라고 가정하지 않고 좁혀서 쓴다.
- `throw` 는 `Error` 객체로 한다. 문자열이나 일반 객체를 던지지 않는다.
- 오류를 잡았으면 처리하거나 다시 던진다. 빈 `catch` 로 삼키지 않는다.
- 다시 던질 때는 `new Error('메뉴 저장 실패', { cause: error })` 처럼 원인을 남긴다.

```ts
// 나쁨: async 함수를 그대로 넘기고, e 를 Error 로 가정한다
button.addEventListener('click', async () => {
  try {
    await saveMenu(menu)
  } catch (e) {
    showToast(e.message)
  }
})

// 좋음: 오류를 좁혀서 처리하고, 핸들러에는 Promise 를 돌려주지 않는 함수를 넘긴다
async function handleSave(): Promise<void> {
  try {
    await saveMenu(menu)
  } catch (error) {
    if (error instanceof HttpError && error.status === 409) {
      showToast('다른 곳에서 먼저 수정했습니다. 새로고침해 주세요')
      return
    }
    showToast('저장하지 못했습니다. 다시 시도해 주세요')
  }
}

button.addEventListener('click', () => {
  void handleSave()
})
```

- 위 규칙 대부분은 타입 정보를 쓰는 린트 규칙이 검사한다. → [lint-and-ci.md](lint-and-ci.md)

## 이름

| 대상 | 규칙 | 예 |
| --- | --- | --- |
| 컴포넌트, 타입 | PascalCase | `MenuResult`, `PickMenuResponse` |
| 훅 | `use` 로 시작 | `usePickHistory` |
| boolean | `is/has/can` 으로 시작 | `isPicking` |
| 상수 | UPPER_SNAKE_CASE | `MAX_HISTORY` |
| 파일 | 내보내는 대상과 같은 이름 | `MenuResult.tsx`, `usePickHistory.ts` |
