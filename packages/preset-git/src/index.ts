import { fileURLToPath } from "node:url";
import type { Preset } from "@agentsmd/core";

/**
 * 언어와 무관한 Git 작업 규칙 프리셋.
 *
 * 이슈 → 브랜치 → PR → merge 커밋 흐름, 에이전트의 커밋 단위 작업 방식, 커밋 훅, PR 규칙 검사를 담는다.
 * 문서 지도(AGENTS.md)는 언어 프리셋이 가지므로 단독으로 설치하지 않고 언어 프리셋이 요구한다.
 */
export const gitPreset = {
  name: "git",
  description: "Git 작업 흐름 문서, 커밋 훅, Conventions 검사, 이슈·PR 템플릿",
  filesDir: fileURLToPath(new URL("../files", import.meta.url)),
  hooksPath: ".githooks",
  nextSteps: [
    "GitHub 저장소 설정에서 머지 방식을 'Create a merge commit'만 허용하세요.",
    "main 브랜치 룰셋의 필수 체크에 Conventions를 추가하세요.",
    "지침 도입 커밋만 파일 수 한도를 올려 한 번에 커밋하세요: HARNESS_MAX_FILES=99 git commit ...",
  ],
} satisfies Preset;
