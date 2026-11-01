import { execFile } from "node:child_process";
import { access, constants, mkdtemp, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { checkRepository, installEntryFiles, installPreset } from "@agentsmd/core";
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
  await installPreset(typescriptPreset, repo);
  // AGENTS.md와 훅 실행기는 init이 고른 프리셋에 맞게 만든다.
  await installEntryFiles([typescriptPreset], repo);
});

afterEach(async () => {
  await rm(repo, { recursive: true, force: true });
});

describe("typescriptPreset", () => {
  it("TypeScript 프리셋만 설치해도 agentsmd check 규칙을 모두 통과한다", async () => {
    await expect(checkRepository({ root: repo })).resolves.toEqual([]);
  });

  it("설치한 훅 실행기가 Prettier 검사를 실행한다", async () => {
    await expect(readFile(join(repo, ".githooks/pre-commit"), "utf8")).resolves.toContain(
      "pre-commit.d",
    );
    await expect(
      access(join(repo, ".githooks/pre-commit.d/prettier"), constants.X_OK),
    ).resolves.toBeUndefined();
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
