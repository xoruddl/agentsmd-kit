import { describe, expect, it } from "vitest";
import { findBrokenLinks } from "../../src/rules/broken-link.js";
import type { DocMap } from "../../src/types.js";

const existing = new Set(["README.md", "docs/git-conventions.md", ".github/ISSUE_TEMPLATE"]);
const exists = (repoPath: string) => existing.has(repoPath);

describe("findBrokenLinks", () => {
  it("모든 링크 대상이 있으면 아무것도 보고하지 않는다", () => {
    const map: DocMap = {
      file: "AGENTS.md",
      links: [
        { target: "README.md", line: 5 },
        { target: ".github/ISSUE_TEMPLATE/", line: 6 },
      ],
    };
    expect(findBrokenLinks(map, exists)).toEqual([]);
  });

  it("없는 대상을 가리키는 링크를 줄 번호와 함께 보고한다", () => {
    const map: DocMap = {
      file: "AGENTS.md",
      links: [
        { target: "docs/git-conventions.md", line: 7 },
        { target: "docs/api.md", line: 12 },
      ],
    };
    expect(findBrokenLinks(map, exists)).toEqual([
      {
        ruleId: "broken-link",
        file: "AGENTS.md",
        line: 12,
        message: "링크 대상이 없습니다: docs/api.md",
      },
    ]);
  });

  it("하위 디렉터리 문서의 링크는 그 문서 위치를 기준으로 확인한다", () => {
    const map: DocMap = { file: "docs/workflow.md", links: [{ target: "../README.md", line: 1 }] };
    expect(findBrokenLinks(map, exists)).toEqual([]);
  });

  it("저장소 밖을 가리키는 링크는 확인할 수 없으므로 건너뛴다", () => {
    const map: DocMap = {
      file: "AGENTS.md",
      links: [{ target: "../menu-pick-frontend", line: 3 }],
    };
    expect(findBrokenLinks(map, exists)).toEqual([]);
  });
});
