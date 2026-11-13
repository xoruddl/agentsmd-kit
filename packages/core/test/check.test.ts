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

  describe("문서 디렉터리 안의 링크", () => {
    const base = {
      "AGENTS.md": "[workflow](docs/workflow.md) [모듈](docs/modules/)",
      "CLAUDE.md": "@AGENTS.md\n",
    };

    // 문서 이름을 바꾸고 그 문서를 가리키던 다른 문서를 고치지 않으면, 에이전트가 규칙을 읽다가 없는 문서를 찾게 된다.
    it("문서 안의 깨진 링크를 그 문서의 파일·줄로 보고한다", async () => {
      await write({
        ...base,
        "docs/workflow.md": ["# 작업 흐름", "", "리뷰는 [code-review.md](code-review.md)"].join(
          "\n",
        ),
        "docs/modules/alert.md": "",
      });

      const findings = await checkRepository({ root });

      expect(findings).toEqual([
        {
          ruleId: "broken-link",
          file: "docs/workflow.md",
          line: 3,
          message: "링크 대상이 없습니다: code-review.md",
        },
      ]);
    });

    it("링크는 그 링크가 적힌 문서의 위치를 기준으로 푼다", async () => {
      await write({
        ...base,
        "docs/workflow.md": "[알림](modules/alert.md) [소스](../src/main.ts)",
        "docs/modules/alert.md": "[흐름](../workflow.md) [README](/README.md)",
        "src/main.ts": "",
        "README.md": "",
      });
      await expect(checkRepository({ root })).resolves.toEqual([]);
    });

    it("코드 블록 안의 링크와 저장소 밖을 가리키는 링크는 검사하지 않는다", async () => {
      await write({
        ...base,
        "docs/workflow.md": [
          "```md",
          "[예시](없는-문서.md)",
          "```",
          "[옆 저장소](../../other/a.md)",
        ].join("\n"),
        "docs/modules/alert.md": "[사이트](https://example.com/a.md)",
      });
      await expect(checkRepository({ root })).resolves.toEqual([]);
    });

    it("지도에 없는 문서의 깨진 링크도 함께 알린다", async () => {
      await write({
        ...base,
        "docs/workflow.md": "",
        "docs/modules/alert.md": "",
        "docs/draft.md": "[없음](missing.md)",
      });

      const findings = await checkRepository({ root });

      // 줄이 없는 문제(파일 전체)가 같은 파일의 줄 있는 문제보다 먼저 온다.
      expect(findings.map(({ ruleId, file }) => ({ ruleId, file }))).toEqual([
        { ruleId: "unlisted-doc", file: "docs/draft.md" },
        { ruleId: "broken-link", file: "docs/draft.md" },
      ]);
    });

    it("문서 지도가 문서 디렉터리 안에 있어도 같은 링크를 두 번 보고하지 않는다", async () => {
      await write({
        "docs/AGENTS.md": "[자기 자신](AGENTS.md) [없음](missing.md)",
      });

      // `./docs/AGENTS.md`처럼 적어도 같은 파일로 알아본다.
      for (const agentsFile of ["docs/AGENTS.md", "./docs/AGENTS.md"]) {
        const findings = await checkRepository({ root, agentsFile });
        expect(findings.filter((finding) => finding.ruleId === "broken-link")).toHaveLength(1);
      }
    });
  });

  it("문서 지도가 없으면 DocMapNotFoundError를 던진다", async () => {
    await expect(checkRepository({ root })).rejects.toBeInstanceOf(DocMapNotFoundError);
  });
});
