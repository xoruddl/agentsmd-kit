import static com.tngtech.archunit.lang.syntax.ArchRuleDefinition.classes;
import static com.tngtech.archunit.lang.syntax.ArchRuleDefinition.fields;
import static com.tngtech.archunit.lang.syntax.ArchRuleDefinition.noClasses;
import static com.tngtech.archunit.lang.syntax.ArchRuleDefinition.noMethods;

import com.tngtech.archunit.base.DescribedPredicate;
import com.tngtech.archunit.core.domain.JavaAnnotation;
import com.tngtech.archunit.core.domain.JavaClass;
import com.tngtech.archunit.core.domain.JavaEnumConstant;
import com.tngtech.archunit.core.domain.JavaField;
import com.tngtech.archunit.core.domain.JavaMethod;
import com.tngtech.archunit.core.domain.JavaModifier;
import com.tngtech.archunit.core.domain.properties.HasAnnotations;
import com.tngtech.archunit.core.importer.ImportOption;
import com.tngtech.archunit.junit.AnalyzeClasses;
import com.tngtech.archunit.junit.ArchTest;
import com.tngtech.archunit.lang.ArchCondition;
import com.tngtech.archunit.lang.ArchRule;
import com.tngtech.archunit.lang.ConditionEvents;
import com.tngtech.archunit.lang.SimpleConditionEvent;
import com.tngtech.archunit.library.GeneralCodingRules;
import com.tngtech.archunit.library.freeze.FreezingArchRule;
import java.util.List;
import java.util.Optional;
import java.util.stream.Stream;

/**
 * 바이트코드로 판단할 수 있는 Spring·JPA 코드 작성 규칙을 검사한다. 근거는 docs/spring-java/ 의 각 문서다.
 *
 * <p>PackageSizeTest 와 같이 기본 패키지에 두고, 테스트 클래스와 jar·jrt 를 뺀 프로젝트의 main 클래스만 읽는다.
 * 루트 패키지를 적을 필요가 없다.
 *
 * <p>모든 규칙은 {@link FreezingArchRule} 로 감싸서, 도입 시점에 이미 있던 위반은 기준선(src/test/resources/archunit_store)에
 * 두고 새 위반만 실패시킨다. 기준선은 손으로 고치거나 지우지 않는다. 절차는 docs/java/lint-and-ci.md 의 "코드 규칙 테스트" 를 따른다.
 *
 * <p>@Enumerated·@ManyToOne·@Entity 처럼 프로젝트에 해당 요소가 아예 없을 수 있는 규칙은 {@code allowEmptyShould(true)} 로 둔다.
 * ArchUnit 기본값은 검사할 클래스가 하나도 없으면 실패하는데, 요소가 없는 것은 위반이 아니기 때문이다.
 *
 * <p>JPA 어노테이션은 {@code jakarta.persistence.*} 의 정확한 타입 이름으로 비교한다.
 * Lombok 의 {@code @Setter}·{@code @Data} 는 바이트코드에 남지 않지만 만들어진 메서드는 남으므로, 메서드로 판단한다.
 */
@AnalyzeClasses(importOptions = {ImportOption.DoNotIncludeTests.class, ImportOption.DoNotIncludeArchives.class})
class SpringCodingRulesTest {

    private static final String ENTITY = "jakarta.persistence.Entity";
    private static final String EMBEDDABLE = "jakarta.persistence.Embeddable";
    private static final String ENUMERATED = "jakarta.persistence.Enumerated";
    private static final String MANY_TO_ONE = "jakarta.persistence.ManyToOne";
    private static final String ONE_TO_ONE = "jakarta.persistence.OneToOne";

    /** @RestController 는 @Controller 를 메타 어노테이션으로 가지므로 이 이름 하나로 둘 다 잡는다. */
    private static final String CONTROLLER = "org.springframework.stereotype.Controller";

    /** @GetMapping·@PostMapping 등은 @RequestMapping 을 메타 어노테이션으로 가지므로 이 이름 하나로 모두 잡는다. */
    private static final String REQUEST_MAPPING = "org.springframework.web.bind.annotation.RequestMapping";

    /** Spring 과 Jakarta 의 @Transactional. 둘 다 같은 규칙으로 본다. */
    private static final List<String> TRANSACTIONAL_ANNOTATIONS =
            List.of("org.springframework.transaction.annotation.Transactional", "jakarta.transaction.Transactional");

    /** 프록시로 동작하는 어노테이션. private 메서드에는 프록시가 적용되지 않아 조용히 무시된다. */
    private static final List<String> PROXY_ANNOTATIONS = Stream.concat(
                    TRANSACTIONAL_ANNOTATIONS.stream(), Stream.of("org.springframework.scheduling.annotation.Async"))
            .toList();

    @ArchTest
    static final ArchRule 필드_주입을_쓰지_않는다 = FreezingArchRule.freeze(
            GeneralCodingRules.NO_CLASSES_SHOULD_USE_FIELD_INJECTION.because(
                    "생성자로 주입해야 의존을 숨기지 않고 테스트에서 직접 만들 수 있다 → docs/spring-java/architecture.md"));

    // 레이어를 패키지 경로 어디에든 controller·repository 가 있는지로 판단한다. LayerArchitectureTest 는
    // FEATURES_PACKAGE.<기능>.<레이어> 자리로 판단하므로 기준이 다르다. 이 파일은 패키지 상수 없이 설치만으로 동작하게
    // 하려고 단순 패턴을 쓴다. 두 테스트는 따로 실행되므로 판단이 어긋나도 이 규칙은 그대로 실패한다.
    // 기능 이름에 controller·repository 가 들어간 구조(예: app.repository.service)라면 아래 패키지 패턴을 프로젝트에 맞게 고친다.
    @ArchTest
    static final ArchRule controller와_repository에_Transactional을_두지_않는다 = FreezingArchRule.freeze(classes()
            .that()
            .resideInAnyPackage("..controller..", "..repository..")
            .should(notBeTransactionalNorHaveTransactionalMethods())
            .because("트랜잭션 경계는 service 에 둔다. controller 에 두면 응답 직렬화까지 트랜잭션이 길어진다"
                    + " → docs/spring-java/data-jpa.md")
            .allowEmptyShould(true));

    @ArchTest
    static final ArchRule private_메서드에_Transactional과_Async를_두지_않는다 = FreezingArchRule.freeze(noMethods()
            .that()
            .arePrivate()
            .should()
            .beAnnotatedWith(DescribedPredicate.describe(
                    "@Transactional 이나 @Async",
                    annotation -> PROXY_ANNOTATIONS.contains(annotation.getRawType().getName())))
            .because("private 메서드에는 프록시가 적용되지 않아 트랜잭션·비동기 실행이 조용히 무시된다."
                    + " public 메서드에 두고 다른 빈에서 부른다 → docs/spring-java/data-jpa.md")
            .allowEmptyShould(true));

    // @Enumerated 의 기본값은 ORDINAL 이라 값을 적지 않은 것도 위반이다. enum 순서를 바꾸면 저장된 데이터의 뜻이 달라진다.
    @ArchTest
    static final ArchRule Enumerated는_STRING만_쓴다 = FreezingArchRule.freeze(fields()
            .that()
            .areAnnotatedWith(ENUMERATED)
            .should(haveEnumValue(ENUMERATED, "value", "STRING"))
            .because("ORDINAL 은 enum 순서를 바꾸면 저장된 데이터의 뜻이 달라진다 → docs/spring-java/data-jpa.md")
            .allowEmptyShould(true));

    // @ManyToOne·@OneToOne 의 기본값은 EAGER 라 값을 적지 않은 것도 위반이다.
    @ArchTest
    static final ArchRule ToOne_연관관계는_지연_로딩이다 = FreezingArchRule.freeze(fields()
            .that()
            .areAnnotatedWith(MANY_TO_ONE)
            .or()
            .areAnnotatedWith(ONE_TO_ONE)
            .should(haveFetchLazy())
            .because("@ManyToOne·@OneToOne 은 기본값이 즉시 로딩이라 fetch = FetchType.LAZY 를 직접 적는다"
                    + " → docs/spring-java/data-jpa.md")
            .allowEmptyShould(true));

    @ArchTest
    static final ArchRule 엔티티와_값_객체에_공개_setter를_두지_않는다 = FreezingArchRule.freeze(classes()
            .that()
            .areAnnotatedWith(ENTITY)
            .or()
            .areAnnotatedWith(EMBEDDABLE)
            .should(notHavePublicSetters())
            .because("setter 로 상태를 바꾸면 불변식을 지킬 수 없다. 엔티티는 의도가 드러나는 메서드로 바꾸고,"
                    + " 값 객체(@Embeddable)는 바꾸지 않고 새로 만든다 → docs/spring-java/data-jpa.md")
            .allowEmptyShould(true));

    // 요청 매핑 메서드의 반환 타입(ResponseEntity<List<Order>> 같은 제네릭 인자 포함)과 파라미터를 본다.
    // 매핑을 인터페이스에 두고 컨트롤러가 구현하는 구조는 컨트롤러 메서드에 매핑 어노테이션이 없어 잡지 못한다.
    @ArchTest
    static final ArchRule 컨트롤러는_엔티티를_요청이나_응답으로_쓰지_않는다 = FreezingArchRule.freeze(classes()
            .that()
            .areMetaAnnotatedWith(CONTROLLER)
            .should(notUseEntitiesInRequestMappings())
            .because("엔티티를 그대로 주고받으면 지연 로딩 예외, 순환 참조, 내부 필드 노출이 생긴다. 요청·응답 DTO 를 쓴다"
                    + " → docs/spring-java/architecture.md")
            .allowEmptyShould(true));

    @ArchTest
    static final ArchRule ServiceImpl_클래스를_두지_않는다 = FreezingArchRule.freeze(noClasses()
            .should()
            .haveSimpleNameEndingWith("ServiceImpl")
            .because("구현이 하나뿐인 서비스에 인터페이스와 Impl 을 나누지 않는다 → docs/spring-java/architecture.md"));

    /** 클래스 자체나 그 클래스가 선언한 메서드에 @Transactional 이 있으면 위반이다. */
    private static ArchCondition<JavaClass> notBeTransactionalNorHaveTransactionalMethods() {
        return new ArchCondition<>("@Transactional 을 클래스나 메서드에 두지 않는다") {
            @Override
            public void check(JavaClass javaClass, ConditionEvents events) {
                if (isTransactional(javaClass)) {
                    events.add(SimpleConditionEvent.violated(
                            javaClass, javaClass.getDescription() + " 에 @Transactional 이 있다"));
                }
                for (JavaMethod method : javaClass.getMethods()) {
                    if (isTransactional(method)) {
                        events.add(SimpleConditionEvent.violated(
                                method, method.getDescription() + " 에 @Transactional 이 있다"));
                    }
                }
            }
        };
    }

    private static boolean isTransactional(HasAnnotations<?> element) {
        return TRANSACTIONAL_ANNOTATIONS.stream().anyMatch(element::isAnnotatedWith);
    }

    /** 어노테이션 속성이 주어진 enum 상수가 아니면 위반이다. 속성을 적지 않았으면(기본값이 쓰이면) 위반이다. */
    private static ArchCondition<JavaField> haveEnumValue(String annotationType, String property, String expected) {
        return new ArchCondition<>("@" + simpleName(annotationType) + " 의 " + property + " 가 " + expected + " 이다") {
            @Override
            public void check(JavaField field, ConditionEvents events) {
                String actual = explicitEnumValue(field, annotationType, property).orElse("(미지정)");
                if (!actual.equals(expected)) {
                    events.add(SimpleConditionEvent.violated(
                            field,
                            field.getDescription() + " 의 @" + simpleName(annotationType) + " " + property + " 가 "
                                    + actual + " 이다 (기대값 " + expected + ")"));
                }
            }
        };
    }

    private static ArchCondition<JavaField> haveFetchLazy() {
        return new ArchCondition<>("fetch 가 LAZY 이다") {
            @Override
            public void check(JavaField field, ConditionEvents events) {
                for (String annotationType : List.of(MANY_TO_ONE, ONE_TO_ONE)) {
                    if (!field.isAnnotatedWith(annotationType)) {
                        continue;
                    }
                    String actual = explicitEnumValue(field, annotationType, "fetch").orElse("(미지정, 기본값 EAGER)");
                    if (!actual.equals("LAZY")) {
                        events.add(SimpleConditionEvent.violated(
                                field,
                                field.getDescription() + " 의 @" + simpleName(annotationType) + " fetch 가 " + actual
                                        + " 이다. fetch = FetchType.LAZY 로 적는다"));
                    }
                }
            }
        };
    }

    /** public 인 인스턴스 메서드 가운데 set + 대문자로 시작하고 파라미터가 하나인 것이 있으면 위반이다. */
    private static ArchCondition<JavaClass> notHavePublicSetters() {
        return new ArchCondition<>("public setter 를 갖지 않는다") {
            @Override
            public void check(JavaClass javaClass, ConditionEvents events) {
                for (JavaMethod method : javaClass.getMethods()) {
                    if (isPublicSetter(method)) {
                        events.add(SimpleConditionEvent.violated(
                                method, method.getDescription() + " 는 엔티티·값 객체의 public setter 이다"));
                    }
                }
            }
        };
    }

    private static boolean isPublicSetter(JavaMethod method) {
        String name = method.getName();
        return method.getModifiers().contains(JavaModifier.PUBLIC)
                && !method.getModifiers().contains(JavaModifier.STATIC)
                && !method.getModifiers().contains(JavaModifier.SYNTHETIC)
                && method.getRawParameterTypes().size() == 1
                && name.length() > 3
                && name.startsWith("set")
                && Character.isUpperCase(name.charAt(3));
    }

    /** 요청 매핑 메서드의 반환 타입이나 파라미터에 @Entity 타입이 있으면 위반이다. */
    private static ArchCondition<JavaClass> notUseEntitiesInRequestMappings() {
        return new ArchCondition<>("요청 매핑 메서드의 반환 타입과 파라미터에 @Entity 를 쓰지 않는다") {
            @Override
            public void check(JavaClass javaClass, ConditionEvents events) {
                for (JavaMethod method : requestMappingMethods(javaClass)) {
                    entityTypesIn(method).forEach(entity -> events.add(SimpleConditionEvent.violated(
                            method,
                            method.getDescription() + " 가 엔티티 " + entity.getSimpleName() + " 를 요청이나 응답으로 쓴다")));
                }
            }
        };
    }

    /** 컴파일러가 만든 브리지·합성 메서드는 원래 메서드의 어노테이션을 복사하므로 빼야 같은 위반을 두 번 세지 않는다. */
    private static List<JavaMethod> requestMappingMethods(JavaClass javaClass) {
        return javaClass.getMethods().stream()
                .filter(method -> method.isMetaAnnotatedWith(REQUEST_MAPPING))
                .filter(method -> !method.getModifiers().contains(JavaModifier.BRIDGE))
                .filter(method -> !method.getModifiers().contains(JavaModifier.SYNTHETIC))
                .toList();
    }

    /** 반환 타입과 파라미터 타입, 그 제네릭 인자와 배열 원소 타입 가운데 @Entity 인 클래스. */
    private static List<JavaClass> entityTypesIn(JavaMethod method) {
        return Stream.concat(Stream.of(method.getReturnType()), method.getParameterTypes().stream())
                .flatMap(type -> type.getAllInvolvedRawTypes().stream())
                .filter(type -> type.isAnnotatedWith(ENTITY))
                .distinct()
                .toList();
    }

    /** 소스에 적은 어노테이션 속성의 enum 상수 이름. 적지 않았으면 비어 있다. */
    private static Optional<String> explicitEnumValue(JavaField field, String annotationType, String property) {
        JavaAnnotation<JavaField> annotation = field.getAnnotationOfType(annotationType);
        return annotation
                .tryGetExplicitlyDeclaredProperty(property)
                .flatMap(value ->
                        value instanceof JavaEnumConstant constant ? Optional.of(constant.name()) : Optional.empty());
    }

    private static String simpleName(String typeName) {
        return typeName.substring(typeName.lastIndexOf('.') + 1);
    }
}
