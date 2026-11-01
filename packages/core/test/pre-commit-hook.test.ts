import { execFile } from "node:child_process";
import { chmod, mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { PRE_COMMIT_HOOK } from "../src/pre-commit-hook.js";

const exec = promisify(execFile);
let hooksDir: string;

async function addCheck(name: string, script: string, mode = 0o755): Promise<void> {
  const checks = join(hooksDir, "pre-commit.d");
  await mkdir(checks, { recursive: true });
  await writeFile(join(checks, name), script);
  await chmod(join(checks, name), mode);
}

/** 실행기를 돌리고 종료 코드와 출력을 돌려준다. 실패해도 예외를 던지지 않는다. */
async function runHook(): Promise<{ code: number; output: string }> {
  try {
    const { stdout } = await exec(join(hooksDir, "pre-commit"), { cwd: hooksDir });
    return { code: 0, output: stdout };
  } catch (error) {
    if (typeof error !== "object" || error === null) {
      return { code: -1, output: String(error) };
    }
    const code = "code" in error && typeof error.code === "number" ? error.code : -1;
    const stderr = "stderr" in error && typeof error.stderr === "string" ? error.stderr : "";
    return { code, output: stderr };
  }
}

beforeEach(async () => {
  hooksDir = await mkdtemp(join(tmpdir(), "agentsmd-pre-commit-"));
  await writeFile(join(hooksDir, "pre-commit"), PRE_COMMIT_HOOK);
  await chmod(join(hooksDir, "pre-commit"), 0o755);
});

afterEach(async () => {
  await rm(hooksDir, { recursive: true, force: true });
});

describe("PRE_COMMIT_HOOK", () => {
  it("검사가 없으면 통과한다", async () => {
    await expect(runHook()).resolves.toMatchObject({ code: 0 });
  });

  it("검사를 이름 순서로 모두 실행한다", async () => {
    await addCheck("b", "#!/usr/bin/env bash\necho b\n");
    await addCheck("a", "#!/usr/bin/env bash\necho a\n");
    await expect(runHook()).resolves.toEqual({ code: 0, output: "a\nb\n" });
  });

  it("검사가 실패하면 커밋을 막고 검사의 출력을 그대로 전한다", async () => {
    await addCheck("fail", "#!/usr/bin/env bash\necho '포맷 위반' >&2\nexit 1\n");
    const result = await runHook();
    expect(result.code).toBe(1);
    expect(result.output).toContain("포맷 위반");
  });

  it("실행 권한이 없는 파일은 검사로 실행하지 않는다", async () => {
    await addCheck("README", "검사 스크립트를 두는 곳\n", 0o644);
    await expect(runHook()).resolves.toMatchObject({ code: 0 });
  });
});
