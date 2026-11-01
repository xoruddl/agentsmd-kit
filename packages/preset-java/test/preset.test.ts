import { access, constants, mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { checkRepository, installEntryFiles, installPreset } from "@agentsmd/core";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { javaPreset } from "../src/index.js";

let target: string;

beforeEach(async () => {
  target = await mkdtemp(join(tmpdir(), "agentsmd-preset-java-"));
  await installPreset(javaPreset, target);
  // AGENTS.md와 훅 실행기는 init이 고른 프리셋에 맞게 만든다.
  await installEntryFiles([javaPreset], target);
});

afterEach(async () => {
  await rm(target, { recursive: true, force: true });
});

describe("javaPreset", () => {
  // 설치 직후의 저장소가 바로 CI를 통과하도록, 설치 결과를 이 도구로 검사한다.
  it("Java 프리셋만 설치해도 agentsmd check 규칙을 모두 통과한다", async () => {
    await expect(checkRepository({ root: target })).resolves.toEqual([]);
  });

  it("설치한 훅 실행기가 Spotless 검사를 실행한다", async () => {
    await expect(readFile(join(target, ".githooks/pre-commit"), "utf8")).resolves.toContain(
      "pre-commit.d",
    );
    await expect(
      access(join(target, ".githooks/pre-commit.d/spotless"), constants.X_OK),
    ).resolves.toBeUndefined();
  });
});
