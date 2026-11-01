import { fileURLToPath } from "node:url";
import type { Preset } from "@agentsmd/core";
import { gitPreset } from "@agentsmd/preset-git";

/**
 * Java·Gradle 프로젝트용 프리셋.
 *
 * Java 코드 규칙 문서, Spotless(palantir-java-format)·Gradle CI, CodeRabbit 설정을 담는다.
 * Git 작업 규칙은 공통 Git 프리셋을 요구해서 함께 설치한다.
 * `files/`는 빌드 결과(dist/)와 소스(src/) 어디서 실행해도 패키지 루트 기준으로 같은 위치다.
 */
export const javaPreset = {
  name: "java",
  requires: [gitPreset],
  description: "Java·Gradle 프로젝트용 지침, 커밋 훅, Spotless·Gradle CI",
  filesDir: fileURLToPath(new URL("../files", import.meta.url)),
  hooksPath: ".githooks",
  nextSteps: [
    "docs/project-direction.md 에 프로젝트 목표와 범위를 채우세요.",
    "Gradle 프로젝트라면 docs/lint-and-ci.md 의 Spotless 설정을 build.gradle.kts 에 추가하세요.",
    "지침 도입 커밋만 파일 수 한도를 올려 한 번에 커밋하세요: HARNESS_MAX_FILES=99 git commit ...",
  ],
} satisfies Preset;
