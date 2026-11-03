import { fileURLToPath } from "node:url";
import type { Preset } from "@agentsmd/core";

/**
 * 언어와 무관한 Git 작업 규칙 프리셋.
 *
 * 이슈 → 브랜치 → PR → merge 커밋 흐름, 에이전트의 커밋 단위 작업 방식, 커밋 훅, PR 규칙 검사 스크립트를 담는다.
 * 호스팅(GitHub 등)과 CI 서비스에 묶이는 파일은 두지 않는다. PR 규칙 검사는 CI가 `.githooks/check-pr`를 부른다.
 * 단독으로 설치해도 되고, 언어 프리셋과 함께 고르면 문서 지도가 합쳐진다.
 */
export const gitPreset = {
  name: "git",
  description: "Git 작업 흐름 문서, 커밋 훅, PR 규칙 검사 스크립트",
  filesDir: fileURLToPath(new URL("../files", import.meta.url)),
  hooksPath: ".githooks",
  docs: [
    { path: "docs/workflow.md", when: "모든 작업 시작 전 (필수)" },
    { path: "docs/git-conventions.md", when: "이슈·브랜치·커밋·PR·머지" },
    { path: "docs/code-review.md", when: "PR 리뷰 확인·반영" },
    { path: "docs/writing-style.md", when: "md 문서, 커밋·PR 메시지 작성" },
  ],
  rules: [
    "커밋 하나 = 책임 하나, 파일 5개 이하.",
    "커밋 1개 후 작업을 멈추고 사용자 피드백을 기다린다.",
    "PR 은 한 가지 목적만 담는다.",
    "커밋·PR 메시지는 사람이 쓴 것처럼 짧게 쓴다. AI 서명 금지.",
    "훅 우회(`--no-verify`) 금지.",
  ],
  nextSteps: [
    "CI에서 PR마다 .githooks/check-pr 를 실행하세요. → docs/git-conventions.md",
    "지침 도입 커밋만 파일 수 한도를 올려 한 번에 커밋하세요: HARNESS_MAX_FILES=99 git commit ...",
  ],
} satisfies Preset;
