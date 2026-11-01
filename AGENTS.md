# AGENTS.md

agentsmd-kit 저장소에서 코드를 작성·수정·리뷰하는 AI 에이전트용 지침이다.
이 저장소는 자기 자신을 `agentsmd check`로 검사하므로, 이 파일도 아래 규칙을 지켜야 한다.

## 문서 지도

| 문서                                         | 언제 읽나                                                              |
| -------------------------------------------- | ---------------------------------------------------------------------- |
| [README.md](README.md)                       | 이 도구가 푸는 문제, 사용법, 개발 명령                                 |
| [docs/architecture.md](docs/architecture.md) | 코드를 고치기 전 (필수). 패키지 책임, 의존 방향, 규칙·프리셋 추가 절차 |
| [docs/rules.md](docs/rules.md)               | 검사 규칙을 추가·변경할 때. 동작을 바꾸면 이 문서도 함께 고친다        |
| [docs/commands.md](docs/commands.md)         | 명령 옵션·종료 코드를 바꿀 때. 도움말 문자열과 함께 고친다             |

## 핵심 규칙

- `core`의 규칙은 파일 시스템을 모르는 순수 함수로 둔다. 파일 읽기는 `checkRepository`에서만 한다.
- `core`는 다른 패키지에 의존하지 않는다. `cli`와 프리셋이 `core`에 의존한다.
- 명령은 `process` 대신 `Io`를 쓴다.
- `packages/preset-*/files/`는 사용자 저장소에 설치될 원본이다. 포맷터를 돌리지 않고, 고칠 때는 프리셋 테스트로 `check` 통과를 확인한다.
- 동작을 바꾸면 테스트를 함께 쓴다. 버그 수정은 재현 테스트부터 쓴다.
- `any`와 `as` 단언으로 타입 오류를 덮지 않는다.

## 검증

작업을 마치기 전에 아래를 실행하고 결과를 그대로 보고한다. CI도 같은 순서로 검사한다.

```bash
pnpm build && pnpm format:check && pnpm lint && pnpm typecheck && pnpm test
node packages/cli/dist/main.js check
```
