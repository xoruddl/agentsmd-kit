# @agentsmd/preset-spring

[`@agentsmd/cli`](https://www.npmjs.com/package/@agentsmd/cli)의 Spring Boot 서버 프리셋입니다. Spring Boot 4(Spring Framework 7) 기준입니다.

```bash
npx @agentsmd/cli init --preset git,java,spring   # Git·Java 규칙과 함께 (권장)
npx @agentsmd/cli init --preset java,spring       # Java 규칙과 함께
```

- 구조·설정: 기능 단위 패키지, 레이어 의존 방향, 생성자 주입, DTO 경계, `@ConfigurationProperties`, JSpecify
- JPA·트랜잭션: 엔티티 규칙, 지연 로딩과 N+1, `@Transactional`·`readOnly`, open-in-view, Flyway 마이그레이션
- API: URL·상태 코드, Bean Validation, `ProblemDetail` 오류 응답, 페이징
- 테스트: `@WebMvcTest`·`MockMvcTester`, `@DataJpaTest`, `@MockitoBean`, Testcontainers `@ServiceConnection`
- Java 코드 규칙, 검증 명령, 포맷 설정은 넣지 않습니다. [Java 프리셋](https://www.npmjs.com/package/@agentsmd/preset-java)을 함께 고르면 더해집니다.
- Git 훅·GitHub 설정은 설치하지 않습니다. `AGENTS.md`는 고른 프리셋에 맞춰 만들어집니다.
