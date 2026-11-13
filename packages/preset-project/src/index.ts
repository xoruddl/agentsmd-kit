import { fileURLToPath } from "node:url";
import type { Preset } from "@agentsmd/core";

/**
 * 프로젝트 방향 문서 프리셋.
 *
 * 목표, 범위, 하지 않는 것, 기술 스택을 사람이 채우는 문서 하나를 담는다. 에이전트가 범위 밖 작업을 하지 않게 하는 기준이다.
 * 언어와 무관한 문서라 언어 프리셋에 두지 않는다. 언어 프리셋마다 두면 두 언어를 함께 쓰는 저장소에 같은 문서가 두 벌 생긴다.
 * 언어 프리셋이 `requires`로 이 프리셋을 적어 두므로, 사용자가 고르지 않아도 `init`이 함께 설치한다.
 * `files/`는 빌드 결과(dist/)와 소스(src/) 어디서 실행해도 패키지 루트 기준으로 같은 위치다.
 */
export const projectPreset = {
  name: "project",
  description: "프로젝트 목표·범위·기술 스택을 적는 방향 문서",
  filesDir: fileURLToPath(new URL("../files", import.meta.url)),
  docs: [
    {
      path: "docs/project/direction.md",
      when: "모든 작업 시작 전 (필수). 범위 밖 작업이면 먼저 질문",
    },
  ],
  nextSteps: ["docs/project/direction.md 에 프로젝트 목표와 범위를 채우세요."],
} satisfies Preset;
