import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { checkRepository, installEntryFiles, installPreset } from "@agentsmd/core";
import { describe, expect, it } from "vitest";
import { gitPreset } from "../src/index.js";

async function read(path: string): Promise<string> {
  return readFile(join(gitPreset.filesDir, path), "utf8");
}

describe("gitPreset", () => {
  // 커밋 훅과 PR 검사가 서로 다른 타입을 허용하면, 로컬에서 통과한 커밋이 PR에서 막힌다.
  it("commit-msg 훅과 check-pr의 타입 목록이 같다", async () => {
    const typesOf = async (path: string) => /types='([^']+)'/.exec(await read(path))?.[1];
    const hookTypes = await typesOf(".githooks/commit-msg");

    expect(hookTypes).toBeDefined();
    expect(hookTypes).toBe(await typesOf(".githooks/check-pr"));
  });

  // 문서 지도는 init이 고른 프리셋들의 docs를 합쳐 만든다. 파일로 담으면 다른 프리셋과 함께 설치할 때 덮이거나 빠진다.
  it("AGENTS.md를 파일로 담지 않는다", async () => {
    await expect(read("AGENTS.md")).rejects.toThrow();
  });

  it("Git 프리셋만 설치해도 agentsmd check 규칙을 모두 통과한다", async () => {
    const target = await mkdtemp(join(tmpdir(), "agentsmd-preset-git-"));
    try {
      await installPreset(gitPreset, target);
      await installEntryFiles([gitPreset], target);
      await expect(checkRepository({ root: target })).resolves.toEqual([]);
    } finally {
      await rm(target, { recursive: true, force: true });
    }
  });
});
