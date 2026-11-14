# @agentsmd/preset-java

[`@agentsmd/cli`](https://www.npmjs.com/package/@agentsmd/cli)의 Java·Gradle 프리셋입니다.

```bash
npx @agentsmd/cli init --preset git,java   # Git 작업 규칙과 함께
npx @agentsmd/cli init --preset java       # Git 규칙 없이 (프로젝트 방향 문서는 함께 설치된다)
```

- Java 코드 규칙 문서: 코드 스타일, 클린 코드 원칙과 예시, Java 체크리스트, 테스트(JUnit 5·AssertJ·Mockito), 로깅·보안·의존성
- palantir-java-format(Spotless) 설정과 Gradle 검증·CI 명령 문서
- Git 훅·GitHub 설정은 설치하지 않습니다. CI 문서에는 특정 서비스와 무관하게 실행할 명령만 적습니다.
- Git 작업 규칙과 훅은 [Git 프리셋](https://www.npmjs.com/package/@agentsmd/preset-git)을 함께 고르면 더해집니다. `AGENTS.md`는 고른 프리셋에 맞춰 만들어집니다.
