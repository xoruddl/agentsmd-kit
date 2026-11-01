import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { checkRepository } from "@agentsmd/core";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { runInit } from "../../src/commands/init.js";
import type { Io } from "../../src/io.js";

const git = promisify(execFile);
let root: string;
let out: string;
let err: string;

function io(): Io {
  return { cwd: root, stdout: (text) => (out += text), stderr: (text) => (err += text) };
}

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), "agentsmd-init-"));
  out = "";
  err = "";
});

afterEach(async () => {
  await rm(root, { recursive: true, force: true });
});

describe("runInit", () => {
  it("Java 프리셋을 설치하고 훅을 연결한다", async () => {
    await git("git", ["-C", root, "init", "-q"]);

    await expect(runInit(["--preset", "java"], io())).resolves.toBe(0);

    await expect(readFile(join(root, "CLAUDE.md"), "utf8")).resolves.toContain("@AGENTS.md");
    const { stdout } = await git("git", ["-C", root, "config", "core.hooksPath"]);
    expect(stdout.trim()).toBe(".githooks");
    // 파일 수는 프리셋 내용이 바뀔 때마다 달라지므로 형식만 확인한다.
    expect(out).toMatch(/^java 프리셋: 파일 \d+개를 설치했습니다\./);
    expect(out).toContain("Git 훅을 연결했습니다");
  });

  it("요구되는 프리셋까지 함께 설치하고 알린다", async () => {
    await runInit(["--preset", "java", "--skip-hooks"], io());

    await expect(readFile(join(root, ".claude/settings.json"), "utf8")).resolves.toContain(
      "--no-verify",
    );
    expect(out).toContain("함께 설치한 프리셋: git");
  });

  it("TypeScript 프리셋도 Git 프리셋과 함께 설치하고 check를 통과한다", async () => {
    await expect(runInit(["--preset", "typescript", "--skip-hooks"], io())).resolves.toBe(0);

    await expect(readFile(join(root, "docs/typescript.md"), "utf8")).resolves.toContain("strict");
    await expect(readFile(join(root, "docs/git-conventions.md"), "utf8")).resolves.toContain(
      "merge 커밋",
    );
    expect(out).toContain("함께 설치한 프리셋: git");
    await expect(checkRepository({ root })).resolves.toEqual([]);
  });

  it("설치 직후의 저장소는 check 규칙을 모두 통과한다", async () => {
    await runInit(["--preset", "java", "--skip-hooks"], io());
    await expect(checkRepository({ root })).resolves.toEqual([]);
  });

  it("이미 있는 파일은 건너뛰었다고 알린다", async () => {
    await writeFile(join(root, "AGENTS.md"), "# 기존 지도");

    await runInit(["--preset", "java", "--skip-hooks"], io());

    await expect(readFile(join(root, "AGENTS.md"), "utf8")).resolves.toBe("# 기존 지도");
    expect(out).toContain("이미 있어서 건너뛴 파일 1개");
  });

  it("Git 저장소가 아니면 훅 대신 안내를 남긴다", async () => {
    await expect(runInit(["--preset", "java"], io())).resolves.toBe(0);
    expect(out).toContain("Git 저장소가 아니어서 훅을 연결하지 않았습니다");
  });

  it("설치 후 사람이 할 일을 번호로 안내한다", async () => {
    await runInit(["--preset", "java", "--skip-hooks"], io());
    expect(out).toMatch(/ {2}1\. \S/);
    expect(out).toContain("docs/project-direction.md 에 프로젝트 목표와 범위를 채우세요.");
    expect(out).toContain("agentsmd check 로 문서 지도를 검사하세요.");
  });

  it("프리셋을 지정하지 않거나 모르는 프리셋이면 2를 돌려준다", async () => {
    await expect(runInit([], io())).resolves.toBe(2);
    expect(err).toContain("--preset 을 지정해야 합니다");

    await expect(runInit(["--preset", "kotlin"], io())).resolves.toBe(2);
    expect(err).toContain("알 수 없는 프리셋입니다: kotlin");
  });
});
