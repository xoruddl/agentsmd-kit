# React 컴포넌트 · 접근성

타입 규칙, 검증 명령, 공통 린트 설정은 TypeScript 프리셋 문서를 따른다. 이 문서는 React 화면 코드에만 해당하는 규칙이다.

## 폴더

기술 종류가 아니라 기능 단위로 나눈다.

```text
src/
  api/          서버 통신 함수, 응답 타입과 검증, 서버 상태 훅
  components/   여러 기능이 함께 쓰는 화면 조각
  <기능>/       한 기능의 훅·컴포넌트·로직 (예: history/, location/)
  mocks/        MSW 핸들러 (테스트와 개발 서버가 같이 쓴다)
  test/         테스트 공통 설정
```

- 한 기능 폴더에만 쓰던 컴포넌트를 다른 기능도 쓰게 되면 `components/` 로 옮긴다.

## 컴포넌트

- 컴포넌트 하나 = 파일 하나. 파일 이름은 컴포넌트 이름과 같다.
- props 타입은 컴포넌트 바로 위에 `type <컴포넌트>Props` 로 둔다.
- 데이터 가져오기와 상태 계산은 훅으로 뺀다. 컴포넌트는 받은 값을 그리는 데 집중한다.
- 서버 데이터는 서버 상태 도구(TanStack Query 등)로 다룬다. `useEffect` + `useState` 로 직접 가져오지 않는다.
- `useEffect` 는 외부 시스템(브라우저 API, 지도 SDK 등)과 맞출 때만 쓴다. props 나 state 로 계산할 수 있는 값은 렌더링 중에 계산한다.
- 훅은 조건문·반복문 안에서 부르지 않는다. 의존성 배열을 비우거나 빼서 경고를 피하지 않는다. (린트가 검사한다)
- 순서가 바뀔 수 있는 목록의 `key` 에 배열 인덱스를 쓰지 않는다. 안정적인 id 를 쓴다.

## 이름

| 대상 | 규칙 | 예 |
| --- | --- | --- |
| 컴포넌트 | PascalCase, 파일 이름과 같게 | `MenuResult.tsx` |
| 훅 | `use` 로 시작, 파일 이름과 같게 | `usePickHistory.ts` |
| props 타입 | `<컴포넌트>Props` | `MenuResultProps` |
| 이벤트 핸들러 | 받을 때 `on*`, 만들 때 `handle*` | `onSelect`, `handleSelect` |

## 화면 상태

서버 데이터를 그리는 화면은 네 가지 상태를 모두 그린다.

| 상태 | 예 |
| --- | --- |
| 로딩 | 스켈레톤, 진행 표시 |
| 오류 | 무엇이 실패했는지와 다시 시도할 방법 |
| 빈 결과 | 결과가 없다는 안내와 다음 행동 |
| 성공 | 데이터 |

## 접근성 (필수)

- 누르는 요소는 `<button>`, 이동은 `<a href>` 를 쓴다. `<div onClick>` 을 쓰지 않는다.
- 이미지에는 `alt` 를 단다. 장식용 이미지는 `alt=""`.
- 입력 요소는 `<label>` 과 연결한다. placeholder 를 label 대신 쓰지 않는다.
- 아이콘만 있는 버튼은 `aria-label` 로 이름을 준다.
- 색만으로 정보를 전하지 않는다. (오류를 빨간색으로만 표시하지 않는다)
- 키보드만으로 모든 동작을 할 수 있어야 한다. 포커스 표시(`outline`)를 지우지 않는다.
- 일부는 린트(jsx-a11y)가 검사하고, 나머지는 리뷰에서 확인한다. 테스트에서 `getByRole` 로 찾을 수 없는 요소는 접근성 문제일 가능성이 높다. → [react-testing.md](react-testing.md)

## 린트 규칙

oxlint 를 쓰면 `.oxlintrc.json` 의 `plugins` 에 `react`, `jsx-a11y` 를 더하고 아래 규칙을 켠다.

```json
{
  "plugins": ["react", "jsx-a11y"],
  "rules": {
    "react/rules-of-hooks": "error",
    "react/exhaustive-deps": "error",
    "react/no-danger": "error"
  }
}
```

| 규칙 | 막는 것 |
| --- | --- |
| `react/rules-of-hooks` | 조건문·반복문 안의 훅 호출 |
| `react/exhaustive-deps` | 의존성 배열 누락으로 오래된 값을 쓰는 것 |
| `react/no-danger` | `dangerouslySetInnerHTML` → [browser-security.md](browser-security.md) |
| `jsx-a11y` 플러그인 | `alt` 없는 이미지 등 접근성 문제 |

ESLint 를 쓰면 eslint-plugin-react-hooks, eslint-plugin-react, eslint-plugin-jsx-a11y 로 같은 규칙을 켠다.
