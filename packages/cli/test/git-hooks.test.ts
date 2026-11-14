import { execFile } from "node:child_process";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { configureHooksPath, type HooksResult } from "../src/git-hooks.js";

const git = promisify(execFile);
const CONFIGURED = { status: "configured", path: ".githooks" };
let dir: string;

/**
 * 진짜 git 앞에 가짜 git을 끼운다. `arm`은 인자 하나에 맞춰 실행할 `case` 가지다.
 * 맞는 인자가 없으면 진짜 git으로 넘긴다. 오래된 Git이나 예상 밖의 출력을 흉내 낼 때 쓴다.
 */
async function useFakeGit(arm: string): Promise<void> {
  const path = process.env.PATH ?? "";
  const bin = join(dir, "fake-git");
  await mkdir(bin);
  await writeFile(
    join(bin, "git"),
    [
      "#!/bin/sh",
      'for arg in "$@"; do',
      '  case "$arg" in',
      `    ${arm}`,
      "  esac",
      "done",
      `PATH='${path}' exec git "$@"`,
      "",
    ].join("\n"),
    { mode: 0o755 },
  );
  vi.stubEnv("PATH", `${bin}:${path}`);
}

function detailOf(result: HooksResult): string {
  return result.status === "failed" ? result.detail : "";
}

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

    await expect(configureHooksPath(dir, ".githooks")).resolves.toEqual(CONFIGURED);

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
      path: ".githooks",
      current: ".husky",
      scope: "local",
    });

    const { stdout } = await git("git", ["-C", dir, "config", "core.hooksPath"]);
    expect(stdout.trim()).toBe(".husky");
  });

  it("이미 같은 값이면 연결된 것으로 본다", async () => {
    await git("git", ["-C", dir, "init", "-q"]);
    await git("git", ["-C", dir, "config", "core.hooksPath", ".githooks"]);

    await expect(configureHooksPath(dir, ".githooks")).resolves.toEqual(CONFIGURED);
  });

  it.each([".githooks/", "./.githooks"])(
    "표기만 다른 같은 디렉터리(%s)는 연결된 것으로 보고 값을 그대로 둔다",
    async (current) => {
      await git("git", ["-C", dir, "init", "-q"]);
      await git("git", ["-C", dir, "config", "core.hooksPath", current]);

      await expect(configureHooksPath(dir, ".githooks")).resolves.toEqual(CONFIGURED);

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
      path: ".githooks",
      current: "/opt/hooks",
      scope: "global",
    });

    await expect(git("git", ["-C", dir, "config", "--local", "core.hooksPath"])).rejects.toThrow();
  });

  it("절대 경로로 적힌 같은 디렉터리는 연결된 것으로 본다", async () => {
    await git("git", ["-C", dir, "init", "-q"]);
    await git("git", ["-C", dir, "config", "core.hooksPath", join(dir, ".githooks")]);

    await expect(configureHooksPath(dir, ".githooks")).resolves.toEqual(CONFIGURED);
  });

  // Git은 상대 경로인 core.hooksPath를 저장소 최상위 기준으로 해석한다.
  describe("저장소의 하위 디렉터리에 설치할 때", () => {
    let sub: string;

    beforeEach(async () => {
      await git("git", ["-C", dir, "init", "-q"]);
      sub = join(dir, "packages", "a");
      await mkdir(sub, { recursive: true });
    });

    it("최상위 기준 경로로 설정한다", async () => {
      await expect(configureHooksPath(sub, ".githooks")).resolves.toEqual({
        status: "configured",
        path: "packages/a/.githooks",
      });

      const { stdout } = await git("git", ["-C", dir, "config", "core.hooksPath"]);
      expect(stdout.trim()).toBe("packages/a/.githooks");
    });

    it("최상위의 같은 이름 디렉터리는 다른 값으로 보고 바꾸지 않는다", async () => {
      await git("git", ["-C", dir, "config", "core.hooksPath", ".githooks"]);

      await expect(configureHooksPath(sub, ".githooks")).resolves.toEqual({
        status: "kept",
        path: "packages/a/.githooks",
        current: ".githooks",
        scope: "local",
      });
    });

    it("이미 그 하위 디렉터리를 가리키면 연결된 것으로 본다", async () => {
      await git("git", ["-C", dir, "config", "core.hooksPath", "packages/a/.githooks"]);

      await expect(configureHooksPath(sub, ".githooks")).resolves.toEqual({
        status: "configured",
        path: "packages/a/.githooks",
      });
    });
  });

  // 읽지 못한 값을 "없음"으로 보면 기존 훅 설정을 덮어쓴다.
  it("기존 값을 읽지 못하면 덮어쓰지 않고 실패 이유를 돌려준다", async () => {
    await git("git", ["-C", dir, "init", "-q"]);
    await git("git", ["-C", dir, "config", "core.hooksPath", "~agentsmd-no-such-user/hooks"]);

    const result = await configureHooksPath(dir, ".githooks");

    expect(result.status).toBe("failed");
    expect(detailOf(result)).toContain("~agentsmd-no-such-user/hooks");
    const { stdout } = await git("git", ["-C", dir, "config", "core.hooksPath"]);
    expect(stdout.trim()).toBe("~agentsmd-no-such-user/hooks");
  });

  // 저장소인데 최상위를 알아내지 못한 것을 "저장소 아님"으로 보면 "git init 후 다시 실행하세요"라고 틀리게 안내한다.
  it("저장소 안이지만 작업 트리를 알아내지 못하면 저장소 아님으로 보지 않는다", async () => {
    await git("git", ["-C", dir, "init", "-q"]);

    const result = await configureHooksPath(join(dir, ".git"), ".githooks");

    expect(result.status).toBe("failed");
    expect(detailOf(result)).toContain("work tree");
  });

  // --show-scope는 Git 2.26, --type=path는 Git 2.18부터 있다. 그보다 오래된 Git에서도 연결과 기존 값 유지는 동작해야 한다.
  describe("--show-scope와 --type=path를 모르는 Git에서", () => {
    beforeEach(async () => {
      await git("git", ["-C", dir, "init", "-q"]);
      await useFakeGit('--show-scope | --type=path) echo "usage: git config" >&2; exit 129 ;;');
    });

    it("값이 없으면 연결한다", async () => {
      await expect(configureHooksPath(dir, ".githooks")).resolves.toEqual(CONFIGURED);
    });

    it("다른 값이면 적힌 곳 없이 그 값을 돌려준다", async () => {
      await git("git", ["-C", dir, "config", "core.hooksPath", ".husky"]);

      await expect(configureHooksPath(dir, ".githooks")).resolves.toEqual({
        status: "kept",
        path: ".githooks",
        current: ".husky",
        scope: "",
      });
    });
  });

  // 종료 코드가 0이어도 값을 읽어 내지 못했으면 "없음"이 아니다.
  it("--show-scope의 출력이 예상한 형식이 아니면 덮어쓰지 않고 실패 이유를 돌려준다", async () => {
    await git("git", ["-C", dir, "init", "-q"]);
    await useFakeGit("--show-scope) echo .husky; exit 0 ;;");

    const result = await configureHooksPath(dir, ".githooks");

    expect(result.status).toBe("failed");
    expect(detailOf(result)).toContain(".husky");
    await expect(git("git", ["-C", dir, "config", "--local", "core.hooksPath"])).rejects.toThrow();
  });

  // Git은 경고를 먼저 낼 수 있다. 첫 줄만 보이면 원인을 알 수 없다.
  it("Git이 경고를 먼저 내도 실패의 원인인 fatal 줄을 돌려준다", async () => {
    await git("git", ["-C", dir, "init", "-q"]);
    await useFakeGit(
      '--get) echo "warning: 무관한 경고" >&2; echo "fatal: 진짜 원인" >&2; exit 128 ;;',
    );

    await expect(configureHooksPath(dir, ".githooks")).resolves.toEqual({
      status: "failed",
      detail: "fatal: 진짜 원인",
    });
  });

  it("값이 비어 있으면 설정이 없는 것으로 보고 연결한다", async () => {
    await git("git", ["-C", dir, "init", "-q"]);
    await git("git", ["-C", dir, "config", "core.hooksPath", ""]);

    await expect(configureHooksPath(dir, ".githooks")).resolves.toEqual(CONFIGURED);

    const { stdout } = await git("git", ["-C", dir, "config", "core.hooksPath"]);
    expect(stdout.trim()).toBe(".githooks");
  });
});
