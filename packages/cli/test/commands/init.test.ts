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

    await expect(runInit(["--preset", "git,java"], io())).resolves.toBe(0);

    await expect(readFile(join(root, "CLAUDE.md"), "utf8")).resolves.toContain("@AGENTS.md");
    const { stdout } = await git("git", ["-C", root, "config", "core.hooksPath"]);
    expect(stdout.trim()).toBe(".githooks");
    // 파일 수는 프리셋 내용이 바뀔 때마다 달라지므로 형식만 확인한다.
    expect(out).toMatch(/^git, java 프리셋: 파일 \d+개를 설치했습니다\./);
    expect(out).toContain("Git 훅을 연결했습니다");
  });

  it("쉼표로 고른 프리셋을 함께 설치하고 문서 지도를 합친다", async () => {
    await expect(runInit(["--preset", "git,typescript", "--skip-hooks"], io())).resolves.toBe(0);

    const agents = await readFile(join(root, "AGENTS.md"), "utf8");
    expect(agents).toContain("[docs/git-conventions.md](docs/git-conventions.md)");
    expect(agents).toContain("[docs/typescript.md](docs/typescript.md)");
    await expect(checkRepository({ root })).resolves.toEqual([]);
  });

  it("언어 프리셋만 고르면 Git 규칙은 설치하지 않는다", async () => {
    await expect(runInit(["--preset", "typescript", "--skip-hooks"], io())).resolves.toBe(0);

    expect(out).toMatch(/^typescript 프리셋: /);
    await expect(readFile(join(root, "docs/git-conventions.md"), "utf8")).rejects.toThrow();
    await expect(readFile(join(root, "AGENTS.md"), "utf8")).resolves.not.toContain(
      "git-conventions",
    );
    await expect(checkRepository({ root })).resolves.toEqual([]);
  });

  it("Git 프리셋만 골라도 설치하고 check를 통과한다", async () => {
    await expect(runInit(["--preset", "git", "--skip-hooks"], io())).resolves.toBe(0);

    await expect(readFile(join(root, ".claude/settings.json"), "utf8")).resolves.toContain(
      "--no-verify",
    );
    await expect(checkRepository({ root })).resolves.toEqual([]);
  });

  it("설치 직후의 저장소는 check 규칙을 모두 통과한다", async () => {
    await runInit(["--preset", "java", "--skip-hooks"], io());
    await expect(checkRepository({ root })).resolves.toEqual([]);
  });

  it("이미 있는 파일은 건너뛰었다고 알린다", async () => {
    await writeFile(join(root, "CLAUDE.md"), "# 사람이 쓴 CLAUDE.md\n");

    await runInit(["--preset", "java", "--skip-hooks"], io());

    await expect(readFile(join(root, "CLAUDE.md"), "utf8")).resolves.toBe(
      "# 사람이 쓴 CLAUDE.md\n",
    );
    expect(out).toMatch(/이미 있어서 건너뛴 파일 1개 \(덮어쓰려면 --force\):\n {2}CLAUDE\.md/);
  });

  it.each([
    ["java", "git"],
    ["git", "java"],
  ])("%s 다음 %s 순서로 나눠 설치해도 모든 문서가 지도에 오른다", async (first, second) => {
    await runInit(["--preset", first, "--skip-hooks"], io());
    out = "";
    await runInit(["--preset", second, "--skip-hooks"], io());

    expect(out).toMatch(/기존 AGENTS\.md에 문서 \d+개, 규칙 \d+개/);
    const agents = await readFile(join(root, "AGENTS.md"), "utf8");
    expect(agents).toContain("[docs/git-conventions.md](docs/git-conventions.md)");
    expect(agents).toContain("[docs/java-checklist.md](docs/java-checklist.md)");
    await expect(checkRepository({ root })).resolves.toEqual([]);
  });

  it("같은 프리셋을 다시 설치하면 AGENTS.md를 바꾸지 않았다고 알린다", async () => {
    await runInit(["--preset", "git,java", "--skip-hooks"], io());
    out = "";
    await runInit(["--preset", "java", "--skip-hooks"], io());

    expect(out).toContain("AGENTS.md에 이미 모든 항목이 있어 바꾸지 않았습니다.");
  });

  it("Git 훅 실행기를 만들어 각 프리셋의 pre-commit.d 검사를 연결한다", async () => {
    await runInit(["--preset", "java", "--skip-hooks"], io());

    await expect(readFile(join(root, ".githooks/pre-commit"), "utf8")).resolves.toContain(
      "pre-commit.d",
    );
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

  it("프리셋 목록에서 이름과 설명을 띄어 쓴다", async () => {
    await runInit(["--preset", "kotlin"], io());
    expect(err).toMatch(/ {2}typescript {2}\S/);
  });

  it("모르는 프리셋이 섞여 있으면 아무것도 설치하지 않는다", async () => {
    await expect(runInit(["--preset", "git,kotlin", "--skip-hooks"], io())).resolves.toBe(2);

    expect(err).toContain("알 수 없는 프리셋입니다: kotlin");
    await expect(readFile(join(root, "AGENTS.md"), "utf8")).rejects.toThrow();
  });
});
