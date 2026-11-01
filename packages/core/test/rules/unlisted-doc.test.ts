import { describe, expect, it } from "vitest";
import { findUnlistedDocs } from "../../src/rules/unlisted-doc.js";
import type { DocMap } from "../../src/types.js";

const agents: DocMap = {
  file: "AGENTS.md",
  links: [
    { target: "docs/workflow.md", line: 5 },
    { target: "docs/modules/", line: 6 },
  ],
};

describe("findUnlistedDocs", () => {
  it("지도가 가리키는 문서는 보고하지 않는다", () => {
    expect(findUnlistedDocs([agents], ["docs/workflow.md"])).toEqual([]);
  });

  it("지도에 없는 문서를 보고한다", () => {
    expect(findUnlistedDocs([agents], ["docs/workflow.md", "docs/requirements.md"])).toEqual([
      {
        ruleId: "unlisted-doc",
        file: "docs/requirements.md",
        message: "문서 지도(AGENTS.md)에서 안내하지 않는 문서입니다",
      },
    ]);
  });

  it("지도가 디렉터리를 가리키면 그 아래 문서는 모두 안내된 것으로 본다", () => {
    expect(findUnlistedDocs([agents], ["docs/modules/alert.md", "docs/modules/user.md"])).toEqual(
      [],
    );
  });

  it("이름이 비슷한 다른 디렉터리까지 안내된 것으로 보지 않는다", () => {
    const findings = findUnlistedDocs([agents], ["docs/modules-old/alert.md"]);
    expect(findings.map((finding) => finding.file)).toEqual(["docs/modules-old/alert.md"]);
  });

  it("지도가 여럿이면 하나라도 가리킬 때 안내된 것으로 본다", () => {
    const sub: DocMap = { file: "docs/README.md", links: [{ target: "requirements.md", line: 3 }] };
    expect(findUnlistedDocs([agents, sub], ["docs/requirements.md"])).toEqual([]);
  });
});
