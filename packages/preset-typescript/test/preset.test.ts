import { execFile } from "node:child_process";
import { mkdtemp, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { checkRepository, installPreset, resolvePresets } from "@agentsmd/core";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { typescriptPreset } from "../src/index.js";

const exec = promisify(execFile);
// 이 저장소에 설치된 Prettier를 테스트 저장소에 연결해 실제 훅 동작을 확인한다.
const kitNodeModules = fileURLToPath(new URL("../../../node_modules", import.meta.url));
let repo: string;

async function runPrettierCheck(): Promise<number> {
  try {
    await exec(join(repo, ".githooks/pre-commit.d/prettier"), [], { cwd: repo });
    return 0;
  } catch (error) {
    return typeof error === "object" && error !== null && "code" in error ? Number(error.code) : -1;
  }
}

async function stage(path: string, content: string): Promise<void> {
  await writeFile(join(repo, path), content);
  await exec("git", ["add", path], { cwd: repo });
}

beforeEach(async () => {
  repo = await mkdtemp(join(tmpdir(), "agentsmd-preset-ts-"));
  await exec("git", ["init", "-q"], { cwd: repo });
  for (const preset of resolvePresets(typescriptPreset)) {
    await installPreset(preset, repo);
  }
});

afterEach(async () => {
  await rm(repo, { recursive: true, force: true });
});

describe("typescriptPreset", () => {
  it("공통 Git 프리셋을 먼저 설치하도록 요구한다", () => {
    expect(resolvePresets(typescriptPreset).map((preset) => preset.name)).toEqual([
      "git",
      "typescript",
    ]);
  });

  it("Git 프리셋과 함께 설치하면 agentsmd check 규칙을 모두 통과한다", async () => {
    await expect(checkRepository({ root: repo })).resolves.toEqual([]);
  });
});

describe("pre-commit.d/prettier", () => {
  beforeEach(async () => {
    await writeFile(join(repo, "package.json"), "{}\n");
    await symlink(kitNodeModules, join(repo, "node_modules"));
  });

  it("포맷이 맞는 파일만 스테이징됐으면 통과한다", async () => {
    await stage("ok.ts", "export const value = 1;\n");
    await expect(runPrettierCheck()).resolves.toBe(0);
  });

  it("포맷이 틀린 파일이 스테이징됐으면 막는다", async () => {
    await stage("bad.ts", "export   const value=1\n");
    await expect(runPrettierCheck()).resolves.toBe(1);
  });

  it("스테이징되지 않은 파일의 포맷은 검사하지 않는다", async () => {
    await writeFile(join(repo, "untracked.ts"), "export   const value=1\n");
    await stage("ok.ts", "export const value = 1;\n");
    await expect(runPrettierCheck()).resolves.toBe(0);
  });

  it("package.json이 없는 저장소에서는 검사하지 않는다", async () => {
    await rm(join(repo, "package.json"));
    await stage("bad.ts", "export   const value=1\n");
    await expect(runPrettierCheck()).resolves.toBe(0);
  });
});
