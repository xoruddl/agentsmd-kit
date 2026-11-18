# API

Spring MVC 로 REST API 를 만들 때의 규칙이다.

## 컨트롤러

- 컨트롤러는 요청 검증, 서비스 호출, 응답 변환만 한다. 업무 규칙은 서비스와 도메인에 둔다.
- 요청·응답은 DTO(record)로 받고 돌려준다. → [architecture.md](architecture.md)
- 응답 DTO 는 공통 응답 `ApiResponse` 의 `data` 에 담아 돌려준다. 반환 타입은 `ResponseEntity<ApiResponse<T>>` 다.
  파일 내려받기(`byte[]`, `Resource`)와 스트리밍(`StreamingResponseBody`, `SseEmitter`)만 감싸지 않는다.
  정상적인 예외가 많아 ArchUnit 으로 검사하지 않는다. 리뷰에서 확인한다.
- 컨트롤러마다 try-catch 로 예외를 응답으로 바꾸지 않는다. 전역 예외 처리에 맡긴다.

## 공통 응답

성공·실패 모두 같은 모양으로 응답한다. 클라이언트는 응답 하나를 같은 방식으로 읽는다.

```json
{ "success": true, "code": "ORDER_CREATED", "message": "주문을 만들었습니다.", "data": { "id": 1, "status": "PAID" } }
{ "success": false, "code": "ORDER_NOT_CANCELABLE", "message": "이미 취소된 주문입니다." }
```

| 필드 | 뜻 |
| --- | --- |
| `success` | 요청이 성공했는지. HTTP 상태 코드가 2xx 면 `true` |
| `code` | 결과 코드. 클라이언트는 `message` 문구가 아니라 이 값으로 분기한다 |
| `message` | 사람이 읽는 설명. 화면에 그대로 보여 줘도 되는 문구만 쓴다 |
| `data` | 응답 본문. 없으면 필드를 빼고 보낸다 |

- `success` 가 있어도 HTTP 상태 코드는 아래 표대로 정확히 내린다. 실패를 `200` 과 `success: false` 로 보내지 않는다.
- 공통 응답과 코드 타입(`ApiResponse`, `ApiCode`, `SuccessCode`, `ErrorCode`)은 `global/response` 에, `BusinessException`·`GlobalErrorCode`·전역 예외 처리는 `global/exception` 에 둔다. 기능은 `SuccessCode`·`ErrorCode` 를 구현한 enum 을 자기 패키지에 둔다. (`order/dto/OrderSuccessCode`, `order/exception/OrderErrorCode`)
- 결과 코드는 HTTP 상태와 메시지를 가진 enum 상수로만 만든다. 컨트롤러·서비스에서 코드 문자열을 직접 쓰지 않는다.
- `code` 값은 enum 상수 이름이다. 상수 이름과 다른 문자열을 따로 두지 않는다. 클라이언트가 분기하는 값이므로 상수 이름을 바꾸면 API 변경으로 다룬다.

```java
// global/response
public interface ApiCode {
    HttpStatus getHttpStatus();
    String getMessage();

    /** enum 이 자동으로 구현한다. */
    String name();

    default String getCode() {
        return name();
    }
}

public interface SuccessCode extends ApiCode {}

public interface ErrorCode extends ApiCode {}

@JsonInclude(JsonInclude.Include.NON_NULL)
public record ApiResponse<T>(boolean success, String code, String message, T data) {

    public static <T> ApiResponse<T> success(SuccessCode code, T data) {
        return new ApiResponse<>(true, code.getCode(), code.getMessage(), data);
    }

    public static ApiResponse<Void> success(SuccessCode code) {
        return success(code, null);
    }

    public static <T> ApiResponse<T> failure(ErrorCode code, T data) {
        return new ApiResponse<>(false, code.getCode(), code.getMessage(), data);
    }

    public static ApiResponse<Void> failure(ErrorCode code) {
        return failure(code, null);
    }
}

// order/dto
@Getter
@RequiredArgsConstructor
public enum OrderSuccessCode implements SuccessCode {
    ORDER_CREATED(HttpStatus.CREATED, "주문을 만들었습니다."),
    ORDER_CANCELED(HttpStatus.OK, "주문을 취소했습니다.");

    private final HttpStatus httpStatus;
    private final String message;
}

// order/exception
@Getter
@RequiredArgsConstructor
public enum OrderErrorCode implements ErrorCode {
    ORDER_NOT_FOUND(HttpStatus.NOT_FOUND, "주문을 찾을 수 없습니다."),
    ORDER_NOT_CANCELABLE(HttpStatus.CONFLICT, "이미 취소된 주문입니다.");

    private final HttpStatus httpStatus;
    private final String message;
}
```

- 성공 코드의 HTTP 상태는 컨트롤러가 실제로 내리는 상태와 맞춘다. (`ORDER_CREATED` 는 `201`)

## URL 과 메서드

- 자원은 복수 명사로 쓴다. (`/orders`, `/orders/{orderId}`) URL 에 동사를 넣지 않는다. (`/getOrders`)
- CRUD 로 표현하기 어려운 상태 전이는 하위 경로로 쓴다. (`POST /orders/{orderId}/cancel`)

| 메서드 | 용도 | 성공 응답 |
| --- | --- | --- |
| `GET` | 조회 | `200` |
| `POST` | 생성, 상태 전이 | 생성은 `201` 과 `Location` 헤더, 상태 전이는 `200` |
| `PUT` | 전체 교체 | `200` |
| `PATCH` | 일부 수정 | `200` |
| `DELETE` | 삭제 | `200` |

- 모든 응답에 공통 응답 바디가 있으므로 바디가 없는 `204` 는 쓰지 않는다. 돌려줄 데이터가 없으면 `ApiResponse.success(code)` 로 `data` 를 비운다.

| 실패 상황 | 상태 코드 |
| --- | --- |
| 요청 형식·값 검증 실패 | `400` |
| 인증 없음 | `401` |
| 권한 없음 | `403` |
| 자원 없음 | `404` |
| 현재 상태와 충돌 (이미 취소된 주문 취소 등) | `409` |
| 서버 오류 | `500` |

## 요청 검증

- 요청 DTO 필드에 Bean Validation(`@NotBlank`, `@Positive`, `@Size` 등)을 붙이고, 컨트롤러 파라미터에 `@Valid` 를 붙인다.
- 형식 검증(필수, 길이, 범위)은 DTO 에서, 업무 규칙 검증(재고, 상태)은 도메인·서비스에서 한다.

```java
public record CreateOrderRequest(@NotNull Long productId, @Positive int quantity) {}

@PostMapping("/orders")
public ResponseEntity<ApiResponse<OrderResponse>> create(@Valid @RequestBody CreateOrderRequest request) {
    OrderResponse response = orderService.create(request.productId(), request.quantity());
    return ResponseEntity.created(URI.create("/orders/" + response.id()))
            .body(ApiResponse.success(OrderSuccessCode.ORDER_CREATED, response));
}
```

## 오류 응답

- 오류도 공통 응답(`success: false`)으로 내린다. RFC 9457 `ProblemDetail` 과 섞어 쓰지 않는다. (`spring.mvc.problemdetails.enabled` 를 켜지 않는다)
- 기능 예외는 `ErrorCode` 를 담은 `BusinessException` 으로 던지고, `@RestControllerAdvice` 한 곳에서 그 코드의 HTTP 상태와 공통 응답으로 바꾼다.
- 전역 예외 처리는 `ResponseEntityExceptionHandler` 를 상속하고 `handleExceptionInternal` 을 덮어써, Spring 이 던지는 기본 예외(검증 실패, 없는 경로, 지원하지 않는 메서드 등)도 같은 형식으로 응답한다. 상태 코드는 Spring 이 정한 값을 그대로 쓴다.
- 요청 검증 실패는 `INVALID_REQUEST` 코드로 내리고, 필드·파라미터별 오류는 `data` 에 담는다. 요청 바디(`@Valid`), 파라미터(`@RequestParam`·`@PathVariable` 제약), `@Validated` 빈의 메서드 검증이 모두 같은 형식이다.
- 유니크 키 중복이나 상태 충돌은 서비스에서 먼저 확인해 `BusinessException` 으로 던진다. DB 제약 위반·낙관적 락 예외를 `409` 로 바꾸는 핸들러는 동시 요청이 그 확인을 지나친 경우의 안전망이다.
- Spring Security 예외(`AuthenticationException`, `AccessDeniedException`)는 여기서 응답으로 바꾸지 않고 다시 던진다. 필터가 로그인 여부에 따라 `401`·`403` 을 정해 아래 "보안 오류" 의 핸들러로 응답한다.
- 응답에 스택 트레이스, SQL, 내부 클래스 이름을 넣지 않는다. 예상하지 못한 예외는 로그로 남기고 `INTERNAL_ERROR` 의 일반 메시지만 돌려준다.

```java
// global/exception
@Getter
public class BusinessException extends RuntimeException {

    private final ErrorCode errorCode;

    public BusinessException(ErrorCode errorCode) {
        super(errorCode.getMessage());
        this.errorCode = errorCode;
    }
}

@Slf4j
@RestControllerAdvice
public class GlobalExceptionHandler extends ResponseEntityExceptionHandler {

    @ExceptionHandler(BusinessException.class)
    public ResponseEntity<ApiResponse<Void>> handleBusiness(BusinessException e) {
        return failure(e.getErrorCode());
    }

    // 클래스에 @Validated 를 붙인 빈의 메서드 검증 실패
    @ExceptionHandler(ConstraintViolationException.class)
    public ResponseEntity<ApiResponse<Map<String, String>>> handleConstraintViolation(ConstraintViolationException e) {
        Map<String, String> errors = new LinkedHashMap<>();
        e.getConstraintViolations()
                .forEach(violation -> errors.putIfAbsent(violation.getPropertyPath().toString(), violation.getMessage()));
        return ResponseEntity.badRequest().body(ApiResponse.failure(GlobalErrorCode.INVALID_REQUEST, errors));
    }

    // 동시 요청이 서비스의 중복·상태 확인을 지나친 경우의 안전망
    @ExceptionHandler({DataIntegrityViolationException.class, OptimisticLockingFailureException.class})
    public ResponseEntity<ApiResponse<Void>> handleDataConflict(DataAccessException e) {
        log.warn("데이터 충돌", e);
        return failure(GlobalErrorCode.DATA_CONFLICT);
    }

    // Spring Security 를 쓸 때만 둔다. 다시 던지면 필터가 로그인 여부에 따라 401·403 을 정한다.
    // 두지 않으면 @PreAuthorize 실패가 아래 Exception 핸들러에서 500 이 된다.
    @ExceptionHandler({AuthenticationException.class, AccessDeniedException.class})
    public void rethrowSecurityException(RuntimeException e) {
        throw e;
    }

    @ExceptionHandler(Exception.class)
    public ResponseEntity<ApiResponse<Void>> handleUnexpected(Exception e) {
        log.error("예상하지 못한 예외", e);
        return failure(GlobalErrorCode.INTERNAL_ERROR);
    }

    @Override
    protected @Nullable ResponseEntity<Object> handleMethodArgumentNotValid(
            MethodArgumentNotValidException e, HttpHeaders headers, HttpStatusCode status, WebRequest request) {
        Map<String, String> errors = new LinkedHashMap<>();
        e.getBindingResult().getFieldErrors()
                .forEach(error -> errors.putIfAbsent(error.getField(), error.getDefaultMessage()));
        return handleExceptionInternal(
                e, ApiResponse.failure(GlobalErrorCode.INVALID_REQUEST, errors), headers, status, request);
    }

    // @RequestParam·@PathVariable 에 붙인 제약의 검증 실패
    @Override
    protected @Nullable ResponseEntity<Object> handleHandlerMethodValidationException(
            HandlerMethodValidationException e, HttpHeaders headers, HttpStatusCode status, WebRequest request) {
        Map<String, String> errors = new LinkedHashMap<>();
        e.getParameterValidationResults().forEach(result -> errors.putIfAbsent(
                String.valueOf(result.getMethodParameter().getParameterName()),
                result.getResolvableErrors().get(0).getDefaultMessage()));
        return handleExceptionInternal(
                e, ApiResponse.failure(GlobalErrorCode.INVALID_REQUEST, errors), headers, status, request);
    }

    // 나머지 Spring 기본 예외도 여기를 거친다. 바디만 공통 응답으로 바꾸고 부모 구현에 넘긴다.
    // 부모 구현은 응답이 이미 나갔으면 아무것도 쓰지 않고, 500 이면 원래 예외를 요청 속성에 남긴다.
    @Override
    protected @Nullable ResponseEntity<Object> handleExceptionInternal(
            Exception e, @Nullable Object body, HttpHeaders headers, HttpStatusCode status, WebRequest request) {
        Object apiBody = body instanceof ApiResponse<?> ? body : ApiResponse.failure(GlobalErrorCode.fromStatus(status));
        return super.handleExceptionInternal(e, apiBody, headers, status, request);
    }

    private ResponseEntity<ApiResponse<Void>> failure(ErrorCode code) {
        return ResponseEntity.status(code.getHttpStatus()).body(ApiResponse.failure(code));
    }
}

@Getter
@RequiredArgsConstructor
public enum GlobalErrorCode implements ErrorCode {
    INVALID_REQUEST(HttpStatus.BAD_REQUEST, "요청 값이 올바르지 않습니다."),
    UNAUTHORIZED(HttpStatus.UNAUTHORIZED, "로그인이 필요합니다."),
    FORBIDDEN(HttpStatus.FORBIDDEN, "권한이 없습니다."),
    NOT_FOUND(HttpStatus.NOT_FOUND, "요청한 자원을 찾을 수 없습니다."),
    METHOD_NOT_ALLOWED(HttpStatus.METHOD_NOT_ALLOWED, "지원하지 않는 메서드입니다."),
    DATA_CONFLICT(HttpStatus.CONFLICT, "다른 요청과 충돌했습니다. 다시 시도해 주세요."),
    INTERNAL_ERROR(HttpStatus.INTERNAL_SERVER_ERROR, "일시적인 오류가 발생했습니다.");

    private final HttpStatus httpStatus;
    private final String message;

    /** 상태 코드가 같은 상수. 없으면 4xx 는 INVALID_REQUEST, 그 밖은 INTERNAL_ERROR. */
    public static GlobalErrorCode fromStatus(HttpStatusCode status) {
        return Arrays.stream(values())
                .filter(code -> code.httpStatus.value() == status.value())
                .findFirst()
                .orElse(status.is4xxClientError() ? INVALID_REQUEST : INTERNAL_ERROR);
    }
}
```

- `GlobalErrorCode` 에는 기능과 무관한 코드만 둔다. 기능의 오류는 기능의 `ErrorCode` enum 에 둔다.
- `fromStatus` 로 고른 코드의 상태와 실제 응답 상태가 다를 수 있다. (`415` 는 `INVALID_REQUEST` 코드) HTTP 상태는 Spring 이 정한 값을 그대로 둔다.

## 보안 오류와 필터 예외

필터에서 난 예외는 컨트롤러까지 오지 않아 `@RestControllerAdvice` 가 받지 못한다. 따로 공통 응답으로 바꾼다.

- Spring Security 의 인증 실패(`401`)와 권한 부족(`403`)은 `AuthenticationEntryPoint`·`AccessDeniedHandler` 를 구현해 공통 응답을 쓴다.
- 직접 만든 필터(JWT 검증 등)는 예외를 던지지 않는다. 토큰이 잘못되면 인증 정보를 비운 채 다음 필터로 넘겨, Security 가 `AuthenticationEntryPoint` 로 응답하게 한다.
- 그래도 필터 밖으로 나간 예외는 서블릿 컨테이너가 `/error` 로 넘긴다. `ErrorController` 를 구현해 Spring Boot 기본 오류 JSON 대신 공통 응답을 내린다.
  Security 를 쓰면 `/error` 를 `permitAll()` 로 열어 둔다. 막혀 있으면 원래 오류 대신 `401` 이 나간다.

```java
// global/security
@Component
@RequiredArgsConstructor
public class ApiResponseSecurityHandler implements AuthenticationEntryPoint, AccessDeniedHandler {

    private final JsonMapper jsonMapper; // Spring Boot 4 는 Jackson 3 (tools.jackson.databind.json.JsonMapper)

    @Override
    public void commence(HttpServletRequest request, HttpServletResponse response, AuthenticationException e)
            throws IOException {
        write(response, GlobalErrorCode.UNAUTHORIZED);
    }

    @Override
    public void handle(HttpServletRequest request, HttpServletResponse response, AccessDeniedException e)
            throws IOException {
        write(response, GlobalErrorCode.FORBIDDEN);
    }

    private void write(HttpServletResponse response, ErrorCode code) throws IOException {
        response.setStatus(code.getHttpStatus().value());
        response.setContentType(MediaType.APPLICATION_JSON_VALUE);
        response.setCharacterEncoding(StandardCharsets.UTF_8.name());
        jsonMapper.writeValue(response.getOutputStream(), ApiResponse.failure(code));
    }
}

// SecurityConfig
http.authorizeHttpRequests(auth -> auth.requestMatchers("/error").permitAll() /* ... */)
        .exceptionHandling(handling -> handling
                .authenticationEntryPoint(apiResponseSecurityHandler)
                .accessDeniedHandler(apiResponseSecurityHandler));

// global/exception
@RestController
public class ApiErrorController implements ErrorController {

    @RequestMapping("${server.error.path:/error}")
    public ResponseEntity<ApiResponse<Void>> error(HttpServletRequest request) {
        HttpStatus status = request.getAttribute(RequestDispatcher.ERROR_STATUS_CODE) instanceof Integer value
                        && HttpStatus.resolve(value) != null
                ? HttpStatus.valueOf(value)
                : HttpStatus.INTERNAL_SERVER_ERROR;
        return ResponseEntity.status(status).body(ApiResponse.failure(GlobalErrorCode.fromStatus(status)));
    }
}
```

## 목록과 페이징

- 개수가 늘어날 수 있는 목록은 페이징한다. `Pageable` 을 받고 최대 크기를 제한한다. (`spring.data.web.pageable.max-page-size`)
- `Page` 객체를 그대로 응답하지 않는다. 내용과 페이지 정보를 담은 응답 DTO 로 감싸 `data` 에 넣는다.
