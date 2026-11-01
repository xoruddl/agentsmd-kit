import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { gitPreset } from "../src/index.js";

async function read(path: string): Promise<string> {
  return readFile(join(gitPreset.filesDir, path), "utf8");
}

describe("gitPreset", () => {
  it("다른 프리셋을 요구하지 않는다", () => {
    expect(gitPreset).not.toHaveProperty("requires");
  });

  // 로컬 훅과 CI가 서로 다른 타입을 허용하면, 로컬에서 통과한 커밋이 PR에서 막힌다.
  it("commit-msg 훅과 Conventions 워크플로의 타입 목록이 같다", async () => {
    const hookTypes = /types='([^']+)'/.exec(await read(".githooks/commit-msg"))?.[1];
    const workflowTypes = /TYPES: (\S+)/.exec(await read(".github/workflows/conventions.yml"))?.[1];

    expect(hookTypes).toBeDefined();
    expect(hookTypes).toBe(workflowTypes);
  });

  it("문서 지도는 언어 프리셋이 가지므로 AGENTS.md를 담지 않는다", async () => {
    await expect(read("AGENTS.md")).rejects.toThrow();
  });
});
