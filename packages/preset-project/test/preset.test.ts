import { access, mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { checkRepository, installEntryFiles, installPreset } from "@agentsmd/core";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { projectPreset } from "../src/index.js";

let repo: string;

beforeEach(async () => {
  repo = await mkdtemp(join(tmpdir(), "agentsmd-preset-project-"));
  await installPreset(projectPreset, repo);
  // AGENTS.md는 init이 고른 프리셋에 맞게 만든다.
  await installEntryFiles([projectPreset], repo);
});

afterEach(async () => {
  await rm(repo, { recursive: true, force: true });
});

describe("projectPreset", () => {
  it("이 프리셋만 설치해도 agentsmd check 규칙을 모두 통과한다", async () => {
    await expect(checkRepository({ root: repo })).resolves.toEqual([]);
  });

  // 에이전트가 범위 밖 작업을 하기 전에 읽어야 하므로, 문서 지도에 필수로 올린다.
  it("프로젝트 방향 문서를 모든 작업 전에 읽는 문서로 지도에 올린다", async () => {
    await expect(readFile(join(repo, "AGENTS.md"), "utf8")).resolves.toMatch(
      /\[docs\/project\/direction\.md\]\(docs\/project\/direction\.md\)\s*\|\s*모든 작업 시작 전 \(필수\)/,
    );
  });

  // 언어를 가리지 않는 문서다. 언어에 맞춘 내용을 미리 채워 두면 다른 언어 프리셋과 함께 쓸 수 없다.
  it("기술 스택을 비워 둔 채로 설치하고, 채우라고 안내한다", async () => {
    const direction = await readFile(join(repo, "docs/project/direction.md"), "utf8");
    expect(direction).toMatch(/\| 언어\s+\|\s+\|\s+\|/);
    expect(projectPreset.nextSteps).toContainEqual(
      expect.stringContaining("docs/project/direction.md"),
    );
  });

  it("핵심 규칙, 검증 명령, Git 훅은 두지 않는다", async () => {
    expect(projectPreset).not.toHaveProperty("rules");
    expect(projectPreset).not.toHaveProperty("verify");
    expect(projectPreset).not.toHaveProperty("hooksPath");
    await expect(access(join(repo, ".githooks"))).rejects.toThrow();
  });
});
