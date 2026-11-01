import { format } from "prettier";
import { describe, expect, it } from "vitest";
import { displayWidth, formatTable, parseTableRow } from "../src/markdown-table.js";

describe("displayWidth", () => {
  it("한글은 2칸, 영문·기호는 1칸으로 센다", () => {
    expect(displayWidth("abc")).toBe(3);
    expect(displayWidth("문서")).toBe(4);
    expect(displayWidth("이슈·PR")).toBe(7);
  });
});

describe("parseTableRow", () => {
  it("양 끝 세로선을 떼고 칸마다 공백을 다듬는다", () => {
    expect(parseTableRow("| [a](a.md)   | 읽는 시점 |")).toEqual(["[a](a.md)", "읽는 시점"]);
  });

  it("이스케이프한 세로선은 칸 안의 글자로 둔다", () => {
    expect(parseTableRow("| a \\| b | c |")).toEqual(["a \\| b", "c"]);
  });
});

describe("formatTable", () => {
  it("열 너비를 가장 긴 칸에 맞춘다", () => {
    expect(formatTable(["a", "b"], [["long text", "x"]])).toBe(
      ["| a         | b   |", "| --------- | --- |", "| long text | x   |"].join("\n"),
    );
  });

  // 대상 저장소의 format:check에 걸리지 않는지 실제 Prettier로 확인한다.
  it("한글이 섞여도 Prettier가 다시 고치지 않는 모양이다", async () => {
    const table = formatTable(
      ["문서", "읽는 시점"],
      [
        ["[docs/workflow.md](docs/workflow.md)", "모든 작업 시작 전 (필수)"],
        ["[docs/code-review.md](docs/code-review.md)", "PR 리뷰 확인·반영"],
      ],
    );
    const markdown = `${table}\n`;

    await expect(format(markdown, { parser: "markdown" })).resolves.toBe(markdown);
  });
});
