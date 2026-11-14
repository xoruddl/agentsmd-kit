# 구조

## 패키지와 의존 방향

```text
agentsmd (cli) ──▶ @agentsmd/core ◀── 모든 프리셋 (Preset 타입)
      │
      ├──▶ @agentsmd/preset-git
      ├──▶ @agentsmd/preset-github
      ├──▶ @agentsmd/preset-project
      ├──▶ @agentsmd/preset-java
      ├──▶ @agentsmd/preset-spring-java
      ├──▶ @agentsmd/preset-typescript
      └──▶ @agentsmd/preset-react
```

| 패키지                         | 책임                                                        | 모르는 것                             |
| ------------------------------ | ----------------------------------------------------------- | ------------------------------------- |
| `packages/core`                | 문서 지도 파서, 검사 규칙, 프리셋 설치, AGENTS.md 생성      | 명령줄, 출력 형식, Git                |
| `packages/cli`                 | 인자 파싱, 명령 분기, 출력, 종료 코드, Git 훅 연결          | 규칙의 내용                           |
| `packages/preset-git`          | 언어와 무관한 Git 작업 규칙, 커밋 훅, PR 규칙 검사 스크립트 | 언어, 호스팅, CI 서비스               |
| `packages/preset-github`       | 이슈·PR 템플릿, GitHub 설정·CI 연결 안내                    | 언어, CI 서비스                       |
| `packages/preset-project`      | 사람이 채우는 프로젝트 방향 문서 (목표·범위·기술 스택)      | 언어, Git·GitHub                      |
| `packages/preset-<언어>`       | 언어 규칙 문서, 검증·CI 명령 문서                           | 설치 방법, Git·GitHub                 |
| `packages/preset-<프레임워크>` | 프레임워크 규칙 문서 (예: `react`, `spring-java`)           | 언어 공통 규칙, 검증 명령, Git·GitHub |

`core`는 다른 패키지에 의존하지 않는다. 프리셋은 `core`의 `Preset` 타입만 쓰고, 프리셋 패키지끼리는 서로 의존하지 않는다.

## core: 규칙은 순수 함수, 파일 읽기는 한 곳

```text
check.ts ── 파일 읽기 ──▶ parse-doc-map.ts ──▶ DocMap
   │                                            │
   └──▶ rules/broken-link.ts   (DocMap, exists)  ┘
   └──▶ rules/unlisted-doc.ts  (DocMap[], 문서 목록)
   └──▶ rules/claude-import.ts (CLAUDE.md 내용)
```

- 규칙은 파일 시스템을 모른다. 필요한 값(파일 존재 여부 함수, 문서 목록, 파일 내용)을 인자로 받는다.
  그래서 규칙 테스트에는 임시 파일이 필요 없다.
- 파일을 읽는 일은 `check.ts`의 `checkRepository`만 한다. 통합 테스트는 이 함수를 임시 디렉터리로 검사한다.
- `broken-link`는 문서 지도와 문서 디렉터리의 문서마다 `DocMap`을 만들어 한 번씩 부른다. `unlisted-doc`은 지도의 `DocMap`만 받는다.
- 링크를 저장소 경로로 푸는 규칙(문서 위치 기준, `/`는 루트 기준, 저장소 밖은 제외)은 `resolve-link.ts` 하나에 둔다.

## 프리셋: 따로 고르고, 공통 파일은 조합에 맞게 만든다

Git 규칙, 호스팅(GitHub), 언어 규칙, 프레임워크 규칙은 따로 나눈 프리셋이다. 사용자가 `--preset git,github,typescript,react`나 `--preset git,github,java,spring-java`처럼 함께 고르면 모두 설치된다.
호스팅 프리셋은 Git 프리셋을, 프레임워크 프리셋은 언어 프리셋을 필요로 한다. 필요한 프리셋은 고르지 않아도 함께 설치된다(아래 `requires`).

- 언어 프리셋은 그 언어를 쓰는 모든 프로젝트에 맞는 규칙만 둔다. 특정 프레임워크에만 맞는 규칙은 프레임워크 프리셋으로 나눈다.
- 프레임워크 프리셋은 검증 명령과 런타임 버전 파일을 두지 않고 언어 프리셋에 맡긴다.
- 프레임워크를 여러 언어로 쓸 수 있고 문서가 한 언어의 문법을 전제하면 이름에 언어를 적는다. `spring-java`의 예제와 규칙은 `record`, `private final`, Lombok을 쓰므로 Kotlin 프로젝트에 맞지 않는다.
  Kotlin은 아직 지원하지 않는다. `react`는 `typescript` 없이 쓰는 경우를 다루지 않으므로 언어를 적지 않는다.

- 프리셋은 AGENTS.md를 파일로 갖지 않는다. 대신 `docs`(문서와 읽는 시점), `rules`(핵심 규칙), `verify`(검증 명령)를 정의한다.
  `mergeAgentsMd`가 기존 AGENTS.md에 정의 가운데 빠진 항목만 넣는다. 지도를 파일로 두면 함께 설치할 때 한쪽이 건너뛰어져 다른 프리셋 문서가 지도에서 빠지기 때문이다.
  새로 만들 때(`renderAgentsMd`)도 빈 뼈대에 같은 함수로 합친다. 새로 만들 때와 나눠 설치할 때 결과 모양이 갈라지지 않게 하려는 것이다.
  기존 AGENTS.md에 `## 문서 지도` 절이 없으면 사람이 다른 형식으로 쓴 지침으로 보고 바꾸지 않는다. 넣지 못한 항목은 `unplaced`로 돌려주고 `init`이 출력한다.
  절 이름을 비슷한 말로 추측하지 않는 것은, 표의 열 순서까지 저장소마다 달라 엉뚱한 곳에 넣을 수 있기 때문이다.
  절을 찾고 넣는 일은 `markdown-sections.ts`가 맡는다.
- 표는 대상 저장소의 `prettier --check`에 걸리지 않도록 Prettier와 같은 모양으로 정렬한다 (`markdown-table.ts`).
- 프리셋은 Git, 호스팅, 언어 가운데 한 축만 맡는다. Git 훅(`.githooks/`)은 Git 프리셋만, `.github/`는 GitHub 프리셋만 둔다.
  GitHub를 쓰지 않는 저장소에 Git 규칙만, Git 규칙을 원하지 않는 저장소에 언어 규칙만 설치할 수 있게 하기 위해서다.
- 다른 프리셋이 있어야 뜻이 통하는 프리셋은 `requires`에 그 이름을 적는다. `github`은 `git`을(PR 템플릿과 문서가 Git 작업 규칙 문서를 가리킨다),
  `spring-java`는 `java`를, `react`는 `typescript`를(검증 명령을 언어 프리셋에 맡긴다) 필요로 한다.
  언어 프리셋(`java`, `typescript`)은 `project`를 필요로 한다. 프로젝트 방향 문서는 언어와 무관해, 언어 프리셋마다 두면
  두 언어를 함께 쓰는 저장소에 같은 문서가 두 벌 생긴다.
  `cli`의 `resolvePresets`가 빠진 프리셋을 그것을 필요로 하는 프리셋 앞에 더하고, `init`이 더했다고 알린다.
  더한 프리셋은 직접 고른 것과 같이 설치한다. 이미 설치돼 있는지 추측해서 건너뛰지 않는다. 문서 하나가 있다고 설치된 것으로 보면
  빠진 파일을 채우지 못하고, `AGENTS.md`를 새로 쓸 때 지도와 파일이 어긋난다. 빠진 파일은 채우고 있는 파일은 그대로 두는 기존 동작이면 충분하다.
  `--force`의 파일 덮어쓰기만 직접 고른 프리셋으로 한정한다. 사용자가 이름을 적지 않은 프리셋의 다듬은 문서를 덮지 않기 위해서다.
  이름만 적으므로 프리셋 패키지는 여전히 서로를 불러오지 않는다. 반대 방향은 없다. `git`만, `java`만 설치할 수 있다.
- 어느 프리셋도 CI 설정 파일(GitHub Actions 워크플로 등)을 두지 않는다. GitHub를 써도 CI는 Jenkins 등으로 돌릴 수 있기 때문이다.
  CI에서 할 일은 실행할 명령으로 정한다. 언어 프리셋은 `verify` 명령을, Git 프리셋은 `.githooks/check-pr`를 제공하고,
  어느 CI에서 어떻게 부르는지는 문서로 안내한다.
- 프리셋 문서는 다른 프리셋의 문서를 링크하지 않는다. `init`은 필요한 프리셋을 함께 설치하지만, 설치된 파일을 사용자가 지우거나 옮길 수 있다.
- 두 프리셋은 같은 경로의 파일을 두지 않는다. 설치는 이미 있는 파일을 덮어쓰지 않는다.
- 프리셋 문서는 `docs/<프리셋 이름>/` 아래에 둔다(`docs/git/workflow.md`, `docs/java/testing.md`). 폴더가 프리셋을 알려 주므로 파일 이름에 프리셋 이름을 붙이지 않는다.
  `docs/` 바로 아래는 프로젝트가 직접 쓰는 문서의 자리로 비워 둔다. 그래야 프리셋끼리도, 사용자 문서와도 이름이 겹치지 않는다.

## cli: 명령은 Io를 통해서만 바깥과 말한다

- 명령은 `process`를 직접 쓰지 않고 `Io`(`cwd`, `stdout`, `stderr`)를 받는다. 테스트는 출력을 모아 확인한다.
- `main.ts`는 `process`와 `run`을 잇는 몇 줄뿐이다.
- `node:util`의 `parseArgs`를 쓰고 외부 의존성을 두지 않는다. 파싱 오류는 `run`이 종료 코드 2로 바꾼다.

## 규칙 추가하기

1. `packages/core/src/types.ts`의 `RuleId`에 이름을 추가한다.
2. `packages/core/src/rules/<이름>.ts`에 순수 함수로 만들고 `test/rules/<이름>.test.ts`를 쓴다.
3. `checkRepository`에서 필요한 값을 읽어 호출한다.
4. [rules.md](rules.md)에 의도, 예시, 고치는 방법을 적고 `cli`의 `check` 도움말에 한 줄 추가한다.

## 언어 프리셋 추가하기

1. `packages/preset-<이름>/files/`에 설치될 경로 그대로 파일을 둔다. Prettier는 이 디렉터리를 건드리지 않는다.
   - 언어 규칙 문서(`docs/<이름>/`)만 둔다. `AGENTS.md`, `CLAUDE.md`, `.githooks/`, `.github/`는 두지 않는다.
2. `src/index.ts`에서 `Preset` 객체를 내보낸다. `docs`, `rules`, `verify`를 채우고, 수작업이 남으면 `nextSteps`를 채운다.
   `docs/<이름>/` 아래 문서는 모두 `docs`에 올린다. 빠지면 `check`가 지도에 없는 문서로 잡는다.
   - `rules`는 AGENTS.md의 핵심 규칙이 된다. 문서는 에이전트가 필요할 때만 열지만 AGENTS.md는 항상 읽히므로,
     문서를 읽지 않은 작업에도 지켜야 할 규칙만 둔다. 아래를 모두 만족하는 규칙만 넣는다.
     - 모든 작업에 해당한다. 특정 상황에서만 필요한 규칙은 문서에 두고 문서 지도의 "읽는 시점"으로 안내한다.
     - 어기면 비용이 크거나 되돌리기 어렵다.
     - 한 줄만 읽고 판단할 수 있다.
     - 근거 문서가 있고, 그 문서와 같은 뜻이다. AGENTS.md에만 있는 규칙은 문서와 따로 자란다.
   - 프리셋당 5개 이하로 둔다(`cli`의 `presets.test.ts`가 검사한다). 핵심 규칙은 고른 프리셋들의 규칙을 합친 목록이라, 프리셋마다 조금씩 늘면 함께 설치할 때 길어진다.
     더 넣고 싶으면 기존 규칙과 바꾸거나 문서에만 둔다.
   - 여러 프리셋에 같은 규칙이 있으면 문장을 똑같이 맞춘다. 같은 문장은 한 번만 들어간다.
3. 그 프리셋만 설치한 결과(`installPreset` + `installEntryFiles`)가 `checkRepository`를 통과하는지 테스트한다.
   설치 직후 저장소가 바로 CI를 통과해야 하기 때문이다.
4. `packages/cli/src/presets.ts`의 `PRESETS`에 추가하고 `cli`의 `package.json` 의존성에 넣는다.

### 프리셋 문서의 경로를 바꿀 때

설치는 기존 파일을 옮기거나 지우지 않는다. 문서 경로를 바꾸면 이미 설치한 저장소에서는 옛 문서가 남고 새 경로에 같은 문서가 또 생기며,
둘 다 지도에 올라 `check`도 통과한다. 그래서 경로를 바꿀 때는 프리셋의 `moved`에 `{ from: 옛 경로, to: 새 경로 }`를 적는다.
`cli`의 `findLegacyDocs`가 옛 경로에 남은 문서를 찾고 `init`이 새 경로와 함께 알린다. 옮기거나 지우지는 않는다. 사람이 고쳐 쓴 문서일 수 있다.
파일 이름만 보고 찾으므로 직접 쓴 문서일 수 있다. 안내 문구는 지우라고 단정하지 않는다.
`presets.test.ts`가 `to`가 지금 설치하는 문서인지, `from`을 지금 설치하는 프리셋이 없는지, 0.6이 설치하던 문서가 프리셋별로 빠짐없이 적혔는지 확인한다.
