import { describe, expect, it } from "vitest";
import { findMissingClaudeImport } from "../../src/rules/claude-import.js";

describe("findMissingClaudeImport", () => {
  it("CLAUDE.md가 없으면 검사하지 않는다", () => {
    expect(findMissingClaudeImport("CLAUDE.md", undefined, "AGENTS.md")).toEqual([]);
  });

  it("@AGENTS.md 한 줄로 불러오면 통과한다", () => {
    expect(findMissingClaudeImport("CLAUDE.md", "@AGENTS.md\n", "AGENTS.md")).toEqual([]);
  });

  it("./가 붙은 경로나 문장 중간의 import도 인정한다", () => {
    expect(findMissingClaudeImport("CLAUDE.md", "지침: @./AGENTS.md", "AGENTS.md")).toEqual([]);
  });

  it("AGENTS.md를 불러오지 않으면 보고한다", () => {
    expect(findMissingClaudeImport("CLAUDE.md", "# 규칙\n- 작게 커밋한다\n", "AGENTS.md")).toEqual([
      {
        ruleId: "claude-import",
        file: "CLAUDE.md",
        message: "@AGENTS.md 로 문서 지도를 불러오지 않습니다",
      },
    ]);
  });

  it("코드 블록 안의 예시는 import로 보지 않는다", () => {
    const content = ["```", "@AGENTS.md", "```"].join("\n");
    expect(findMissingClaudeImport("CLAUDE.md", content, "AGENTS.md")).toHaveLength(1);
  });

  it("이메일 주소처럼 단어 중간의 @는 import로 보지 않는다", () => {
    expect(findMissingClaudeImport("CLAUDE.md", "문의: me@AGENTS.md", "AGENTS.md")).toHaveLength(1);
  });
});
