import { format } from "prettier";
import { describe, expect, it } from "vitest";
import { CLAUDE_MD, renderAgentsMd } from "../src/agents-md.js";
import { parseDocMap } from "../src/parse-doc-map.js";
import type { Preset } from "../src/preset.js";

const git = {
  name: "git",
  description: "",
  filesDir: "",
  docs: [
    { path: "docs/workflow.md", when: "모든 작업 시작 전 (필수)" },
    { path: "docs/git-conventions.md", when: "이슈·브랜치·커밋·PR·머지" },
  ],
  rules: ["커밋 하나 = 책임 하나, 파일 5개 이하."],
} satisfies Preset;

const language = {
  name: "typescript",
  description: "",
  filesDir: "",
  docs: [
    { path: "docs/project-direction.md", when: "모든 작업 시작 전 (필수)" },
    { path: "docs/typescript.md", when: "코드 작성·리뷰" },
  ],
  rules: ["`any`, `as` 단언으로 타입 오류를 덮지 않는다."],
  verify: "pnpm lint && pnpm test",
} satisfies Preset;

function linkedPaths(markdown: string): string[] {
  return parseDocMap("AGENTS.md", markdown).links.map((link) => link.target);
}

describe("renderAgentsMd", () => {
  it("고른 프리셋의 문서를 순서대로 합쳐 지도에 올린다", () => {
    expect(linkedPaths(renderAgentsMd([git, language]))).toEqual([
      "docs/workflow.md",
      "docs/git-conventions.md",
      "docs/project-direction.md",
      "docs/typescript.md",
    ]);
  });

  it("고르지 않은 프리셋의 문서는 링크하지 않는다", () => {
    expect(linkedPaths(renderAgentsMd([language]))).toEqual([
      "docs/project-direction.md",
      "docs/typescript.md",
    ]);
  });

  it("여러 프리셋이 같은 문서를 올리면 한 줄만 남긴다", () => {
    const java = { ...language, name: "java" };
    expect(linkedPaths(renderAgentsMd([language, java]))).toHaveLength(2);
  });

  it("핵심 규칙에 프리셋 순서대로 번호를 매긴다", () => {
    const markdown = renderAgentsMd([git, language]);
    expect(markdown).toContain("1. 커밋 하나 = 책임 하나, 파일 5개 이하.");
    expect(markdown).toContain("2. `any`, `as` 단언으로 타입 오류를 덮지 않는다.");
  });

  it("검증 명령이 있는 프리셋이 없으면 검증 절을 넣지 않는다", () => {
    expect(renderAgentsMd([git])).not.toContain("## 검증");
    expect(renderAgentsMd([git, language])).toContain("```bash\npnpm lint && pnpm test\n```");
  });

  // 대상 저장소에서 format:check를 돌려도 AGENTS.md 때문에 실패하지 않아야 한다.
  it("Prettier가 다시 고치지 않는 모양이다", async () => {
    const markdown = renderAgentsMd([git, language]);
    await expect(format(markdown, { parser: "markdown" })).resolves.toBe(markdown);
  });
});

describe("CLAUDE_MD", () => {
  it("AGENTS.md를 불러온다", () => {
    expect(CLAUDE_MD.startsWith("@AGENTS.md\n")).toBe(true);
  });
});
