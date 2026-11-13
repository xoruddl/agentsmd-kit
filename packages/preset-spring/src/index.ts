import { fileURLToPath } from "node:url";
import type { Preset } from "@agentsmd/core";

/**
 * Spring Boot 서버용 프리셋. Spring Boot 4(Spring Framework 7) 기준이다.
 *
 * 패키지 구조·설정, JPA·트랜잭션, API·테스트 문서를 담는다.
 * Java 코드 규칙과 검증 명령, 포맷 설정은 넣지 않고 Java 프리셋에 맡긴다. `requires`로 적어 두면 `init`이 함께 설치한다.
 * 패키지끼리는 의존하지 않는다. 이 프리셋만 따로 설치해도 문서의 링크가 깨지지 않게 다른 프리셋 문서로 링크하지 않는다.
 * `files/`는 빌드 결과(dist/)와 소스(src/) 어디서 실행해도 패키지 루트 기준으로 같은 위치다.
 */
export const springPreset = {
  name: "spring",
  description: "Spring Boot 서버용 구조·JPA·트랜잭션·API·테스트 규칙",
  filesDir: fileURLToPath(new URL("../files", import.meta.url)),
  requires: ["java"],
  docs: [
    {
      path: "docs/spring/architecture.md",
      when: "클래스·패키지를 만들 때. 패키지 구조, 의존 방향, 주입, DTO 경계, 설정",
    },
    {
      path: "docs/spring/data-jpa.md",
      when: "엔티티·Repository·트랜잭션을 다룰 때. 지연 로딩, N+1, 스키마 마이그레이션",
    },
    {
      path: "docs/spring/api.md",
      when: "컨트롤러·API 를 만들 때. URL, 상태 코드, 요청 검증, 오류 응답, 페이징",
    },
    {
      path: "docs/spring/testing.md",
      when: "Spring 이 필요한 테스트를 쓸 때. 슬라이스 테스트, @MockitoBean, Testcontainers",
    },
  ],
  rules: [
    "필드 주입 대신 생성자 주입을 쓴다.",
    "엔티티를 API 요청·응답으로 쓰지 않는다. DTO(record)로 바꾼다.",
    "다른 기능의 repository·엔티티를 직접 쓰지 않고 그 기능의 service 를 통한다.",
    "`@Transactional` 은 service 에 두고, 조회는 `readOnly = true`. 트랜잭션 안에서 외부 API 를 부르지 않는다.",
  ],
  nextSteps: [
    "application.yml 에 docs/spring/data-jpa.md 의 open-in-view·batch fetch 설정을 넣으세요.",
  ],
  // 0.6 이하는 문서를 docs/ 한 층에 설치했다.
  moved: [
    { from: "docs/spring-architecture.md", to: "docs/spring/architecture.md" },
    { from: "docs/spring-data-jpa.md", to: "docs/spring/data-jpa.md" },
    { from: "docs/spring-api.md", to: "docs/spring/api.md" },
    { from: "docs/spring-testing.md", to: "docs/spring/testing.md" },
  ],
} satisfies Preset;
