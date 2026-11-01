import { access, constants, mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { makeHooksExecutable } from "../src/hook-permissions.js";

let root: string;

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), "agentsmd-perm-"));
});

afterEach(async () => {
  await rm(root, { recursive: true, force: true });
});

describe("makeHooksExecutable", () => {
  // npm 패키지에서 풀린 파일처럼 실행 권한 없이(0644) 만든 뒤 확인한다.
  it("하위 디렉터리까지 훅 파일 전부에 실행 권한을 준다", async () => {
    await mkdir(join(root, ".githooks/pre-commit.d"), { recursive: true });
    await writeFile(join(root, ".githooks/pre-commit"), "#!/bin/sh\n", { mode: 0o644 });
    await writeFile(join(root, ".githooks/pre-commit.d/prettier"), "#!/bin/sh\n", { mode: 0o644 });

    await expect(makeHooksExecutable(root, ".githooks")).resolves.toBe(2);

    for (const file of [".githooks/pre-commit", ".githooks/pre-commit.d/prettier"]) {
      await expect(access(join(root, file), constants.X_OK)).resolves.toBeUndefined();
    }
  });

  it("훅 디렉터리가 없으면 아무것도 하지 않는다", async () => {
    await expect(makeHooksExecutable(root, ".githooks")).resolves.toBe(0);
  });
});
