# AGENTS.md

에이전트 작업 지침의 진입점. 작업 전 이 파일을 읽고, 작업 종류에 맞는 문서를 연다.

## 문서 지도

| 문서 | 읽는 시점 |
| --- | --- |
| [docs/project-direction.md](docs/project-direction.md) | 모든 작업 시작 전 (필수). 범위 밖 작업이면 먼저 질문 |
| [docs/workflow.md](docs/workflow.md) | 모든 작업 시작 전 (필수) |
| [docs/git-conventions.md](docs/git-conventions.md) | 이슈·브랜치·커밋·PR·머지 |
| [docs/code-review.md](docs/code-review.md) | PR 리뷰 확인·반영 |
| [docs/typescript.md](docs/typescript.md) | 코드 작성·리뷰 (항상). 컴파일러 옵션, 타입 규칙 |
| [docs/structure.md](docs/structure.md) | 파일·컴포넌트를 만들 때. 폴더, 컴포넌트, 접근성 |
| [docs/testing.md](docs/testing.md) | 테스트를 쓸 때 |
| [docs/env-and-security.md](docs/env-and-security.md) | 환경변수·외부 입력·의존성을 다룰 때 |
| [docs/lint-and-ci.md](docs/lint-and-ci.md) | 스크립트·린트·훅·CI 설정 |
| [docs/writing-style.md](docs/writing-style.md) | md 문서, 커밋·PR 메시지 작성 |

## 핵심 규칙

문서를 다 읽지 못했더라도 아래는 반드시 지킨다.

1. 커밋 하나 = 책임 하나, 파일 5개 이하.
2. 커밋 1개 후 작업을 멈추고 사용자 피드백을 기다린다.
3. `any`, `as` 단언, `!` 로 타입 오류를 덮지 않는다.
4. API 응답·저장소 값·URL 파라미터·환경변수는 들어오는 곳에서 검증한다.
5. 클릭할 수 있는 요소는 `<button>`·`<a>` 로 만든다. 이미지에는 `alt`, 입력에는 `label`.
6. 기능은 테스트와 함께 쓴다. 버그 수정은 재현 테스트부터 쓴다.
7. 새 의존성은 사용자에게 묻고 추가한다.
8. 커밋·PR 메시지는 사람이 쓴 것처럼 짧게 쓴다. AI 서명 금지. 훅 우회(`--no-verify`) 금지.

## 검증

작업을 마치기 전에 실행하고 결과를 그대로 보고한다. 실패를 숨기지 않는다.

```bash
pnpm lint && pnpm format:check && pnpm typecheck && pnpm test && pnpm build
```

## 지침 관리

- 지침 추가·변경 요청은 메모리에 저장하지 않는다. 이 파일이나 `docs/` 에 반영한다.
- 새 문서를 만들면 위 문서 지도에 한 줄 추가한다.
- 문서 수정도 같은 커밋 규칙을 따른다.
- 문서 문체는 [docs/writing-style.md](docs/writing-style.md) 를 따른다.
