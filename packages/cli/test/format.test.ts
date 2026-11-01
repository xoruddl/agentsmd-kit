import { describe, expect, it } from "vitest";
import { formatFindings } from "../src/format.js";

describe("formatFindings", () => {
  it("문제가 없으면 한 줄로 알린다", () => {
    expect(formatFindings([])).toBe("문제 없음\n");
  });

  it("문제마다 파일:줄, 규칙, 메시지를 한 줄로 적고 건수를 붙인다", () => {
    const output = formatFindings([
      {
        ruleId: "broken-link",
        file: "AGENTS.md",
        line: 12,
        message: "링크 대상이 없습니다: docs/api.md",
      },
      {
        ruleId: "unlisted-doc",
        file: "docs/requirements.md",
        message: "문서 지도(AGENTS.md)에서 안내하지 않는 문서입니다",
      },
    ]);

    expect(output).toBe(
      [
        "AGENTS.md:12  [broken-link]  링크 대상이 없습니다: docs/api.md",
        "docs/requirements.md  [unlisted-doc]  문서 지도(AGENTS.md)에서 안내하지 않는 문서입니다",
        "",
        "문제 2건",
        "",
      ].join("\n"),
    );
  });
});
