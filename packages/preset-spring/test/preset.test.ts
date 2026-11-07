import { access, mkdtemp, readdir, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { checkRepository, installEntryFiles, installPreset } from "@agentsmd/core";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { springPreset } from "../src/index.js";

let repo: string;

beforeEach(async () => {
  repo = await mkdtemp(join(tmpdir(), "agentsmd-preset-spring-"));
  await installPreset(springPreset, repo);
  // AGENTS.md는 init이 고른 프리셋에 맞게 만든다.
  await installEntryFiles([springPreset], repo);
});

afterEach(async () => {
  await rm(repo, { recursive: true, force: true });
});

describe("springPreset", () => {
  // 다른 프리셋 문서로 링크하면 이 프리셋만 설치했을 때 링크가 깨진다.
  it("Spring 프리셋만 설치해도 agentsmd check 규칙을 모두 통과한다", async () => {
    await expect(checkRepository({ root: repo })).resolves.toEqual([]);
  });

  // check는 AGENTS.md의 링크만 본다. 문서끼리의 링크는 여기서 확인한다.
  it("문서 안의 상대 링크는 이 프리셋이 설치한 문서만 가리킨다", async () => {
    const docsDir = join(repo, "docs");
    for (const name of await readdir(docsDir)) {
      const text = await readFile(join(docsDir, name), "utf8");
      for (const match of text.matchAll(/\]\(([^)#\s:]+\.md)(?:#[^)]*)?\)/g)) {
        const target = match[1];
        if (target === undefined) continue;
        await expect(access(join(docsDir, target)), `${name} → ${target}`).resolves.toBeUndefined();
      }
    }
  });

  it("검증 명령은 Java 프리셋에 맡긴다", () => {
    expect(springPreset).not.toHaveProperty("verify");
  });

  // spring만 설치하면 AGENTS.md에 검증 절이 없으므로, 설치 후 안내에서 java 프리셋을 알린다.
  it("설치 후 안내에서 java 프리셋을 함께 설치하라고 알린다", () => {
    expect(springPreset.nextSteps).toContainEqual(
      expect.stringContaining("agentsmd init --preset java"),
    );
  });

  it("Git 훅과 GitHub 설정은 설치하지 않는다", async () => {
    expect(springPreset).not.toHaveProperty("hooksPath");
    await expect(access(join(repo, ".githooks"))).rejects.toThrow();
    await expect(access(join(repo, ".github"))).rejects.toThrow();
  });
});
