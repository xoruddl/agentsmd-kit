import { access, mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { checkRepository, installEntryFiles, installPreset } from "@agentsmd/core";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { githubPreset } from "../src/index.js";

let repo: string;

beforeEach(async () => {
  repo = await mkdtemp(join(tmpdir(), "agentsmd-preset-github-"));
  await installPreset(githubPreset, repo);
  // AGENTS.md는 init이 고른 프리셋에 맞게 만든다.
  await installEntryFiles([githubPreset], repo);
});

afterEach(async () => {
  await rm(repo, { recursive: true, force: true });
});

describe("githubPreset", () => {
  it("GitHub 프리셋만 설치해도 agentsmd check 규칙을 모두 통과한다", async () => {
    await expect(checkRepository({ root: repo })).resolves.toEqual([]);
  });

  it("이슈·PR 템플릿을 설치한다", async () => {
    await expect(access(join(repo, ".github/pull_request_template.md"))).resolves.toBeUndefined();
    await expect(access(join(repo, ".github/ISSUE_TEMPLATE/feature.yml"))).resolves.toBeUndefined();
  });

  // git 프리셋의 check-pr이 PR 제목을 `[타입] 요약`으로 검사하므로, 템플릿도 같은 형식으로 시작하게 한다.
  it.each([
    ["ISSUE_TEMPLATE/feature.yml", "title: '[Feat] '"],
    ["ISSUE_TEMPLATE/bug.yml", "title: '[Fix] '"],
    ["pull_request_template.md", "`[<타입>] <한국어 요약>`"],
  ])("%s는 [타입] 요약 형식을 안내한다", async (file, expected) => {
    await expect(readFile(join(repo, ".github", file), "utf8")).resolves.toContain(expected);
  });

  // GitHub를 써도 CI는 Jenkins 등으로 돌릴 수 있어서, CI 설정 파일은 넣지 않는다.
  it("CI 워크플로와 Git 훅은 설치하지 않는다", async () => {
    expect(githubPreset).not.toHaveProperty("hooksPath");
    await expect(access(join(repo, ".github/workflows"))).rejects.toThrow();
    await expect(access(join(repo, ".githooks"))).rejects.toThrow();
  });

  // 워크플로를 설치하지 않는 대신, GitHub Actions에서 문서 지도를 검사하는 방법을 문서로 안내한다.
  it("설치 후 안내에서 문서 지도 검사 Action을 알린다", async () => {
    const step = githubPreset.nextSteps.find((line) => line.includes("agentsmd-kit"));
    expect(step).toContain("docs/github.md");
    await expect(readFile(join(repo, "docs/github.md"), "utf8")).resolves.toContain(
      "uses: xoruddl/agentsmd-kit@v0",
    );
  });
});
