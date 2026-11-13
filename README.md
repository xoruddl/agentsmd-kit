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
# 프리셋으로 지침 파일을 설치한다. 필요한 프리셋을 쉼표로 잇는다 (아래 '프리셋' 참고)
npx @agentsmd/cli init --preset git,github,typescript

# 문서 지도가 저장소와 맞는지 검사한다 (문제가 있으면 종료 코드 1)
npx @agentsmd/cli check
```

전역으로 설치하면 `agentsmd init`, `agentsmd check` 처럼 짧게 씁니다: `npm install -g @agentsmd/cli`

### 프리셋

Git 규칙, 호스팅(GitHub), 언어 규칙, 프레임워크(React·Spring) 규칙은 따로 고릅니다. 필요한 것만 쉼표로 이으면 됩니다.

| 프리셋       | 이럴 때                                            | 설치되는 것                                                                                                 |
| ------------ | -------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| `git`        | 커밋·PR 규칙과 Git 훅을 쓸 때. 호스팅·CI와 무관    | 작업 흐름·Git 규칙·리뷰 기준·문체 문서, 커밋 메시지 훅, PR 규칙 검사 스크립트(`check-pr`), Claude Code 설정 |
| `github`     | GitHub에서 이슈·PR을 관리할 때. `git`과 함께       | 이슈·PR 템플릿, GitHub 사용법 문서(gh 명령, 머지 방식·룰셋, CI 연결 예시)                                   |
| `typescript` | TypeScript 프로젝트 (프론트엔드·백엔드·라이브러리) | 타입·구조·테스트·보안·린트 규칙 문서, 검증 명령, `.nvmrc`                                                   |
| `react`      | React 프론트엔드. `typescript`와 함께              | 컴포넌트·접근성·화면 테스트·브라우저 보안 문서, React 린트 규칙                                             |
| `java`       | Java·Gradle 프로젝트                               | 코드 스타일·클린 코드·체크리스트·테스트 문서, Spotless 설정, 검증 명령                                      |
| `spring`     | Spring Boot 서버. `java`와 함께                    | 패키지 구조·JPA·트랜잭션·API·테스트 문서                                                                    |

문서는 프리셋마다 `docs/<프리셋 이름>/` 폴더에 설치됩니다. `docs/` 바로 아래는 프로젝트 고유 문서를 두는 자리로 남습니다.

```text
docs/
  git/         workflow.md, git-conventions.md, code-review.md, writing-style.md
  github/      usage.md
  typescript/  project-direction.md, rules.md, structure.md, testing.md, env-and-security.md, lint-and-ci.md
  react/       components.md, testing.md, browser-security.md
  java/        project-direction.md, code-style.md, clean-code.md, clean-code-examples.md, checklist.md,
               testing.md, logging-and-security.md, lint-and-ci.md
  spring/      architecture.md, data-jpa.md, api.md, testing.md
```

| 저장소                    | 명령                                        |
| ------------------------- | ------------------------------------------- |
| GitHub + TypeScript       | `init --preset git,github,typescript`       |
| GitHub + React 프론트엔드 | `init --preset git,github,typescript,react` |
| GitLab·사내 Git + Java    | `init --preset git,java`                    |
| GitHub + Spring Boot      | `init --preset git,github,java,spring`      |
| 언어 규칙만               | `init --preset typescript`                  |
| Git 규칙만                | `init --preset git`                         |

어느 조합이든 아래는 같습니다.

- `AGENTS.md`(문서 지도·핵심 규칙·검증 명령)와 이를 불러오는 `CLAUDE.md`를 고른 프리셋에 맞춰 만듭니다.
- 이미 있는 파일은 덮어쓰지 않습니다. `AGENTS.md`가 있으면 빠진 문서·규칙만 더하므로, 프리셋을 나중에 추가해도 됩니다.
- 다른 프리셋이 있어야 하는 프리셋은 그 프리셋을 함께 설치합니다. `github`은 `git`을, `spring`은 `java`를, `react`는 `typescript`를 먼저 설치하고 출력으로 알립니다. 그 프리셋이 저장소에 이미 있으면 다시 설치하지 않습니다.
- CI 설정 파일은 설치하지 않습니다. GitHub Actions, GitLab CI, Jenkins 등 쓰는 CI에서 문서에 적힌 검증 명령과 `.githooks/check-pr`를 부르면 됩니다.

프리셋별 파일 목록은 [docs/commands.md](docs/commands.md)와 각 패키지 README에 있습니다.

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

| 패키지                                                      | 역할                                                                                   |
| ----------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| [`@agentsmd/cli`](packages/cli)                             | CLI(`agentsmd` 명령). 명령 분기, 출력, 종료 코드, Git 훅 연결                          |
| [`@agentsmd/core`](packages/core)                           | 문서 지도 파서, 검사 규칙, 프리셋 설치, 고른 프리셋에 맞춘 AGENTS.md 생성. 언어와 무관 |
| [`@agentsmd/preset-git`](packages/preset-git)               | 언어·호스팅과 무관한 Git 작업 규칙, 커밋 훅, PR 규칙 검사 스크립트                     |
| [`@agentsmd/preset-github`](packages/preset-github)         | GitHub 이슈·PR 템플릿, 저장소 설정·CI 연결 안내                                        |
| [`@agentsmd/preset-java`](packages/preset-java)             | Java·Gradle용 코드 규칙, Spotless(palantir-java-format)·Gradle 검증 명령               |
| [`@agentsmd/preset-spring`](packages/preset-spring)         | Spring Boot 서버용 구조·JPA·트랜잭션·API·테스트 규칙                                   |
| [`@agentsmd/preset-typescript`](packages/preset-typescript) | TypeScript 프로젝트용 타입·구조·테스트·보안 규칙, 린트·CI 명령                         |
| [`@agentsmd/preset-react`](packages/preset-react)           | React 프론트엔드용 컴포넌트·접근성·화면 테스트·브라우저 보안 규칙                      |

## 설치

npm에 배포돼 있어 따로 설치하지 않고 `npx @agentsmd/cli`로 실행할 수 있습니다. Node.js 22 이상이 필요합니다.

CI에서 검사하려면 저장소에 개발 의존성으로 넣고 한 단계를 추가합니다.

```bash
pnpm add -D @agentsmd/cli
```

```yaml
- run: pnpm exec agentsmd check
```

GitHub Actions에서는 설치 없이 이 저장소의 Action을 한 줄로 씁니다. 검사 대상 경로는 `with:`로 바꿀 수 있고, 입력 이름은 `agentsmd check`의 옵션과 같습니다. → [`packages/preset-github/files/docs/github/usage.md`](packages/preset-github/files/docs/github/usage.md)

```yaml
- uses: xoruddl/agentsmd-kit@v0
```

Action이 쓰는 이미지 `ghcr.io/xoruddl/agentsmd`는 GitLab CI·Jenkins 등 Docker가 되는 CI에서 그대로 씁니다. Node가 없어도 됩니다. → [`packages/preset-git/files/docs/git/git-conventions.md`](packages/preset-git/files/docs/git/git-conventions.md)

```sh
docker run --rm -v "$PWD:/repo" ghcr.io/xoruddl/agentsmd:0 check
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
