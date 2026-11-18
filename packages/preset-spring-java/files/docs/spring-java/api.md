# API

Spring MVC 로 REST API 를 만들 때의 규칙이다.

## 컨트롤러

- 컨트롤러는 요청 검증, 서비스 호출, 응답 변환만 한다. 업무 규칙은 서비스와 도메인에 둔다.
- 요청·응답은 DTO(record)로 받고 돌려준다. → [architecture.md](architecture.md)
- 응답 DTO 는 공통 응답 `ApiResponse` 의 `data` 에 담아 돌려준다. 반환 타입은 `ResponseEntity<ApiResponse<T>>` 다.
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
- 공통 응답과 코드 타입(`ApiResponse`, `ApiCode`, `SuccessCode`, `ErrorCode`)은 `global/response` 에, `BusinessException`·`GlobalErrorCode`·전역 예외 처리는 `global/exception` 에 둔다. 기능은 `SuccessCode`·`ErrorCode` 를 구현한 enum 을 자기 패키지에 둔다. (`order/exception/OrderErrorCode`)
- 결과 코드는 HTTP 상태, 코드, 메시지를 함께 가진 enum 상수로만 만든다. 컨트롤러·서비스에서 코드 문자열을 직접 쓰지 않는다.

```java
// global/response
public interface ApiCode {
    HttpStatus getHttpStatus();
    String getCode();
    String getMessage();
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

// order/exception
@Getter
@RequiredArgsConstructor
public enum OrderErrorCode implements ErrorCode {
    ORDER_NOT_FOUND(HttpStatus.NOT_FOUND, "ORDER_NOT_FOUND", "주문을 찾을 수 없습니다."),
    ORDER_NOT_CANCELABLE(HttpStatus.CONFLICT, "ORDER_NOT_CANCELABLE", "이미 취소된 주문입니다.");

    private final HttpStatus httpStatus;
    private final String code;
    private final String message;
}
```

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
- 요청 검증 실패는 `INVALID_REQUEST` 코드로 내리고, 필드별 오류는 `data` 에 담는다.
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
        ErrorCode code = e.getErrorCode();
        return ResponseEntity.status(code.getHttpStatus()).body(ApiResponse.failure(code));
    }

    @ExceptionHandler(Exception.class)
    public ResponseEntity<ApiResponse<Void>> handleUnexpected(Exception e) {
        log.error("예상하지 못한 예외", e);
        ErrorCode code = GlobalErrorCode.INTERNAL_ERROR;
        return ResponseEntity.status(code.getHttpStatus()).body(ApiResponse.failure(code));
    }

    @Override
    protected ResponseEntity<Object> handleMethodArgumentNotValid(
            MethodArgumentNotValidException e, HttpHeaders headers, HttpStatusCode status, WebRequest request) {
        Map<String, String> fieldErrors = new LinkedHashMap<>();
        e.getBindingResult().getFieldErrors()
                .forEach(error -> fieldErrors.putIfAbsent(error.getField(), error.getDefaultMessage()));
        return ResponseEntity.status(status)
                .body(ApiResponse.failure(GlobalErrorCode.INVALID_REQUEST, fieldErrors));
    }

    @Override
    protected ResponseEntity<Object> handleExceptionInternal(
            Exception e, @Nullable Object body, HttpHeaders headers, HttpStatusCode status, WebRequest request) {
        return ResponseEntity.status(status)
                .headers(headers)
                .body(ApiResponse.failure(GlobalErrorCode.fromStatus(status)));
    }
}
```

- `GlobalErrorCode` 는 `INVALID_REQUEST`(400), `UNAUTHORIZED`(401), `FORBIDDEN`(403), `NOT_FOUND`(404), `METHOD_NOT_ALLOWED`(405), `INTERNAL_ERROR`(500) 처럼 기능과 무관한 코드만 둔다.
  `fromStatus` 는 상태 코드가 같은 상수를 찾고, 없으면 4xx 는 `INVALID_REQUEST`, 5xx 는 `INTERNAL_ERROR` 를 돌려준다.

## 목록과 페이징

- 개수가 늘어날 수 있는 목록은 페이징한다. `Pageable` 을 받고 최대 크기를 제한한다. (`spring.data.web.pageable.max-page-size`)
- `Page` 객체를 그대로 응답하지 않는다. 내용과 페이지 정보를 담은 응답 DTO 로 감싸 `data` 에 넣는다.
