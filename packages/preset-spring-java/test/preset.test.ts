import { access, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { checkRepository, installEntryFiles, installPreset } from "@agentsmd/core";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { springJavaPreset } from "../src/index.js";

let repo: string;

beforeEach(async () => {
  repo = await mkdtemp(join(tmpdir(), "agentsmd-preset-spring-java-"));
  await installPreset(springJavaPreset, repo);
  // AGENTS.md는 init이 고른 프리셋에 맞게 만든다.
  await installEntryFiles([springJavaPreset], repo);
});

afterEach(async () => {
  await rm(repo, { recursive: true, force: true });
});

describe("springJavaPreset", () => {
  // 다른 프리셋 문서로 링크하면 이 프리셋만 설치했을 때 링크가 깨진다.
  // check가 문서끼리의 링크까지 보므로, 문서 4개가 서로 거는 링크도 여기서 함께 확인된다.
  it("이 프리셋만 설치해도 agentsmd check 규칙을 모두 통과한다", async () => {
    await expect(checkRepository({ root: repo })).resolves.toEqual([]);
  });

  // 예제와 규칙이 Java 문법을 전제한다. 이름만 보고 Kotlin 프로젝트에 고르지 않게 언어를 적는다.
  it("이름과 문서 폴더에 언어를 적는다", () => {
    expect(springJavaPreset.name).toBe("spring-java");
    for (const { path } of springJavaPreset.docs) {
      expect(path).toMatch(/^docs\/spring-java\//);
    }
  });

  it("검증 명령은 Java 프리셋에 맡긴다", () => {
    expect(springJavaPreset).not.toHaveProperty("verify");
  });

  // 이 프리셋만 설치하면 AGENTS.md에 검증 절이 없으므로, java 프리셋이 필요하다고 적어 init이 함께 설치하게 한다.
  it("java 프리셋을 필요로 한다", () => {
    expect(springJavaPreset.requires).toEqual(["java"]);
  });

  it("Git 훅과 GitHub 설정은 설치하지 않는다", async () => {
    expect(springJavaPreset).not.toHaveProperty("hooksPath");
    await expect(access(join(repo, ".githooks"))).rejects.toThrow();
    await expect(access(join(repo, ".github"))).rejects.toThrow();
  });
});
