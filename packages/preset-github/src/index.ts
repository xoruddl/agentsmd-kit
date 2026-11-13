import { fileURLToPath } from "node:url";
import type { Preset } from "@agentsmd/core";

/**
 * GitHub 저장소용 프리셋.
 *
 * 이슈·PR 템플릿과 GitHub 저장소 설정 안내를 담는다. CI 설정 파일은 넣지 않는다.
 * GitHub를 쓰면서 CI는 Jenkins 등으로 돌리는 저장소도 있어서, CI는 사용자가 고르고 문서로만 연결 방법을 안내한다.
 * Git 작업 규칙은 Git 프리셋에 맡긴다. PR 템플릿과 문서가 그 규칙 문서를 가리키므로 `requires`로 적어 두고, `init`이 함께 설치한다.
 */
export const githubPreset = {
  name: "github",
  description: "GitHub 이슈·PR 템플릿, 저장소 설정 안내",
  filesDir: fileURLToPath(new URL("../files", import.meta.url)),
  requires: ["git"],
  docs: [
    {
      path: "docs/github/usage.md",
      when: "이슈·PR 작성, gh 명령, 저장소 설정, CI 연결",
    },
  ],
  rules: ["이슈와 PR은 `.github/`의 템플릿을 채워 만든다."],
  nextSteps: [
    "GitHub 저장소 설정에서 머지 방식을 'Allow merge commits'만 허용하세요. → docs/github/usage.md",
    "main 브랜치 룰셋을 만들고 CI 검사를 필수 체크로 거세요. → docs/github/usage.md",
    "GitHub Actions를 쓰면 PR마다 문서 지도를 검사하는 xoruddl/agentsmd-kit Action을 거세요. → docs/github/usage.md",
  ],
} satisfies Preset;
