# 훅 · 린트 · CI

## Git 훅

공통 훅(커밋 형식, 파일 수)은 [git-conventions.md](git-conventions.md) 의 자동 검사를 따른다.
Java 프리셋은 포맷 검사 하나를 더한다.

| 파일 | 검사 |
| --- | --- |
| `.githooks/pre-commit.d/spotless` | `gradlew` 가 있고 `.java` 가 스테이징됐으면 `spotlessCheck` |

- 공통 `pre-commit` 훅이 파일 수를 검사한 뒤 이 스크립트를 실행한다.
- 클론한 뒤 훅이 동작하지 않으면 `git config core.hooksPath .githooks` 로 연결한다.
- `--no-verify` 금지.

## 린트 (Spotless + palantir-java-format)

프로젝트에 Gradle 을 붙일 때 `build.gradle.kts` 에 추가한다.

palantir-java-format 은 Google Java Style 을 바탕으로 들여쓰기 4칸, 줄 길이 120 을 쓴다.

```kotlin
plugins {
    java
    id("com.diffplug.spotless") version "8.10.4"
}

spotless {
    java {
        target("src/**/*.java")
        palantirJavaFormat("2.103.0")
        removeUnusedImports()
        trimTrailingWhitespace()
        endWithNewline()
    }
}
```

| 명령 | 용도 |
| --- | --- |
| `./gradlew spotlessApply` | 포맷 적용 |
| `./gradlew spotlessCheck` | 포맷 검사 (훅, CI) |

## CI

[.github/workflows/ci.yml](../.github/workflows/ci.yml)

| job | 실행 | 검사 |
| --- | --- | --- |
| `build` | PR, main push | `spotlessCheck build`. `gradlew` 없으면 건너뜀 |

- 커밋 규칙(파일 수, 메시지 형식)은 CI 에서 검사하지 않는다. 로컬 훅만 검사한다.
- 버전을 올릴 때는 이 문서의 스니펫과 CI 를 같이 고친다.

## 에이전트 설정

[.claude/settings.json](../.claude/settings.json)

- 커밋·PR 의 AI 서명(Co-Authored-By 등) 비활성화
- 훅 우회, force push, main 직접 push 명령 차단
