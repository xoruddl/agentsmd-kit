import { access, constants, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { checkRepository, installEntryFiles, installPreset, resolvePresets } from "@agentsmd/core";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { javaPreset } from "../src/index.js";

let target: string;

beforeEach(async () => {
  target = await mkdtemp(join(tmpdir(), "agentsmd-preset-java-"));
  const presets = resolvePresets(javaPreset);
  for (const preset of presets) {
    await installPreset(preset, target);
  }
  // AGENTS.md와 훅 실행기는 init이 고른 프리셋에 맞게 만든다.
  await installEntryFiles(presets, target);
});

afterEach(async () => {
  await rm(target, { recursive: true, force: true });
});

describe("javaPreset", () => {
  it("공통 Git 프리셋을 먼저 설치하도록 요구한다", () => {
    expect(resolvePresets(javaPreset).map((preset) => preset.name)).toEqual(["git", "java"]);
  });

  // 설치 직후의 저장소가 바로 CI를 통과하도록, 요구하는 프리셋까지 설치한 결과를 이 도구로 검사한다.
  it("Git 프리셋과 함께 설치하면 agentsmd check 규칙을 모두 통과한다", async () => {
    await expect(checkRepository({ root: target })).resolves.toEqual([]);
  });

  it("설치된 Git 훅이 실행 권한을 가진다", async () => {
    for (const hook of ["pre-commit.d/max-files", "commit-msg"]) {
      await expect(
        access(join(target, ".githooks", hook), constants.X_OK),
      ).resolves.toBeUndefined();
    }
  });
});
