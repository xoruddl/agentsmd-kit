import { fileURLToPath } from "node:url";
import type { Preset } from "@agentsmd/core";

/**
 * Java·Gradle 프로젝트용 프리셋.
 *
 * AI 에이전트가 작은 커밋 단위로 작업하도록 하는 지침(AGENTS.md와 docs/), 커밋 훅, Gradle CI, CodeRabbit 설정을 담는다.
 * `files/`는 빌드 결과(dist/)와 소스(src/) 어디서 실행해도 패키지 루트 기준으로 같은 위치다.
 */
export const javaPreset = {
  name: "java",
  description: "Java·Gradle 프로젝트용 지침, 커밋 훅, Spotless·Gradle CI",
  filesDir: fileURLToPath(new URL("../files", import.meta.url)),
} satisfies Preset;
