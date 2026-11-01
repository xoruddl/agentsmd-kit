import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { checkRepository } from "../src/check.js";
import { DocMapNotFoundError } from "../src/errors.js";

let root: string;

/** 임시 저장소에 파일을 만든다. 경로는 루트 기준. */
async function write(files: Record<string, string>): Promise<void> {
  for (const [path, content] of Object.entries(files)) {
    await mkdir(dirname(join(root, path)), { recursive: true });
    await writeFile(join(root, path), content);
  }
}

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), "agentsmd-check-"));
});

afterEach(async () => {
  await rm(root, { recursive: true, force: true });
});

describe("checkRepository", () => {
  it("지도·문서·CLAUDE.md가 서로 맞으면 문제가 없다", async () => {
    await write({
      "AGENTS.md": "| [workflow](docs/workflow.md) | [모듈](docs/modules/) |",
      "CLAUDE.md": "@AGENTS.md\n",
      "docs/workflow.md": "# 작업 흐름",
      "docs/modules/alert.md": "# 알림",
    });
    await expect(checkRepository({ root })).resolves.toEqual([]);
  });

  it("세 규칙의 결과를 파일·줄 순서로 모아 돌려준다", async () => {
    await write({
      "AGENTS.md": ["# 지도", "[api](docs/api.md)", "[workflow](docs/workflow.md)"].join("\n"),
      "CLAUDE.md": "# Claude 전용 규칙\n",
      "docs/workflow.md": "",
      "docs/requirements.md": "",
    });

    const findings = await checkRepository({ root });

    expect(findings.map(({ ruleId, file, line }) => ({ ruleId, file, line }))).toEqual([
      { ruleId: "broken-link", file: "AGENTS.md", line: 2 },
      { ruleId: "claude-import", file: "CLAUDE.md", line: undefined },
      { ruleId: "unlisted-doc", file: "docs/requirements.md", line: undefined },
    ]);
  });

  it("docs 디렉터리나 CLAUDE.md가 없어도 검사할 수 있다", async () => {
    await write({ "AGENTS.md": "[README](README.md)", "README.md": "" });
    await expect(checkRepository({ root })).resolves.toEqual([]);
  });

  it("문서 지도 경로와 문서 디렉터리를 바꿀 수 있다", async () => {
    await write({
      "guide/AGENTS.md": "[설계](../design/a.md)",
      "design/a.md": "",
      "design/b.md": "",
    });

    const findings = await checkRepository({
      root,
      agentsFile: "guide/AGENTS.md",
      docsDir: "design",
    });

    expect(findings.map((finding) => finding.file)).toEqual(["design/b.md"]);
  });

  it("문서 지도가 없으면 DocMapNotFoundError를 던진다", async () => {
    await expect(checkRepository({ root })).rejects.toBeInstanceOf(DocMapNotFoundError);
  });
});
