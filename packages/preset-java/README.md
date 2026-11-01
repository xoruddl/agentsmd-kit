# @agentsmd/preset-java

[`@agentsmd/cli`](https://www.npmjs.com/package/@agentsmd/cli)의 Java·Gradle 프리셋입니다.

```bash
npx @agentsmd/cli init --preset git,java   # Git 작업 규칙과 함께
npx @agentsmd/cli init --preset java       # Java 규칙만
```

- Java 코드 규칙 문서: 코드 스타일, 클린 코드 원칙과 예시, Java 체크리스트
- palantir-java-format(Spotless) 커밋 검사, Gradle CI
- Git 작업 규칙은 [Git 프리셋](https://www.npmjs.com/package/@agentsmd/preset-git)을 함께 고르면 더해집니다. `AGENTS.md`는 고른 프리셋에 맞춰 만들어집니다.
