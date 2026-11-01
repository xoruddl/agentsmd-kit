import { execFile } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { configureHooksPath } from "../src/git-hooks.js";

const git = promisify(execFile);
let dir: string;

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), "agentsmd-hooks-"));
});

afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

describe("configureHooksPath", () => {
  it("Git 저장소면 core.hooksPath를 설정한다", async () => {
    await git("git", ["-C", dir, "init", "-q"]);

    await expect(configureHooksPath(dir, ".githooks")).resolves.toBe("configured");

    const { stdout } = await git("git", ["-C", dir, "config", "core.hooksPath"]);
    expect(stdout.trim()).toBe(".githooks");
  });

  it("Git 저장소가 아니면 설정하지 않고 알려 준다", async () => {
    await expect(configureHooksPath(dir, ".githooks")).resolves.toBe("not-a-repo");
  });
});
