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

    expect(result).toEqual({ written: ["AGENTS.md", "CLAUDE.md"], skipped: [], merged: undefined });
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

  it("이미 있는 AGENTS.md에는 빠진 문서만 합치고 사람이 쓴 내용은 남긴다", async () => {
    await writeFile(
      join(target, "AGENTS.md"),
      "# 사람이 다듬은 지도\n\n- 팀 메모\n\n## 문서 지도\n\n## 지침 관리\n",
    );

    const result = await installEntryFiles([docsOnly], target);

    expect(result.merged).toEqual({ docs: ["docs/workflow.md"], rules: [], verify: [] });
    expect(result.written).not.toContain("AGENTS.md");
    expect(result.skipped).not.toContain("AGENTS.md");
    const agents = await readFile(join(target, "AGENTS.md"), "utf8");
    expect(agents).toContain("- 팀 메모");
    expect(agents).toContain("[docs/workflow.md](docs/workflow.md)");
  });

  it("프리셋을 나눠 설치해도 순서와 상관없이 모든 문서가 지도에 오른다", async () => {
    const other = {
      ...docsOnly,
      name: "other",
      docs: [{ path: "docs/other.md", when: "다른 작업" }],
    } satisfies Preset;

    await installEntryFiles([other], target);
    await installEntryFiles([docsOnly], target);

    const agents = await readFile(join(target, "AGENTS.md"), "utf8");
    expect(agents).toContain("[docs/other.md](docs/other.md)");
    expect(agents).toContain("[docs/workflow.md](docs/workflow.md)");
  });

  it("다른 프리셋을 나중에 설치할 때, 내용이 같은 CLAUDE.md·훅 실행기는 건너뛴 목록에 넣지 않는다", async () => {
    await installEntryFiles([withHooks], target);

    const result = await installEntryFiles([docsOnly, withHooks], target);

    expect(result.written).toEqual([]);
    expect(result.skipped).toEqual([]);
  });

  it("더할 것이 없으면 AGENTS.md를 건드리지 않는다", async () => {
    await installEntryFiles([docsOnly], target);
    const before = await stat(join(target, "AGENTS.md"));

    const result = await installEntryFiles([docsOnly], target);

    expect(result.merged).toEqual({ docs: [], rules: [], verify: [] });
    expect((await stat(join(target, "AGENTS.md"))).mtimeMs).toBe(before.mtimeMs);
  });

  it("다른 파일은 이미 있으면 건너뛰고, force면 AGENTS.md까지 새로 쓴다", async () => {
    await writeFile(join(target, "AGENTS.md"), "# 옛 지도\n");
    await writeFile(join(target, "CLAUDE.md"), "# 사람이 쓴 CLAUDE.md\n");

    await expect(installEntryFiles([docsOnly], target)).resolves.toMatchObject({
      skipped: ["CLAUDE.md"],
    });

    const forced = await installEntryFiles([docsOnly], target, { force: true });
    expect(forced).toMatchObject({ written: ["AGENTS.md", "CLAUDE.md"], merged: undefined });
    await expect(readFile(join(target, "AGENTS.md"), "utf8")).resolves.not.toContain("옛 지도");
  });
});
