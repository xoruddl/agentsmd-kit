import { fileURLToPath } from "node:url";
import type { Preset } from "@agentsmd/core";
import { gitPreset } from "@agentsmd/preset-git";

/**
 * Java·Gradle 프로젝트용 프리셋.
 *
 * Java 코드 규칙 문서, Spotless(palantir-java-format) 커밋 검사, Gradle CI를 담는다.
 * Git 작업 규칙은 공통 Git 프리셋을 요구해서 함께 설치한다.
 * `files/`는 빌드 결과(dist/)와 소스(src/) 어디서 실행해도 패키지 루트 기준으로 같은 위치다.
 */
export const javaPreset = {
  name: "java",
  requires: [gitPreset],
  description: "Java·Gradle 프로젝트용 지침, 커밋 훅, Spotless·Gradle CI",
  filesDir: fileURLToPath(new URL("../files", import.meta.url)),
  // Spotless 검사(pre-commit.d/spotless)를 연결한다.
  hooksPath: ".githooks",
  docs: [
    {
      path: "docs/project-direction.md",
      when: "모든 작업 시작 전 (필수). 범위 밖 작업이면 먼저 질문",
    },
    { path: "docs/code-style.md", when: "코드 작성, 주석" },
    { path: "docs/clean-code.md", when: "코드 작성, 설계" },
    { path: "docs/clean-code-examples.md", when: "코드 작성 시 참고 예시" },
    { path: "docs/java-checklist.md", when: "Java 코드 작성·리뷰" },
    { path: "docs/lint-and-ci.md", when: "훅·린트·CI 설정" },
  ],
  rules: [
    "코드에는 의도를 설명하는 주석을 적극적으로 단다.",
    "포맷은 손으로 맞추지 않는다. 커밋 전 `./gradlew spotlessApply`.",
  ],
  verify: "./gradlew spotlessCheck build",
  nextSteps: [
    "docs/project-direction.md 에 프로젝트 목표와 범위를 채우세요.",
    "Gradle 프로젝트라면 docs/lint-and-ci.md 의 Spotless 설정을 build.gradle.kts 에 추가하세요.",
  ],
} satisfies Preset;
