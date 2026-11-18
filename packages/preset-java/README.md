# @agentsmd/preset-java

[`@agentsmd/cli`](https://www.npmjs.com/package/@agentsmd/cli)의 Java·Gradle 프리셋입니다.

```bash
npx @agentsmd/cli init --preset git,java   # Git 작업 규칙과 함께
npx @agentsmd/cli init --preset java       # Git 규칙 없이 (프로젝트 방향 문서는 함께 설치된다)
```

- Java 코드 규칙 문서: 코드 스타일, 클린 코드 원칙과 예시, Java 체크리스트, 테스트(JUnit 5·AssertJ·Mockito), 로깅·보안·의존성
- 패키지 크기 검사: ArchUnit 테스트 `src/test/java/PackageSizeTest.java`(패키지당 클래스 15개 상한)와, 패키지가 커질 때 나누는 법을 담은 `docs/java/package-structure.md`. ArchUnit 의존성은 설치 후 직접 추가합니다(문서에 스니펫).
- 코드 작성 규칙 검사: ArchUnit 테스트 `src/test/java/CodingRulesTest.java`(표준 출력, `java.util.logging`, 일반 예외, 인자 없는 `now()`, `Optional` 필드·파라미터, `ObjectInputStream`)와 기준선 설정 `src/test/resources/archunit.properties`. 기존 위반은 기준선(`archunit_store`)에 두고 새 위반만 실패시킵니다.
- palantir-java-format(Spotless) 설정과 Gradle 검증·CI 명령 문서
- Git 훅·GitHub 설정은 설치하지 않습니다. CI 문서에는 특정 서비스와 무관하게 실행할 명령만 적습니다.
- Git 작업 규칙과 훅은 [Git 프리셋](https://www.npmjs.com/package/@agentsmd/preset-git)을 함께 고르면 더해집니다. `AGENTS.md`는 고른 프리셋에 맞춰 만들어집니다.
