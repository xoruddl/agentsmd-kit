import { access, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { checkRepository, installEntryFiles, installPreset } from "@agentsmd/core";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { typescriptPreset } from "../src/index.js";

let repo: string;

beforeEach(async () => {
  repo = await mkdtemp(join(tmpdir(), "agentsmd-preset-ts-"));
  await installPreset(typescriptPreset, repo);
  // AGENTS.md는 init이 고른 프리셋에 맞게 만든다.
  await installEntryFiles([typescriptPreset], repo);
});

afterEach(async () => {
  await rm(repo, { recursive: true, force: true });
});

describe("typescriptPreset", () => {
  it("TypeScript 프리셋만 설치해도 agentsmd check 규칙을 모두 통과한다", async () => {
    await expect(checkRepository({ root: repo })).resolves.toEqual([]);
  });

  // React 규칙은 react 프리셋이 맡는다. TS 백엔드·라이브러리 저장소에도 그대로 쓸 수 있어야 한다.
  it("React 화면 규칙은 넣지 않는다", () => {
    const text = [
      typescriptPreset.description,
      ...typescriptPreset.docs.map((doc) => doc.when),
      ...typescriptPreset.rules,
    ].join("\n");
    expect(text).not.toMatch(/React|컴포넌트|접근성|<button>/);
  });

  it("Git 훅과 GitHub 설정은 설치하지 않는다", async () => {
    expect(typescriptPreset).not.toHaveProperty("hooksPath");
    await expect(access(join(repo, ".githooks"))).rejects.toThrow();
    await expect(access(join(repo, ".github"))).rejects.toThrow();
  });
});
