# 환경변수 · 보안 · 의존성

## 환경변수

- 모든 변수를 `.env.example` 에 이름, 설명, 빈 값으로 적는다. 실제 값은 `.env`·`.env.local` 처럼 저장소에 올리지 않는 파일에 둔다.
- 변수를 추가·삭제하면 `.env.example` 도 함께 고친다.
- 환경변수는 한 모듈에서 읽고 검증해 내보낸다. 다른 코드가 `process.env` 를 직접 읽지 않는다.
- 값이 없으면 기본값(`?? ''`)으로 덮지 않고 시작 시 오류를 낸다. 빈 값으로 실행되면 엉뚱한 곳에서 원인 모를 오류가 난다.
- 값은 `unknown` 으로 받아 검증한다. 문자열이라는 타입 선언만 믿지 않는다.
- 브라우저 코드에 들어가는 공개 변수(Vite `VITE_*` 등)는 프레임워크 프리셋 문서를 따른다.

```ts
// src/config.ts
function requireEnv(name: string, value: unknown): string {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error(`환경변수 ${name} 이 비어 있습니다. .env.example 을 확인하세요`)
  }
  return value
}

function requireUrlEnv(name: string, value: unknown): string {
  const url = requireEnv(name, value)
  if (!URL.canParse(url)) {
    throw new Error(`환경변수 ${name} 이 URL 형식이 아닙니다`)
  }
  return url
}

export const config = {
  databaseUrl: requireUrlEnv('DATABASE_URL', process.env.DATABASE_URL),
} as const
```

## 보안

- 비밀키, 토큰, 비밀번호를 코드나 저장소에 두지 않는다. 환경변수나 비밀 관리 도구로 받는다.
- 사용자 입력으로 URL 을 만들 때 `encodeURIComponent` 로 감싼다.
- 사용자 입력으로 SQL·셸 명령 문자열을 이어 붙이지 않는다. 매개변수를 따로 넘기는 API 를 쓴다.
- 오류 메시지와 로그에 외부 응답 원문, 토큰, 개인정보를 그대로 출력하지 않는다.

## 의존성

- 새 패키지는 추가하기 전에 사용자에게 묻는다. 표준 API(Node·브라우저)나 이미 있는 의존성으로 되는지 먼저 확인한다.
- 실행 중에 필요 없는 패키지(테스트, 린트, 타입)는 `devDependencies` 에 둔다.
- 잠금 파일(`pnpm-lock.yaml`)을 저장소에 함께 둔다. CI 는 `--frozen-lockfile` 로 설치해 잠금 파일과 다르면 실패한다.
