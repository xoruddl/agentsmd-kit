import { mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { installEntryFiles } from "../src/install-entry-files.js";
import { PRE_COMMIT_HOOK } from "../src/pre-commit-hook.js";
import type { Preset } from "../src/preset.js";

const docsOnly = {
  name: "docs",
  description: "",
  filesDir: "",
  docs: [{ path: "docs/workflow.md", when: "모든 작업 시작 전" }],
} satisfies Preset;
const withHooks = { ...docsOnly, name: "hooks", hooksPath: ".githooks" } satisfies Preset;

let target: string;

beforeEach(async () => {
  target = await mkdtemp(join(tmpdir(), "agentsmd-entry-"));
});

afterEach(async () => {
  await rm(target, { recursive: true, force: true });
});

describe("installEntryFiles", () => {
  it("고른 프리셋의 문서 지도로 AGENTS.md를, 그것을 불러오는 CLAUDE.md를 만든다", async () => {
    const result = await installEntryFiles([docsOnly], target);

    expect(result).toEqual({ written: ["AGENTS.md", "CLAUDE.md"], skipped: [] });
    await expect(readFile(join(target, "AGENTS.md"), "utf8")).resolves.toContain(
      "[docs/workflow.md](docs/workflow.md)",
    );
    await expect(readFile(join(target, "CLAUDE.md"), "utf8")).resolves.toContain("@AGENTS.md");
  });

  it("훅이 있는 프리셋을 고르면 실행 권한이 있는 pre-commit 실행기를 만든다", async () => {
    const result = await installEntryFiles([docsOnly, withHooks], target);

    expect(result.written).toContain(".githooks/pre-commit");
    const hook = join(target, ".githooks/pre-commit");
    await expect(readFile(hook, "utf8")).resolves.toBe(PRE_COMMIT_HOOK);
    expect((await stat(hook)).mode & 0o111).not.toBe(0);
  });

  it("훅이 있는 프리셋이 없으면 pre-commit을 만들지 않는다", async () => {
    const result = await installEntryFiles([docsOnly], target);
    expect(result.written).not.toContain(".githooks/pre-commit");
  });

  it("이미 있는 파일은 건너뛰고, force면 덮어쓴다", async () => {
    await writeFile(join(target, "AGENTS.md"), "# 사람이 다듬은 지도");

    await expect(installEntryFiles([docsOnly], target)).resolves.toMatchObject({
      skipped: ["AGENTS.md"],
    });
    await expect(readFile(join(target, "AGENTS.md"), "utf8")).resolves.toBe("# 사람이 다듬은 지도");

    await installEntryFiles([docsOnly], target, { force: true });
    await expect(readFile(join(target, "AGENTS.md"), "utf8")).resolves.toContain("## 문서 지도");
  });
});
