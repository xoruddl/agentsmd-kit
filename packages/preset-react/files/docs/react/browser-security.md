# 브라우저 보안

브라우저에서 실행되는 코드에만 해당하는 규칙이다.

## 공개 환경변수

- 빌드 도구가 브라우저 코드에 넣는 변수(Vite `VITE_*`, Next.js `NEXT_PUBLIC_*`)는 누구나 볼 수 있다. 비밀키, 토큰, 내부 주소를 넣지 않는다.
- 공개해도 되는 키(지도 JavaScript 키 등)도 발급처에서 도메인 제한을 건다.
- 변수는 `import.meta.env.VITE_API_BASE_URL` 처럼 이름을 그대로 적어 읽는다. 빌드 도구는 이렇게 적힌 접근만 값으로 바꾸므로 `import.meta.env[name]` 처럼 읽지 않는다.
- 빌드 도구가 주는 타입(Vite 는 `any`)을 믿지 않는다. 한 모듈에서 `unknown` 으로 받아 검증해 내보내고, 컴포넌트가 `import.meta.env` 를 직접 읽지 않는다.

```ts
// src/config.ts
function requireUrlEnv(name: string, value: unknown): string {
  if (typeof value !== 'string' || !URL.canParse(value)) {
    throw new Error(`환경변수 ${name} 이 비어 있거나 URL 형식이 아닙니다. .env.example 을 확인하세요`)
  }
  return value
}

export const config = {
  apiBaseUrl: requireUrlEnv('VITE_API_BASE_URL', import.meta.env.VITE_API_BASE_URL),
} as const
```

## 화면에 그리는 값

- `dangerouslySetInnerHTML` 을 쓰지 않는다. 꼭 필요하면 검증된 sanitize 라이브러리를 거치고 그 자리에 이유를 주석으로 적는다. (린트 `react/no-danger` 가 검사한다 → [components.md](components.md))
- 사용자 입력을 `href` 에 넣을 때 `http:`, `https:` 로 시작하는지 확인한다. (`javascript:` 차단)
- 오류 화면에 서버 응답 원문, 토큰, 개인정보를 그대로 보여 주지 않는다.

## 인증 정보

- 인증 토큰은 가능하면 `httpOnly` 쿠키로 받는다. 스크립트가 읽을 수 없어 XSS 로 빼낼 수 없다.
- `localStorage`·`sessionStorage` 에 토큰을 둬야 하면 이유를 프로젝트의 결정 기록에 남긴다.
