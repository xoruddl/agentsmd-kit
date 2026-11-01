# 환경변수 · 보안 · 의존성

## 환경변수

- 빌드 도구가 브라우저 코드에 넣는 변수(Vite `VITE_*`, Next.js `NEXT_PUBLIC_*`)는 누구나 볼 수 있다. 비밀키, 토큰, 내부 주소를 넣지 않는다.
- 공개해도 되는 키(지도 JavaScript 키 등)도 발급처에서 도메인 제한을 건다.
- 모든 변수를 `.env.example` 에 이름, 설명, 빈 값으로 적는다. 실제 값은 `.env.local` 에 둔다. (git 제외)
- 변수를 추가·삭제하면 `.env.example` 을 같은 커밋에서 고친다.
- 환경변수는 한 모듈에서 읽고 검증해 내보낸다. 컴포넌트가 `import.meta.env` 를 직접 읽지 않는다.

```ts
// src/config.ts
const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? ''
if (typeof apiBaseUrl !== 'string') {
  throw new Error('VITE_API_BASE_URL 이 문자열이 아닙니다')
}
export const config = { apiBaseUrl } as const
```

## 보안

- `dangerouslySetInnerHTML` 을 쓰지 않는다. 꼭 필요하면 검증된 sanitize 라이브러리를 거치고 PR 에 이유를 적는다.
- 사용자 입력으로 URL 을 만들 때 `encodeURIComponent` 로 감싼다.
- 사용자 입력을 `href` 에 넣을 때 `http:`, `https:` 로 시작하는지 확인한다. (`javascript:` 차단)
- 인증 토큰은 가능하면 `httpOnly` 쿠키로 받는다. `localStorage` 에 둬야 하면 이유를 [project-direction.md](project-direction.md) 의 결정 기록에 남긴다.
- 오류 화면과 콘솔에 서버 응답 원문, 토큰, 개인정보를 그대로 출력하지 않는다.

## 의존성

- 새 패키지는 추가하기 전에 사용자에게 묻는다. 브라우저 표준 API나 이미 있는 의존성으로 되는지 먼저 확인한다.
- 실행 중에 필요 없는 패키지(테스트, 린트, 타입)는 `devDependencies` 에 둔다.
- 잠금 파일(`pnpm-lock.yaml`)을 함께 커밋한다. CI 는 `--frozen-lockfile` 로 설치해 잠금 파일과 다르면 실패한다.
