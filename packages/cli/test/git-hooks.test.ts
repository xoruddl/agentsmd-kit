import { execFile } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { configureHooksPath } from "../src/git-hooks.js";

const git = promisify(execFile);
let dir: string;

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), "agentsmd-hooks-"));
  // 전역 설정까지 합친 값을 읽으므로, 테스트를 돌리는 사람의 전역 core.hooksPath가 결과를 바꾸지 않게 한다.
  vi.stubEnv("GIT_CONFIG_GLOBAL", "/dev/null");
  vi.stubEnv("GIT_CONFIG_NOSYSTEM", "1");
});

afterEach(async () => {
  vi.unstubAllEnvs();
  await rm(dir, { recursive: true, force: true });
});

describe("configureHooksPath", () => {
  it("Git 저장소면 core.hooksPath를 설정한다", async () => {
    await git("git", ["-C", dir, "init", "-q"]);

    await expect(configureHooksPath(dir, ".githooks")).resolves.toEqual({ status: "configured" });

    const { stdout } = await git("git", ["-C", dir, "config", "core.hooksPath"]);
    expect(stdout.trim()).toBe(".githooks");
  });

  it("Git 저장소가 아니면 설정하지 않고 알려 준다", async () => {
    await expect(configureHooksPath(dir, ".githooks")).resolves.toEqual({ status: "not-a-repo" });
  });

  // husky처럼 다른 도구가 쓰는 훅 디렉터리를 바꾸면 그 훅이 조용히 꺼진다.
  it("이미 다른 값이면 바꾸지 않고 그 값을 돌려준다", async () => {
    await git("git", ["-C", dir, "init", "-q"]);
    await git("git", ["-C", dir, "config", "core.hooksPath", ".husky"]);

    await expect(configureHooksPath(dir, ".githooks")).resolves.toEqual({
      status: "kept",
      current: ".husky",
    });

    const { stdout } = await git("git", ["-C", dir, "config", "core.hooksPath"]);
    expect(stdout.trim()).toBe(".husky");
  });

  it("이미 같은 값이면 연결된 것으로 본다", async () => {
    await git("git", ["-C", dir, "init", "-q"]);
    await git("git", ["-C", dir, "config", "core.hooksPath", ".githooks"]);

    await expect(configureHooksPath(dir, ".githooks")).resolves.toEqual({ status: "configured" });
  });

  it.each([".githooks/", "./.githooks"])(
    "표기만 다른 같은 디렉터리(%s)는 연결된 것으로 보고 값을 그대로 둔다",
    async (current) => {
      await git("git", ["-C", dir, "init", "-q"]);
      await git("git", ["-C", dir, "config", "core.hooksPath", current]);

      await expect(configureHooksPath(dir, ".githooks")).resolves.toEqual({ status: "configured" });

      const { stdout } = await git("git", ["-C", dir, "config", "core.hooksPath"]);
      expect(stdout.trim()).toBe(current);
    },
  );

  // 전역으로 훅 디렉터리를 쓰는 사용자도 저장소 설정을 더하면 그 훅이 꺼진다.
  it("전역 설정에 다른 값이 있어도 바꾸지 않는다", async () => {
    const globalConfig = join(dir, "global.gitconfig");
    await writeFile(globalConfig, "[core]\n\thooksPath = /opt/hooks\n");
    vi.stubEnv("GIT_CONFIG_GLOBAL", globalConfig);
    await git("git", ["-C", dir, "init", "-q"]);

    await expect(configureHooksPath(dir, ".githooks")).resolves.toEqual({
      status: "kept",
      current: "/opt/hooks",
    });

    await expect(git("git", ["-C", dir, "config", "--local", "core.hooksPath"])).rejects.toThrow();
  });

  it("값이 비어 있으면 설정이 없는 것으로 보고 연결한다", async () => {
    await git("git", ["-C", dir, "init", "-q"]);
    await git("git", ["-C", dir, "config", "core.hooksPath", ""]);

    await expect(configureHooksPath(dir, ".githooks")).resolves.toEqual({ status: "configured" });

    const { stdout } = await git("git", ["-C", dir, "config", "core.hooksPath"]);
    expect(stdout.trim()).toBe(".githooks");
  });
});
