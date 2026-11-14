import type { MovedDoc, Preset } from "@agentsmd/core";
import { describe, expect, it } from "vitest";
import { findLegacyDocs } from "../src/legacy-docs.js";

function preset(name: string, moved?: readonly MovedDoc[]): Preset {
  return { name, description: "", filesDir: "", ...(moved === undefined ? {} : { moved }) };
}

const git = preset("git", [
  { from: "docs/workflow.md", to: "docs/git/workflow.md" },
  { from: "docs/code-review.md", to: "docs/git/code-review.md" },
]);
const java = preset("java", [{ from: "docs/lint-and-ci.md", to: "docs/java/lint-and-ci.md" }]);
const typescript = preset("typescript", [
  { from: "docs/lint-and-ci.md", to: "docs/typescript/lint-and-ci.md" },
]);

/** 주어진 경로만 있는 저장소. */
const repoWith =
  (...paths: string[]) =>
  (path: string): boolean =>
    paths.includes(path);

describe("findLegacyDocs", () => {
  it("옛 경로에 남아 있는 문서만 새 경로와 함께 돌려준다", () => {
    expect(findLegacyDocs([git], repoWith("docs/workflow.md", "docs/git/workflow.md"))).toEqual([
      { from: "docs/workflow.md", to: "docs/git/workflow.md" },
    ]);
  });

  it("옛 경로에 아무것도 없으면 빈 목록이다", () => {
    expect(findLegacyDocs([git, java], repoWith("docs/git/workflow.md"))).toEqual([]);
  });

  it("경로를 옮긴 적이 없는 프리셋은 건너뛴다", () => {
    expect(findLegacyDocs([preset("new")], () => true)).toEqual([]);
  });

  // 0.6 이하에서 java와 typescript가 같은 이름으로 설치하던 문서다. 어느 쪽 것인지는 내용을 봐야 안다.
  it("두 프리셋이 같은 옛 경로를 적었으면 둘 다 돌려준다", () => {
    expect(findLegacyDocs([java, typescript], repoWith("docs/lint-and-ci.md"))).toEqual([
      { from: "docs/lint-and-ci.md", to: "docs/java/lint-and-ci.md" },
      { from: "docs/lint-and-ci.md", to: "docs/typescript/lint-and-ci.md" },
    ]);
  });
});
