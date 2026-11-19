# Spring 구조 · 설정

Spring Boot 4(Spring Framework 7) 기준이다. Java 코드 규칙과 검증 명령은 Java 프리셋 문서를 따른다.
이미 다른 구조를 쓰는 프로젝트는 기존 구조를 따르고, 새로 만드는 부분만 이 문서에 맞춘다.

## 패키지

기능(도메인) 단위로 먼저 나누고, 그 안을 레이어로 나눈다.

```text
com.example.app/
  order/            기능 하나
    controller/     HTTP 요청·응답
    dto/            요청·응답 DTO
    service/        유스케이스, 트랜잭션 경계
      listener/     이벤트 리스너 (역할 하위 패키지)
    repository/     Spring Data 인터페이스
    domain/         엔티티, 값 객체, 도메인 규칙
      event/        도메인 이벤트 (역할 하위 패키지)
    exception/      이 기능의 예외
  member/
  alert/            API 가 없는 기능. 쓰는 레이어만 둔다
    service/
  global/           설정, 전역 예외 처리, 보안 같은 기술 기반
    response/       공통 응답 ApiResponse, 결과 코드 인터페이스
    exception/      BusinessException, 공통 오류 코드, 전역 예외 처리
```

- 최상위는 기능(도메인)으로 나눈다. 새 도메인 개념이 생기면 클래스가 몇 개 안 돼도 새 기능 패키지를 만든다.
- 기능 안은 레이어(`controller`, `service`, `repository`, `domain`, `dto`, `exception`)로 나눈다. 쓰지 않는 레이어는 만들지 않는다. (API 가 없는 기능에는 `controller/` 를 두지 않는다)
- 레이어 안에서 역할이 다른 클래스는 파일 수가 적어도 역할 하위 패키지로 나눈다. 예: `domain/event/`, `service/listener/`
- 레이어 안에 기능을 만들지 않는다. 레이어 안에서 새 도메인 명사가 보이면(`order/service/` 의 `Alert*`) 최상위 기능 패키지로 꺼낸다.
- 기능 경계가 애매하면 사람에게 묻는다.
- `global` 에는 비즈니스 규칙을 두지 않는다. 두 기능이 같은 개념을 쓴다고 `global` 로 올리지 않고, 그 개념을 별도 기능으로 둔다.
- 외부 시스템 연동(결제, 메일 등)은 서비스가 쓰는 인터페이스를 `service` 에 두고, 구현은 `global/external/<시스템>` 에 둔다.

## 클래스를 추가할 때

패키지는 커진 뒤에 나누지 않고, 클래스를 추가할 때마다 위치를 정해서 자라게 한다. 위에서부터 답한다.

1. **어느 기능의 개념인가?** 기존 기능에 없는 도메인 명사면 새 기능 패키지를 만든다.
   두 기능이 함께 쓰는 개념(`Money`, `Address` 같은 값 객체 포함)은 어느 한쪽에 두거나 복사하지 않고 별도 기능으로 둔다.
2. **어느 레이어인가?** 아래 이름 규칙의 접미사로 정한다.
3. **같은 목적의 클래스가 있는가?** 있으면 함께 두고, 없으면 레이어 안에 목적 이름의 하위 패키지를 만든다.
   기존 클래스도 함께 옮겨야 하면 파일 이동만 하는 별도 커밋으로 옮긴다. → Java 프리셋 `docs/java/package-structure.md` 의 "재구성 작업 방식"
4. **새 의존이 기존 기능 의존의 역방향인가?** 그러면 순환이다. 아래 "순환을 끊는 순서" 를 따른다.

| 이름 | 위치 |
| --- | --- |
| `XxxController` | `controller/` |
| `XxxRequest`, `XxxResponse`, `XxxSuccessCode` | `dto/` |
| `XxxService` | `service/` |
| `XxxListener`, `XxxScheduler` | `service/listener/`, `service/scheduler/` |
| 기능 전용 `@Configuration`·`@ConfigurationProperties` (`XxxConfig`, `XxxProperties`) | `service/config/`. 여러 기능이 쓰는 기술 설정은 `global/config/` |
| `XxxRepository` | `repository/` |
| 엔티티, 값 객체, `XxxPolicy` | `domain/` |
| 도메인 이벤트. 일어난 일을 과거형으로 짓는다 (`OrderPlaced`) | `domain/event/` |
| `XxxException`, `XxxErrorCode` | `exception/` |

이름 규칙에 없는 역할은 접미사를 정하고 같은 방식으로 하위 패키지를 만든다. 하위 패키지 이름은 목적(`event`, `listener`, `policy`)으로 짓고, `util`·`common`·`etc` 처럼 목적이 없는 이름은 쓰지 않는다.

## 의존 방향

```text
controller → service → repository
                │          │
                └──▶ domain ◀┘
```

- `domain` 은 다른 레이어를 모른다. Spring 에 의존하지 않는다. (JPA 매핑 어노테이션만 예외)
- `global` 은 기능 패키지에 의존하지 않는다.
- 기능 사이에 즉시 결과가 필요 없는 일은 도메인 이벤트(`ApplicationEventPublisher`, `@TransactionalEventListener`)로 나눈다.
- 기능끼리 순환하지 않는다. 순환이 생기면 아래 순서로 끊는다. 순환을 피하려고 기능을 한 패키지로 합치지 않는다.
- 의존 방향, 클래스 위치, 기능 간 순환은 설치된 `src/test/java/LayerArchitectureTest.java` 가 검사한다. 패키지 크기는 Java 프리셋의 `PackageSizeTest` 가 검사한다.
  설치한 뒤 `LayerArchitectureTest` 의 `FEATURES_PACKAGE`, `GLOBAL_PACKAGE` 를 프로젝트 패키지로 바꾼다. → [testing.md](testing.md)
- 순환 허용 목록(`LayerArchitectureTest` 의 `ignoreDependency`), 큰 패키지 상한(`PackageSizeTest` 의 `KNOWN_LARGE_PACKAGES`), ArchUnit 기준선(`archunit_store`)은 늘리거나 고치지 않는다.
  넘으면 패키지를 나누고, 순환은 아래 순서로 끊는다.

### 순환을 끊는 순서

1. **의존 방향을 한쪽으로 정리한다.** 상위 개념이 하위 개념을 부르고 반대로는 부르지 않는다.
   예: 주문은 상품·회원을 부르고, 상품·회원은 주문을 모른다. 하위 기능에 필요한 값은 상위 기능이 인자로 넘긴다.
2. **두 기능이 함께 쓰는 개념을 별도 기능으로 꺼낸다.** 두 기능이 그 기능만 바라보게 해서 서로를 모르게 한다.
3. **즉시 결과가 필요 없는 일만 도메인 이벤트로 끊는다.** 결과를 돌려받으려고 이벤트를 주고받지 않는다.

어느 방법도 맞지 않으면 기능 경계가 잘못 나뉜 신호다. 혼자 정하지 않고 사람에게 묻는다.

## 빈과 주입

- 생성자로 주입한다. 필드 주입(`@Autowired` 필드)을 쓰지 않는다. 생성자가 하나면 `@Autowired` 를 붙이지 않는다.
- 주입받는 필드는 `private final` 이다. Lombok 을 쓰면 `@RequiredArgsConstructor` 로 생성자를 만든다.
- 구현이 하나뿐인 서비스에 인터페이스를 만들지 않는다. (`XxxServiceImpl` 금지)
- 현재 시각은 `Clock` 빈을 주입받아 쓴다. 테스트에서 시각을 고정할 수 있다.

## DTO 경계

- 컨트롤러는 엔티티를 요청으로 받거나 응답으로 돌려주지 않는다. 지연 로딩 예외, 순환 참조, 내부 필드 노출이 생긴다.
- 요청·응답 DTO 는 `record` 로 만든다.
- 응답 DTO 는 컨트롤러에서 공통 응답 `ApiResponse` 의 `data` 에 담는다. 응답 DTO 가 `ApiResponse` 를 상속하거나 `success`·`code` 필드를 직접 갖지 않는다. → [api.md](api.md)
- 엔티티 → 응답 변환은 DTO 의 정적 팩토리(`OrderResponse.from(order)`)에 둔다. 엔티티가 DTO 를 모르게 한다.

```java
public record OrderResponse(Long id, String status, int totalPrice) {

    public static OrderResponse from(Order order) {
        return new OrderResponse(order.getId(), order.getStatus().name(), order.totalPrice());
    }
}
```

## 설정

- 설정 값은 `@ConfigurationProperties` 와 `record` 로 묶어 받는다. `@Value` 를 여러 클래스에 흩어 두지 않는다.
- `@Validated` 와 Bean Validation 으로 애플리케이션 시작 시점에 검증한다. 값이 틀리면 뜨지 않는다.
- 비밀값은 설정 파일에 적지 않고 `${DB_PASSWORD}` 처럼 환경변수를 참조한다.
- 환경별 설정은 `application-<profile>.yml` 로 나누고, 운영 값은 환경변수로 덮어쓴다.

```java
@Validated
@ConfigurationProperties(prefix = "payment")
public record PaymentProperties(@NotBlank String baseUrl, @NotNull Duration timeout) {}
```

- 애플리케이션 클래스에 `@ConfigurationPropertiesScan` 을 붙여 등록한다.

## null

- Spring Boot 4 는 JSpecify 로 null 가능성을 표시한다. null 이 될 수 있는 반환값·파라미터에는 `org.jspecify.annotations.Nullable` 을 붙인다.
- Spring 의 `org.springframework.lang.Nullable` 은 새로 쓰지 않는다.
