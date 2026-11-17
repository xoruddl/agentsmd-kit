import { access, mkdtemp, readFile, rm } from "node:fs/promises";
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

  it("검증 명령은 Java 프리셋에 맡긴다", () => {
    expect(springJavaPreset).not.toHaveProperty("verify");
  });

  // 이 프리셋만 설치하면 AGENTS.md에 검증 절이 없으므로, java 프리셋이 필요하다고 적어 init이 함께 설치하게 한다.
  it("java 프리셋을 필요로 한다", () => {
    expect(springJavaPreset.requires).toEqual(["java"]);
  });

  // 모듈러 모놀리스 규칙이라 일반적인 JPA 프로젝트에 맞지 않는다. 권장으로 남기면 새 코드에만 적용되어 방식이 섞인다.
  it("모듈 경계 규칙을 두지 않는다", async () => {
    expect(springJavaPreset.rules.some((rule) => rule.includes("다른 기능의 repository"))).toBe(
      false,
    );
    for (const doc of ["architecture.md", "data-jpa.md"]) {
      const text = await readFile(join(repo, "docs/spring-java", doc), "utf8");
      expect(text).not.toContain("ID 로 참조");
    }
  });

  it("Git 훅과 GitHub 설정은 설치하지 않는다", async () => {
    expect(springJavaPreset).not.toHaveProperty("hooksPath");
    await expect(access(join(repo, ".githooks"))).rejects.toThrow();
    await expect(access(join(repo, ".github"))).rejects.toThrow();
  });
});
