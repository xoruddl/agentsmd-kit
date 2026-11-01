# agentsmd-kit

AI 코딩 에이전트용 작업 지침(`AGENTS.md`)을 설치하고, 지침이 저장소와 어긋나지 않았는지 검사하는 CLI입니다.

## 왜 만들었나

에이전트에게 작업 규칙을 알려 주려고 저장소마다 `AGENTS.md`를 두고, 세부 규칙은 `docs/`로 나눠 "어떤 문서를 언제 읽을지" 안내하는 문서 지도로 씁니다.
이 방식은 문서가 바뀔 때 쉽게 깨집니다.

- 문서를 옮기거나 지웠는데 지도를 고치지 않으면, 에이전트는 없는 문서를 찾다가 **추측으로 작업**합니다.
- 새 문서를 만들고 지도에 올리지 않으면, 에이전트는 그 문서를 읽을 이유가 없어 **규칙이 없는 것과 같습니다**.
- `CLAUDE.md`가 `AGENTS.md`를 불러오지 않으면, **Claude Code만 지침을 읽지 못하거나** 두 파일의 지침이 따로 자랍니다.

사람이 리뷰로 잡기 어려운 문제라서, 문서로 정한 규칙을 기계가 검사하게 만들었습니다.
또 지침 템플릿을 저장소에 복사하고 Git 훅을 손으로 연결하던 작업을 명령 하나로 줄였습니다.

## 사용법

```bash
# 프리셋으로 지침 파일을 설치하고 Git 훅을 연결한다 (공통 Git 규칙이 함께 설치된다)
npx @agentsmd/cli init --preset typescript   # 또는 --preset java

# 문서 지도가 저장소와 맞는지 검사한다 (문제가 있으면 종료 코드 1)
npx @agentsmd/cli check
```

전역으로 설치하면 `agentsmd init`, `agentsmd check` 처럼 짧게 씁니다: `npm install -g @agentsmd/cli`

```text
$ agentsmd check
AGENTS.md:12  [broken-link]  링크 대상이 없습니다: docs/api.md
CLAUDE.md  [claude-import]  @AGENTS.md 로 문서 지도를 불러오지 않습니다
docs/requirements.md  [unlisted-doc]  문서 지도(AGENTS.md)에서 안내하지 않는 문서입니다

문제 3건
```

`파일:줄` 형식이라 편집기와 터미널에서 바로 그 위치로 이동할 수 있습니다.
CI에 `agentsmd check` 한 단계를 넣으면 지도와 어긋난 변경은 머지 전에 실패합니다.

| 문서                                         | 내용                                      |
| -------------------------------------------- | ----------------------------------------- |
| [docs/commands.md](docs/commands.md)         | `init`, `check`의 옵션과 종료 코드        |
| [docs/rules.md](docs/rules.md)               | 검사 규칙별 의도, 예시, 고치는 방법       |
| [docs/architecture.md](docs/architecture.md) | 패키지 구조와 규칙·프리셋을 추가하는 방법 |

## 실제 저장소에 적용한 결과

팀 프로젝트와 개인 프로젝트의 저장소 10곳에 `agentsmd check`를 돌렸습니다.
팀 프로젝트의 GitOps 저장소에서 `docs/`에 있지만 문서 지도에는 없는 문서 2개를 찾았습니다.
나머지 9곳은 문제가 없었습니다.

## 패키지

| 패키지                                                      | 역할                                                                                           |
| ----------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| [`@agentsmd/cli`](packages/cli)                             | CLI(`agentsmd` 명령). 명령 분기, 출력, 종료 코드, Git 훅 연결                                  |
| [`@agentsmd/core`](packages/core)                           | 문서 지도 파서, 검사 규칙, 프리셋 설치. 언어와 무관                                            |
| [`@agentsmd/preset-git`](packages/preset-git)               | 언어와 무관한 Git 작업 규칙, 커밋 훅, Conventions 검사, 이슈·PR 템플릿. 언어 프리셋이 요구한다 |
| [`@agentsmd/preset-java`](packages/preset-java)             | Java·Gradle용 코드 규칙, Spotless(palantir-java-format) 검사, Gradle CI                        |
| [`@agentsmd/preset-typescript`](packages/preset-typescript) | TypeScript·React 프론트엔드용 타입·구조·테스트·보안 규칙, Prettier 검사, pnpm CI               |

## 설치

npm에 배포돼 있어 따로 설치하지 않고 `npx @agentsmd/cli`로 실행할 수 있습니다. Node.js 22 이상이 필요합니다.

CI에서 검사하려면 저장소에 개발 의존성으로 넣고 한 단계를 추가합니다.

```bash
pnpm add -D @agentsmd/cli
```

```yaml
- run: pnpm exec agentsmd check
```

## 개발

```bash
pnpm build          # 패키지 빌드 (다른 패키지가 dist의 타입을 참조하므로 먼저 실행)
pnpm lint           # ESLint (typescript-eslint strictTypeChecked)
pnpm typecheck      # tsc
pnpm test           # vitest
pnpm format:check   # Prettier
```

CI는 Node.js 22와 24에서 위 검사를 모두 돌리고, 마지막에 이 도구로 이 저장소의 `AGENTS.md`를 검사합니다.
