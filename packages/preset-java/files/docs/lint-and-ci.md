# 린트 · CI

## 린트 (Spotless + palantir-java-format)

프로젝트에 Gradle 을 붙일 때 `build.gradle.kts` 에 추가한다.

palantir-java-format 은 Google Java Style 을 바탕으로 들여쓰기 4칸, 줄 길이 120 을 쓴다.

```kotlin
plugins {
    java
    id("com.diffplug.spotless") version "8.10.4"
}

java {
    toolchain {
        // 로컬에 설치된 JDK 와 상관없이 같은 버전으로 컴파일·테스트한다.
        languageVersion = JavaLanguageVersion.of(21)
    }
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

- Spotless 플러그인을 적용하면 `spotlessCheck` 이 `check` 에 연결되어, 포맷이 틀리면 `./gradlew build` 도 실패한다.
- JDK 버전은 위 toolchain 으로 고정한다. 버전을 바꾸면 toolchain 과 CI 의 JDK 를 함께 고친다.

## IntelliJ

IDE 포맷터는 편의용이다. 최종 판정은 `spotlessCheck` 이다.

1. Settings > Plugins > Marketplace 에서 `palantir-java-format` 을 설치하고 IDE 를 재시작한다.
2. Settings > Other Settings > palantir-java-format Settings 에서 Enable 을 체크한다. (프로젝트마다 한 번씩 켠다)
3. Settings > Build, Execution, Deployment > Build Tools > Gradle 의 Gradle JVM 을 toolchain 과 같은 버전으로 맞춘다.

## CI

어떤 CI 서비스를 쓰든 아래 명령을 실행한다. 작업을 마치기 전에 돌리는 검증 명령과 같다.

```bash
./gradlew spotlessCheck build
```

- CI 의 JDK 는 toolchain 과 같은 21 을 쓴다.
- `gradlew` 가 없는 저장소(지침만 있는 저장소)에서는 건너뛴다.
- 버전을 올릴 때는 이 문서의 스니펫과 CI 설정을 같이 고친다.
