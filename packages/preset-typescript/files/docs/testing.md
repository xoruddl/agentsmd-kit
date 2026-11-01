# 테스트

도구: Vitest, Testing Library(`@testing-library/react`, `user-event`, `jest-dom`), MSW, jsdom.

## 무엇을 어떻게 테스트하나

| 대상 | 방법 |
| --- | --- |
| 순수 로직 (계산, 변환, 검증) | 입력과 출력을 비교하는 단위 테스트 |
| 훅 | `renderHook` 으로 호출하고 결과를 확인 |
| 컴포넌트 | 렌더링 → 사용자 동작 → 화면에 보이는 결과 확인 |
| 서버 통신 | MSW 로 응답을 고정하고 화면·훅 결과 확인 |

## 원칙

- 사용자가 보고 하는 것을 검사한다. 내부 state, 클래스 이름, 자식 컴포넌트 구조를 검사하지 않는다.
- 요소는 `getByRole` → `getByLabelText` → `getByText` 순서로 찾는다. `data-testid` 는 다른 방법이 없을 때만 쓴다.
- 사용자 동작은 `fireEvent` 대신 `userEvent` 로 만든다.
- 비동기로 나타나는 결과는 `findBy*` 로 기다린다. 임의의 시간만큼 기다리지 않는다.
- 네트워크는 `fetch` 를 직접 가짜로 바꾸지 않고 MSW 핸들러로 응답한다. 테스트와 개발 서버가 같은 핸들러를 쓴다.
- 처리하지 않은 요청은 실패로 만든다: `server.listen({ onUnhandledRequest: 'error' })`
- 화면 전체를 스냅샷으로 고정하지 않는다. 바뀔 때마다 갱신만 하게 되어 아무것도 검증하지 않는다.
- 버그 수정은 그 버그를 재현하는 테스트부터 쓴다.
- 테스트 이름은 한국어로, 사용자 입장의 동작을 쓴다.

## 예시

```tsx
it('뽑기 버튼을 누르면 추천 메뉴를 보여 준다', async () => {
  const user = userEvent.setup()
  render(<App />)

  await user.click(screen.getByRole('button', { name: '뽑기' }))

  expect(await screen.findByRole('heading', { name: /김치찌개/ })).toBeInTheDocument()
})

it('서버 오류면 다시 시도할 수 있게 안내한다', async () => {
  server.use(http.get('/api/menus/pick', () => new HttpResponse(null, { status: 500 })))
  const user = userEvent.setup()
  render(<App />)

  await user.click(screen.getByRole('button', { name: '뽑기' }))

  expect(await screen.findByRole('button', { name: '다시 시도' })).toBeInTheDocument()
})
```

## 화면 상태와 테스트

[structure.md](structure.md) 의 네 가지 화면 상태(로딩, 오류, 빈 결과, 성공)는 서버 데이터를 그리는 화면마다 테스트한다.
오류와 빈 결과는 MSW 핸들러를 테스트 안에서 바꿔(`server.use`) 만든다.
