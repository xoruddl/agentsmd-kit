# Spring 테스트

Spring Boot 4 기준이다. 테스트 원칙(given/when/then, AssertJ, 재현 테스트)은 Java 프리셋 문서를 따른다.
이 문서는 Spring 이 필요한 테스트를 어떻게 띄우는지 정한다.

## 테스트 종류

Spring 컨텍스트를 띄우는 테스트는 느리다. 가능한 한 아래 표의 위쪽 방법을 쓴다.

| 대상 | 방법 |
| --- | --- |
| 도메인 객체, 서비스 | Spring 없이 단위 테스트. 서비스의 Repository·외부 연동은 Mockito 로 대체 |
| 컨트롤러 (요청·검증·응답 형식) | `@WebMvcTest(OrderController.class)` 와 `MockMvcTester`. 서비스는 `@MockitoBean` |
| Repository, 쿼리 | `@DataJpaTest` 와 Testcontainers 로 띄운 운영과 같은 DB |
| 여러 레이어를 잇는 흐름 | `@SpringBootTest`. 핵심 시나리오에만 쓴다 |

## 규칙

- `@MockBean`·`@SpyBean` 은 Spring Boot 4 에서 제거됐다. `@MockitoBean`·`@MockitoSpyBean` 을 쓴다.
- 기술별 테스트 starter(`spring-boot-starter-webmvc-test`, `spring-boot-starter-data-jpa-test` 등)를 `testImplementation` 으로 둔다.
- `@SpringBootTest` 에서 MockMvc 를 쓰려면 `@AutoConfigureMockMvc` 를 붙인다.
- DB 는 H2 같은 다른 DB 로 대신하지 않는다. 방언·제약·함수가 달라 운영에서만 실패하는 쿼리를 놓친다.
- Testcontainers 컨테이너는 `@ServiceConnection` 을 붙인 `@TestConfiguration` 빈으로 두고 테스트에서 `@Import` 한다.
  같은 설정의 테스트끼리 컨텍스트 캐시를 함께 써서 컨테이너를 한 번만 띄운다.
- `@DataJpaTest` 는 `@ServiceConnection` 으로 띄운 DB 를 내장 DB 로 바꾸지 않는다. (`@AutoConfigureTestDatabase` 기본값 `NON_TEST`)
- 테스트마다 `@MockitoBean` 조합이나 설정이 다르면 컨텍스트를 새로 띄운다. 공통 조합은 기반 클래스나 설정으로 모은다.
- 의존 방향 규칙은 ArchUnit 테스트로 검사할 수 있다. → [architecture.md](architecture.md)

## 예시

```java
@TestConfiguration(proxyBeanMethods = false)
public class TestcontainersConfiguration {

    @Bean
    @ServiceConnection
    MySQLContainer mysqlContainer() {
        return new MySQLContainer(DockerImageName.parse("mysql:8.4"));
    }
}

@DataJpaTest
@Import(TestcontainersConfiguration.class)
class OrderRepositoryTest {

    @Autowired
    private OrderRepository orderRepository;

    @Test
    @DisplayName("회원의 결제 완료 주문만 최신순으로 조회한다")
    void findPaidOrders() { ... }
}

@WebMvcTest(OrderController.class)
class OrderControllerTest {

    @Autowired
    private MockMvcTester mvc;

    @MockitoBean
    private OrderService orderService;

    @Test
    @DisplayName("수량이 0 이면 400 을 돌려준다")
    void rejectsZeroQuantity() {
        assertThat(mvc.post().uri("/orders").contentType(MediaType.APPLICATION_JSON).content("""
                        {"productId": 1, "quantity": 0}
                        """))
                .hasStatus(HttpStatus.BAD_REQUEST);
    }
}
```
