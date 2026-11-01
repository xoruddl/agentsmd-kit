# agentsmd

AI 코딩 에이전트용 작업 지침(`AGENTS.md`)을 설치하고, 지침이 저장소와 어긋나지 않았는지 검사하는 CLI입니다.

```bash
# 지침 파일을 설치하고 Git 훅을 연결한다 (공통 Git 규칙이 함께 설치된다)
npx agentsmd init --preset typescript   # 또는 --preset java

# 문서 지도가 저장소와 맞는지 검사한다 (문제가 있으면 종료 코드 1)
npx agentsmd check
```

## 왜 필요한가

`AGENTS.md`를 "어떤 문서를 언제 읽을지" 안내하는 문서 지도로 쓰면, 문서가 바뀔 때 쉽게 깨집니다.

- 옮기거나 지운 문서를 지도가 계속 가리키면 에이전트는 **추측으로 작업**합니다.
- 새 문서를 지도에 올리지 않으면 에이전트는 그 문서를 읽지 않아 **규칙이 없는 것과 같습니다**.
- `CLAUDE.md`가 `AGENTS.md`를 불러오지 않으면 **Claude Code만 지침을 읽지 못합니다**.

`agentsmd check`는 이 세 가지를 `파일:줄` 형식으로 알려 주고, CI에 넣으면 머지 전에 막습니다.

```text
$ npx agentsmd check
AGENTS.md:12  [broken-link]  링크 대상이 없습니다: docs/api.md
CLAUDE.md  [claude-import]  @AGENTS.md 로 문서 지도를 불러오지 않습니다
docs/requirements.md  [unlisted-doc]  문서 지도(AGENTS.md)에서 안내하지 않는 문서입니다

문제 3건
```

## 프리셋

| 프리셋       | 내용                                                                                                            |
| ------------ | --------------------------------------------------------------------------------------------------------------- |
| `typescript` | TypeScript·React 프론트엔드: 필수 tsconfig 옵션, 타입·구조·접근성·테스트·보안 규칙, Prettier 커밋 검사, pnpm CI |
| `java`       | Java·Gradle: 코드 규칙, palantir-java-format(Spotless) 커밋 검사, Gradle CI                                     |

어느 프리셋이든 공통 Git 규칙(이슈 → 브랜치 → PR → merge 커밋, 커밋 형식·파일 수 훅, PR 규칙 검사, 이슈·PR 템플릿)이 함께 설치됩니다.
이미 있는 파일은 덮어쓰지 않습니다.

## 종료 코드

| 코드 | 의미                               |
| ---- | ---------------------------------- |
| `0`  | 문제 없음                          |
| `1`  | 규칙 위반이 있음                   |
| `2`  | 옵션이 잘못됐거나 문서 지도가 없음 |

명령 옵션, 규칙 설명, 구조는 [저장소](https://github.com/xoruddl/agentsmd-kit)를 참고하세요. Node.js 22 이상이 필요합니다.
