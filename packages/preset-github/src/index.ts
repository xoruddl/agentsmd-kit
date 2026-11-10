import { fileURLToPath } from "node:url";
import type { Preset } from "@agentsmd/core";

/**
 * GitHub 저장소용 프리셋.
 *
 * 이슈·PR 템플릿과 GitHub 저장소 설정 안내를 담는다. CI 설정 파일은 넣지 않는다.
 * GitHub를 쓰면서 CI는 Jenkins 등으로 돌리는 저장소도 있어서, CI는 사용자가 고르고 문서로만 연결 방법을 안내한다.
 * Git 작업 규칙은 Git 프리셋을 함께 고르면 더해진다.
 */
export const githubPreset = {
  name: "github",
  description: "GitHub 이슈·PR 템플릿, 저장소 설정 안내",
  filesDir: fileURLToPath(new URL("../files", import.meta.url)),
  docs: [{ path: "docs/github.md", when: "이슈·PR 작성, gh 명령, 저장소 설정, CI 연결" }],
  rules: ["이슈와 PR은 `.github/`의 템플릿을 채워 만든다."],
  nextSteps: [
    "GitHub 저장소 설정에서 머지 방식을 'Allow merge commits'만 허용하세요. → docs/github.md",
    "main 브랜치 룰셋을 만들고 CI 검사를 필수 체크로 거세요. → docs/github.md",
    "GitHub Actions를 쓰면 PR마다 문서 지도를 검사하는 xoruddl/agentsmd-kit Action을 거세요. → docs/github.md",
  ],
} satisfies Preset;
