import { format } from "prettier";
import { describe, expect, it } from "vitest";
import { CLAUDE_MD, mergeAgentsMd, renderAgentsMd } from "../src/agents-md.js";
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

describe("mergeAgentsMd", () => {
  function rulesOf(markdown: string): string[] {
    return markdown
      .split("\n")
      .flatMap((line) => /^\d+\. (.*)$/.exec(line)?.[1] ?? [])
      .sort();
  }

  it("설치 순서와 상관없이 같은 문서와 규칙이 모인다", () => {
    const languageFirst = mergeAgentsMd(renderAgentsMd([language]), [git]).content;
    const gitFirst = mergeAgentsMd(renderAgentsMd([git]), [language]).content;
    const together = renderAgentsMd([git, language]);

    for (const markdown of [languageFirst, gitFirst]) {
      expect(linkedPaths(markdown).sort()).toEqual(linkedPaths(together).sort());
      expect(rulesOf(markdown)).toEqual(rulesOf(together));
      expect(markdown).toContain("pnpm lint && pnpm test");
    }
  });

  it("빠진 항목만 넣고 무엇을 넣었는지 알려 준다", () => {
    const { added } = mergeAgentsMd(renderAgentsMd([language]), [git]);
    expect(added).toEqual({
      docs: ["docs/workflow.md", "docs/git-conventions.md"],
      rules: ["커밋 하나 = 책임 하나, 파일 5개 이하."],
      verify: [],
    });
  });

  it("같은 프리셋을 다시 합치면 아무것도 바뀌지 않는다", () => {
    const markdown = renderAgentsMd([git, language]);
    expect(mergeAgentsMd(markdown, [language, git])).toEqual({
      content: markdown,
      added: { docs: [], rules: [], verify: [] },
      unplaced: { docs: [], rules: [], verify: [] },
    });
  });

  it("규칙 번호를 이어서 매긴다", () => {
    const markdown = mergeAgentsMd(renderAgentsMd([language]), [git]).content;
    expect(markdown).toContain("1. `any`, `as` 단언으로 타입 오류를 덮지 않는다.");
    expect(markdown).toContain("2. 커밋 하나 = 책임 하나, 파일 5개 이하.");
  });

  it("사람이 고쳐 둔 행과 규칙은 그대로 둔다", () => {
    const edited = renderAgentsMd([language])
      .replace("| 코드 작성·리뷰 ", "| 사람이 고친 설명 ")
      .replace("1. `any`", "1. 사람이 고친 규칙. `any`");

    const markdown = mergeAgentsMd(edited, [git]).content;

    expect(markdown).toContain("사람이 고친 설명");
    expect(markdown).toContain("1. 사람이 고친 규칙. `any`");
    expect(linkedPaths(markdown)).toContain("docs/workflow.md");
  });

  it("글머리표 목록이면 같은 글머리표로 잇는다", () => {
    const existing = "# AGENTS.md\n\n## 문서 지도\n\n## 핵심 규칙\n\n- 기존 규칙\n";
    expect(mergeAgentsMd(existing, [git]).content).toContain(
      "- 기존 규칙\n- 커밋 하나 = 책임 하나, 파일 5개 이하.",
    );
  });

  it("문서 지도가 있으면 빠진 절을 정해진 순서대로 새로 만든다", () => {
    const existing = "# AGENTS.md\n\n## 문서 지도\n\n## 지침 관리\n\n- 메모\n";
    const markdown = mergeAgentsMd(existing, [language]).content;
    const headings = markdown.split("\n").filter((line) => line.startsWith("## "));
    expect(headings).toEqual(["## 문서 지도", "## 핵심 규칙", "## 검증", "## 지침 관리"]);
  });

  // 절 이름이 다른 지침(예: `## 작업 전 읽을 문서`)에 같은 역할의 절을 하나 더 만들면 지침이 두 벌이 된다.
  it("문서 지도 절이 없으면 아무 절도 만들지 않고 넣지 못한 항목을 돌려준다", () => {
    const existing =
      "# AGENTS.md\n\n## 작업 전 읽을 문서\n\n| 상황 | 문서 |\n| --- | --- |\n| 설계 | [구조](docs/architecture.md) |\n\n## 핵심 규칙 요약\n\n- 팀 규칙\n";

    const result = mergeAgentsMd(existing, [language]);

    expect(result.content).toBe(existing);
    expect(result.added).toEqual({ docs: [], rules: [], verify: [] });
    expect(result.unplaced).toEqual({
      docs: language.docs,
      rules: language.rules,
      verify: [language.verify],
    });
  });

  it("문서 지도 절이 없어도 이미 있는 문서·규칙은 넣지 못한 항목에서 뺀다", () => {
    const existing =
      "# AGENTS.md\n\n## 읽을 문서\n\n- [방향](docs/project-direction.md)\n\n## 규칙\n\n- `any`, `as` 단언으로 타입 오류를 덮지 않는다.\n";

    const { unplaced } = mergeAgentsMd(existing, [language]);

    expect(unplaced.docs.map((doc) => doc.path)).toEqual(["docs/typescript.md"]);
    expect(unplaced.rules).toEqual([]);
  });

  it("./ 로 시작하는 링크도 이미 있는 문서로 본다", () => {
    const existing = "# AGENTS.md\n\n## 문서 지도\n\n- [흐름](./docs/workflow.md)\n";
    expect(mergeAgentsMd(existing, [git]).added.docs).toEqual(["docs/git-conventions.md"]);
  });

  it("합친 결과도 Prettier가 다시 고치지 않는 모양이다", async () => {
    const markdown = mergeAgentsMd(renderAgentsMd([language]), [git]).content;
    await expect(format(markdown, { parser: "markdown" })).resolves.toBe(markdown);
  });
});

describe("CLAUDE_MD", () => {
  it("AGENTS.md를 불러온다", () => {
    expect(CLAUDE_MD.startsWith("@AGENTS.md\n")).toBe(true);
  });
});
