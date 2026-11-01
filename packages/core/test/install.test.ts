import { chmod, mkdir, mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { installPreset } from "../src/install.js";
import type { Preset } from "../src/preset.js";

let base: string;
let preset: Preset;
let target: string;

async function write(dir: string, files: Record<string, string>): Promise<void> {
  for (const [path, content] of Object.entries(files)) {
    await mkdir(dirname(join(dir, path)), { recursive: true });
    await writeFile(join(dir, path), content);
  }
}

beforeEach(async () => {
  base = await mkdtemp(join(tmpdir(), "agentsmd-install-"));
  preset = { name: "test", description: "테스트용", filesDir: join(base, "preset") };
  target = join(base, "target");
  await write(preset.filesDir, {
    "AGENTS.md": "# 지도",
    "docs/workflow.md": "# 흐름",
    ".githooks/pre-commit": "#!/bin/sh\nexit 0\n",
  });
  await chmod(join(preset.filesDir, ".githooks/pre-commit"), 0o755);
});

afterEach(async () => {
  await rm(base, { recursive: true, force: true });
});

describe("installPreset", () => {
  it("프리셋 파일을 같은 경로 구조로 복사한다", async () => {
    const result = await installPreset(preset, target);

    expect(result).toEqual({
      written: [".githooks/pre-commit", "AGENTS.md", "docs/workflow.md"],
      skipped: [],
    });
    await expect(readFile(join(target, "docs/workflow.md"), "utf8")).resolves.toBe("# 흐름");
  });

  it("Git 훅의 실행 권한을 유지한다", async () => {
    await installPreset(preset, target);
    const mode = (await stat(join(target, ".githooks/pre-commit"))).mode;
    expect(mode & 0o111).not.toBe(0);
  });

  it("이미 있는 파일은 기본으로 건너뛰어 내용을 지킨다", async () => {
    await write(target, { "AGENTS.md": "# 사람이 다듬은 지도" });

    const result = await installPreset(preset, target);

    expect(result.skipped).toEqual(["AGENTS.md"]);
    await expect(readFile(join(target, "AGENTS.md"), "utf8")).resolves.toBe("# 사람이 다듬은 지도");
  });

  it("force면 이미 있는 파일도 덮어쓴다", async () => {
    await write(target, { "AGENTS.md": "# 옛 지도" });

    const result = await installPreset(preset, target, { force: true });

    expect(result.skipped).toEqual([]);
    await expect(readFile(join(target, "AGENTS.md"), "utf8")).resolves.toBe("# 지도");
  });
});
