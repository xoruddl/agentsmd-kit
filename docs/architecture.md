# 구조

## 패키지와 의존 방향

```text
agentsmd (cli) ──▶ @agentsmd/core
      │                 ▲
      └──▶ @agentsmd/preset-java
```

| 패키지              | 책임                                               | 모르는 것              |
| ------------------- | -------------------------------------------------- | ---------------------- |
| `packages/core`     | 문서 지도 파서, 검사 규칙, 프리셋 설치             | 명령줄, 출력 형식, Git |
| `packages/cli`      | 인자 파싱, 명령 분기, 출력, 종료 코드, Git 훅 연결 | 규칙의 내용            |
| `packages/preset-*` | 설치할 파일과 설치 후 안내                         | 설치 방법              |

`core`는 다른 패키지에 의존하지 않는다. 프리셋은 `core`의 `Preset` 타입만 쓴다.

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
- 링크를 저장소 경로로 푸는 규칙(문서 위치 기준, `/`는 루트 기준, 저장소 밖은 제외)은 `resolve-link.ts` 하나에 둔다.

## cli: 명령은 Io를 통해서만 바깥과 말한다

- 명령은 `process`를 직접 쓰지 않고 `Io`(`cwd`, `stdout`, `stderr`)를 받는다. 테스트는 출력을 모아 확인한다.
- `main.ts`는 `process`와 `run`을 잇는 몇 줄뿐이다.
- `node:util`의 `parseArgs`를 쓰고 외부 의존성을 두지 않는다. 파싱 오류는 `run`이 종료 코드 2로 바꾼다.

## 규칙 추가하기

1. `packages/core/src/types.ts`의 `RuleId`에 이름을 추가한다.
2. `packages/core/src/rules/<이름>.ts`에 순수 함수로 만들고 `test/rules/<이름>.test.ts`를 쓴다.
3. `checkRepository`에서 필요한 값을 읽어 호출한다.
4. [rules.md](rules.md)에 의도, 예시, 고치는 방법을 적고 `cli`의 `check` 도움말에 한 줄 추가한다.

## 프리셋 추가하기

1. `packages/preset-<이름>/files/`에 설치될 경로 그대로 파일을 둔다. Prettier는 이 디렉터리를 건드리지 않는다.
2. `src/index.ts`에서 `Preset` 객체를 내보낸다. 훅이 있으면 `hooksPath`, 수작업이 남으면 `nextSteps`를 채운다.
3. 프리셋 지침이 `checkRepository`를 통과하는지 테스트한다. 설치 직후 저장소가 바로 CI를 통과해야 하기 때문이다.
4. `packages/cli/src/presets.ts`의 `PRESETS`에 추가한다.
