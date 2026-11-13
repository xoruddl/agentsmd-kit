import { access, mkdtemp, rm } from "node:fs/promises";
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
  // check가 문서끼리의 링크까지 보므로, 문서 4개가 서로 거는 링크도 여기서 함께 확인된다.
  it("Spring 프리셋만 설치해도 agentsmd check 규칙을 모두 통과한다", async () => {
    await expect(checkRepository({ root: repo })).resolves.toEqual([]);
  });

  it("검증 명령은 Java 프리셋에 맡긴다", () => {
    expect(springPreset).not.toHaveProperty("verify");
  });

  // spring만 설치하면 AGENTS.md에 검증 절이 없으므로, java 프리셋이 필요하다고 적어 init이 함께 설치하게 한다.
  it("java 프리셋을 필요로 한다", () => {
    expect(springPreset.requires).toEqual(["java"]);
  });

  it("Git 훅과 GitHub 설정은 설치하지 않는다", async () => {
    expect(springPreset).not.toHaveProperty("hooksPath");
    await expect(access(join(repo, ".githooks"))).rejects.toThrow();
    await expect(access(join(repo, ".github"))).rejects.toThrow();
  });
});
