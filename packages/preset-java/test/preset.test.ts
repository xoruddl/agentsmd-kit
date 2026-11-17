import { access, mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { checkRepository, installEntryFiles, installPreset } from "@agentsmd/core";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { javaPreset } from "../src/index.js";

let target: string;

beforeEach(async () => {
  target = await mkdtemp(join(tmpdir(), "agentsmd-preset-java-"));
  await installPreset(javaPreset, target);
  // AGENTS.md는 init이 고른 프리셋에 맞게 만든다.
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

  it("패키지 크기 테스트 템플릿을 설치한다", async () => {
    const source = await readFile(join(target, "src/test/java/PackageSizeTest.java"), "utf8");
    expect(source).toContain("MAX_CLASSES_PER_PACKAGE = 15");
    expect(source).toContain("docs/java/package-structure.md");
  });

  it("패키지 구조 문서를 문서 지도에 올린다", () => {
    expect(javaPreset.docs.map((doc) => doc.path)).toContain("docs/java/package-structure.md");
  });

  it("Git 훅과 GitHub 설정은 설치하지 않는다", async () => {
    expect(javaPreset).not.toHaveProperty("hooksPath");
    await expect(access(join(target, ".githooks"))).rejects.toThrow();
    await expect(access(join(target, ".github"))).rejects.toThrow();
  });
});
