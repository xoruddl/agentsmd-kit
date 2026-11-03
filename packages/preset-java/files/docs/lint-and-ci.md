# 린트 · CI

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
| `./gradlew spotlessCheck` | 포맷 검사 (작업 마무리, CI) |

작업을 마치기 전에 `./gradlew spotlessApply` 로 포맷을 맞추고 아래 검증 명령을 실행한다.

## CI

어떤 CI 서비스를 쓰든 아래 명령을 실행한다. 작업을 마치기 전에 돌리는 검증 명령과 같다.

```bash
./gradlew spotlessCheck build
```

- JDK 21 을 쓴다.
- `gradlew` 가 없는 저장소(지침만 있는 저장소)에서는 건너뛴다.
- 버전을 올릴 때는 이 문서의 스니펫과 CI 설정을 같이 고친다.
