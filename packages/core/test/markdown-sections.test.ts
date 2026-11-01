import { describe, expect, it } from "vitest";
import { findSection, insertSection, lastContentLine } from "../src/markdown-sections.js";

const doc = [
  "# AGENTS.md",
  "",
  "## 문서 지도",
  "",
  "| a | b |",
  "",
  "## 검증",
  "",
  "```bash",
  "## 코드 블록 안의 줄",
  "```",
  "",
];

describe("findSection", () => {
  it("다음 제목 앞까지를 절로 본다", () => {
    expect(findSection(doc, "문서 지도")).toEqual({ start: 2, end: 6 });
  });

  it("코드 블록 안의 ## 줄은 제목으로 보지 않는다", () => {
    expect(findSection(doc, "검증")).toEqual({ start: 6, end: doc.length });
  });

  it("없는 절이면 undefined", () => {
    expect(findSection(doc, "핵심 규칙")).toBeUndefined();
  });
});

describe("lastContentLine", () => {
  it("절 끝의 빈 줄을 건너뛴다", () => {
    expect(lastContentLine(doc, { start: 2, end: 6 })).toBe(4);
  });
});

describe("insertSection", () => {
  it("before에 적힌 절 가운데 처음 나오는 절 앞에 넣는다", () => {
    const result = insertSection(doc, "핵심 규칙", ["1. 규칙"], ["검증", "지침 관리"]);
    expect(result.slice(6, 11)).toEqual(["## 핵심 규칙", "", "1. 규칙", "", "## 검증"]);
  });

  it("before의 절이 하나도 없으면 문서 끝에 빈 줄 하나를 두고 붙인다", () => {
    expect(insertSection(["# 제목", "", ""], "검증", ["본문"], ["지침 관리"])).toEqual([
      "# 제목",
      "",
      "## 검증",
      "",
      "본문",
      "",
    ]);
  });
});
