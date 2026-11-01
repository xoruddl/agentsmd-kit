import { describe, expect, it } from "vitest";
import { resolveLink } from "../src/resolve-link.js";

describe("resolveLink", () => {
  it("루트 문서의 링크는 그대로 저장소 경로가 된다", () => {
    expect(resolveLink("AGENTS.md", "docs/git-conventions.md")).toBe("docs/git-conventions.md");
  });

  it("하위 디렉터리 문서의 링크는 그 문서 위치를 기준으로 푼다", () => {
    expect(resolveLink("docs/workflow.md", "commit-convention.md")).toBe(
      "docs/commit-convention.md",
    );
    expect(resolveLink("docs/workflow.md", "../AGENTS.md")).toBe("AGENTS.md");
  });

  it("/로 시작하면 저장소 루트 기준으로 본다", () => {
    expect(resolveLink("docs/workflow.md", "/README.md")).toBe("README.md");
  });

  it("./와 디렉터리 끝의 /를 정리한다", () => {
    expect(resolveLink("AGENTS.md", "./.github/ISSUE_TEMPLATE/")).toBe(".github/ISSUE_TEMPLATE");
  });

  it("저장소 밖을 가리키면 확인할 수 없으므로 undefined를 돌려준다", () => {
    expect(resolveLink("AGENTS.md", "../menu-pick-frontend")).toBeUndefined();
    expect(resolveLink("docs/a.md", "../../other/README.md")).toBeUndefined();
  });
});
