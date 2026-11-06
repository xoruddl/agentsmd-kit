import { access, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { checkRepository, installEntryFiles, installPreset } from "@agentsmd/core";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { reactPreset } from "../src/index.js";

let repo: string;

beforeEach(async () => {
  repo = await mkdtemp(join(tmpdir(), "agentsmd-preset-react-"));
  await installPreset(reactPreset, repo);
  // AGENTS.md는 init이 고른 프리셋에 맞게 만든다.
  await installEntryFiles([reactPreset], repo);
});

afterEach(async () => {
  await rm(repo, { recursive: true, force: true });
});

describe("reactPreset", () => {
  // 다른 프리셋 문서로 링크하면 이 프리셋만 설치했을 때 링크가 깨진다.
  it("React 프리셋만 설치해도 agentsmd check 규칙을 모두 통과한다", async () => {
    await expect(checkRepository({ root: repo })).resolves.toEqual([]);
  });

  it("검증 명령과 .nvmrc는 TypeScript 프리셋에 맡긴다", async () => {
    expect(reactPreset).not.toHaveProperty("verify");
    await expect(access(join(repo, ".nvmrc"))).rejects.toThrow();
  });

  it("Git 훅과 GitHub 설정은 설치하지 않는다", async () => {
    expect(reactPreset).not.toHaveProperty("hooksPath");
    await expect(access(join(repo, ".githooks"))).rejects.toThrow();
    await expect(access(join(repo, ".github"))).rejects.toThrow();
  });
});
