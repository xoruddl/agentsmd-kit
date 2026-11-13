import { fileURLToPath } from "node:url";
import type { Preset } from "@agentsmd/core";

/**
 * Java·Gradle 프로젝트용 프리셋.
 *
 * Java 코드 규칙 문서와 Spotless(palantir-java-format)·Gradle 검증 명령 문서를 담는다.
 * Git 훅·GitHub 설정은 넣지 않는다. 필요하면 Git 프리셋을 함께 고른다.
 * 프로젝트 목표와 범위를 적는 방향 문서는 언어와 무관해 project 프리셋에 맡기고, `requires`로 적어 `init`이 함께 설치하게 한다.
 * `files/`는 빌드 결과(dist/)와 소스(src/) 어디서 실행해도 패키지 루트 기준으로 같은 위치다.
 */
export const javaPreset = {
  name: "java",
  description: "Java·Gradle 프로젝트용 코드 규칙, Spotless·Gradle 검증 명령",
  filesDir: fileURLToPath(new URL("../files", import.meta.url)),
  requires: ["project"],
  docs: [
    { path: "docs/java/code-style.md", when: "코드 작성, 주석" },
    { path: "docs/java/clean-code.md", when: "코드 작성, 설계" },
    { path: "docs/java/clean-code-examples.md", when: "코드 작성 시 참고 예시" },
    { path: "docs/java/checklist.md", when: "Java 코드 작성·리뷰" },
    { path: "docs/java/testing.md", when: "테스트를 쓸 때" },
    {
      path: "docs/java/logging-and-security.md",
      when: "로그를 남길 때, 비밀값·외부 입력·의존성을 다룰 때",
    },
    { path: "docs/java/lint-and-ci.md", when: "린트·포맷·CI 설정" },
  ],
  rules: [
    "주석에는 코드만 봐서는 알 수 없는 의도와 이유를 쓴다. 코드를 되풀이하지 않는다.",
    "포맷은 손으로 맞추지 않는다. 작업을 마치기 전 `./gradlew spotlessApply`.",
    "기능은 테스트와 함께 쓴다. 버그 수정은 재현 테스트부터 쓴다.",
    "로그와 예외 메시지에 비밀값·개인정보를 남기지 않는다.",
    "새 의존성은 사용자에게 묻고 추가한다.",
  ],
  verify: "./gradlew spotlessCheck build",
  nextSteps: [
    "Gradle 프로젝트라면 docs/java/lint-and-ci.md 의 Spotless·toolchain 설정을 build.gradle.kts 에 추가하세요.",
  ],
  // 0.6 이하는 문서를 docs/ 한 층에 설치했다. lint-and-ci.md는 typescript 프리셋도 같은 이름으로 설치했다.
  moved: [
    { from: "docs/code-style.md", to: "docs/java/code-style.md" },
    { from: "docs/clean-code.md", to: "docs/java/clean-code.md" },
    { from: "docs/clean-code-examples.md", to: "docs/java/clean-code-examples.md" },
    { from: "docs/java-checklist.md", to: "docs/java/checklist.md" },
    { from: "docs/java-testing.md", to: "docs/java/testing.md" },
    { from: "docs/java-logging-and-security.md", to: "docs/java/logging-and-security.md" },
    { from: "docs/lint-and-ci.md", to: "docs/java/lint-and-ci.md" },
  ],
} satisfies Preset;
