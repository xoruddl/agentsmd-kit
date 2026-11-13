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
  it("Git·Java 프리셋을 설치하고 훅을 연결한다", async () => {
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
    expect(agents).toContain("[docs/git/git-conventions.md](docs/git/git-conventions.md)");
    expect(agents).toContain("[docs/typescript/rules.md](docs/typescript/rules.md)");
    await expect(checkRepository({ root })).resolves.toEqual([]);
  });

  it("typescript와 react를 함께 고르면 두 프리셋의 문서를 모두 설치한다", async () => {
    await expect(runInit(["--preset", "typescript,react", "--skip-hooks"], io())).resolves.toBe(0);

    const agents = await readFile(join(root, "AGENTS.md"), "utf8");
    expect(agents).toContain("[docs/typescript/rules.md](docs/typescript/rules.md)");
    expect(agents).toContain("[docs/react/components.md](docs/react/components.md)");
    await expect(checkRepository({ root })).resolves.toEqual([]);
  });

  it("java와 spring을 함께 고르면 두 프리셋의 문서와 Java 검증 명령을 설치한다", async () => {
    await expect(runInit(["--preset", "java,spring", "--skip-hooks"], io())).resolves.toBe(0);

    const agents = await readFile(join(root, "AGENTS.md"), "utf8");
    expect(agents).toContain("[docs/java/checklist.md](docs/java/checklist.md)");
    expect(agents).toContain("[docs/spring/architecture.md](docs/spring/architecture.md)");
    expect(agents).toContain("./gradlew spotlessCheck build");
    await expect(checkRepository({ root })).resolves.toEqual([]);
  });

  it("언어 프리셋만 고르면 Git 규칙은 설치하지 않는다", async () => {
    await expect(runInit(["--preset", "typescript", "--skip-hooks"], io())).resolves.toBe(0);

    expect(out).toMatch(/^typescript 프리셋: /);
    await expect(readFile(join(root, "docs/git/git-conventions.md"), "utf8")).rejects.toThrow();
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
    // 호스팅·CI에 묶이는 파일은 github 프리셋을 고를 때만 설치한다.
    await expect(
      readFile(join(root, ".github/pull_request_template.md"), "utf8"),
    ).rejects.toThrow();
    await expect(checkRepository({ root })).resolves.toEqual([]);
  });

  it("git,github를 함께 고르면 템플릿과 PR 규칙 검사 스크립트를 함께 설치한다", async () => {
    await expect(runInit(["--preset", "git,github", "--skip-hooks"], io())).resolves.toBe(0);

    await expect(readFile(join(root, ".githooks/check-pr"), "utf8")).resolves.toContain("BRANCH");
    await expect(
      readFile(join(root, ".github/pull_request_template.md"), "utf8"),
    ).resolves.toContain("Closes #");
    const agents = await readFile(join(root, "AGENTS.md"), "utf8");
    expect(agents).toContain("[docs/git/git-conventions.md](docs/git/git-conventions.md)");
    expect(agents).toContain("[docs/github/usage.md](docs/github/usage.md)");
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
    expect(agents).toContain("[docs/git/git-conventions.md](docs/git/git-conventions.md)");
    expect(agents).toContain("[docs/java/checklist.md](docs/java/checklist.md)");
    await expect(checkRepository({ root })).resolves.toEqual([]);
  });

  it("문서 지도 절이 없는 AGENTS.md면 바꾸지 않고 직접 옮길 항목을 안내한다", async () => {
    const existing = "# AGENTS.md\n\n## 작업 전 읽을 문서\n\n## 핵심 규칙 요약\n\n- 팀 규칙\n";
    await writeFile(join(root, "AGENTS.md"), existing);

    await expect(runInit(["--preset", "java", "--skip-hooks"], io())).resolves.toBe(0);

    await expect(readFile(join(root, "AGENTS.md"), "utf8")).resolves.toBe(existing);
    expect(out).not.toContain("AGENTS.md에 이미 모든 항목이 있어");
    expect(out).toContain("AGENTS.md에 '## 문서 지도' 절이 없어 아래 항목을 넣지 않았습니다.");
    expect(out).toMatch(/ {4}\[docs\/java\/checklist\.md\]\(docs\/java\/checklist\.md\) \| \S/);
    expect(out).toContain("    ./gradlew spotlessCheck build");
    // 옮기기 전에는 설치한 문서가 지도에 없으므로 check가 잡아낸다.
    await expect(checkRepository({ root })).resolves.not.toEqual([]);
  });

  it("같은 프리셋을 다시 설치하면 AGENTS.md를 바꾸지 않았다고 알린다", async () => {
    await runInit(["--preset", "git,java", "--skip-hooks"], io());
    out = "";
    await runInit(["--preset", "java", "--skip-hooks"], io());

    expect(out).toContain("AGENTS.md에 이미 모든 항목이 있어 바꾸지 않았습니다.");
  });

  it.each(["java", "spring", "typescript", "react"])(
    "%s 프리셋만 고르면 Git 훅을 만들거나 연결하지 않는다",
    async (name) => {
      await git("git", ["-C", root, "init", "-q"]);

      await expect(runInit(["--preset", name], io())).resolves.toBe(0);

      await expect(readFile(join(root, ".githooks/commit-msg"), "utf8")).rejects.toThrow();
      await expect(git("git", ["-C", root, "config", "core.hooksPath"])).rejects.toThrow();
      expect(out).not.toContain("Git 훅");
    },
  );

  it("Git 저장소가 아니면 훅 대신 안내를 남긴다", async () => {
    await expect(runInit(["--preset", "git"], io())).resolves.toBe(0);
    expect(out).toContain("Git 저장소가 아니어서 훅을 연결하지 않았습니다");
  });

  it("설치 후 사람이 할 일을 번호로 안내한다", async () => {
    await runInit(["--preset", "java", "--skip-hooks"], io());
    expect(out).toMatch(/ {2}1\. \S/);
    expect(out).toContain("docs/java/project-direction.md 에 프로젝트 목표와 범위를 채우세요.");
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
