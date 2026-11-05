import { fileURLToPath } from "node:url";
import type { Preset } from "@agentsmd/core";

/**
 * Spring Boot 서버용 프리셋. Spring Boot 4(Spring Framework 7) 기준이다.
 *
 * 패키지 구조·설정, JPA·트랜잭션, API·테스트 문서를 담는다.
 * Java 코드 규칙과 검증 명령, 포맷 설정은 넣지 않는다. Java 프리셋을 함께 고르면 더해진다.
 * 프리셋끼리 의존하지 않으므로, 이 프리셋만 설치해도 문서의 링크가 깨지지 않게 다른 프리셋 문서로 링크하지 않는다.
 * `files/`는 빌드 결과(dist/)와 소스(src/) 어디서 실행해도 패키지 루트 기준으로 같은 위치다.
 */
export const springPreset = {
  name: "spring",
  description: "Spring Boot 서버용 구조·JPA·트랜잭션·API·테스트 규칙",
  filesDir: fileURLToPath(new URL("../files", import.meta.url)),
} satisfies Preset;
