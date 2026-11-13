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

  // github 프리셋의 PR 템플릿과 문서는 Git 작업 규칙 문서를 가리킨다. git 없이 설치하면 없는 문서를 가리키게 된다.
  it("github만 골라도 git 프리셋을 함께 설치하고 그 사실을 알린다", async () => {
    await expect(runInit(["--preset", "github", "--skip-hooks"], io())).resolves.toBe(0);

    expect(out).toMatch(/^git, github 프리셋: 파일 \d+개를 설치했습니다\./);
    expect(out).toContain("고르지 않았지만 필요한 프리셋을 함께 설치했습니다: git (github에 필요)");
    await expect(readFile(join(root, ".githooks/commit-msg"), "utf8")).resolves.toContain("#!");
    await expect(readFile(join(root, "docs/git/git-conventions.md"), "utf8")).resolves.not.toBe("");
    await expect(checkRepository({ root })).resolves.toEqual([]);
  });

  // 프레임워크 프리셋은 검증 명령을 넣지 않는다. 언어 프리셋의 필수 문서가 문서 지도에서 위에 오게 먼저 설치한다.
  it.each([
    ["spring", "java", "docs/java/project-direction.md", "docs/spring/architecture.md"],
    ["react", "typescript", "docs/typescript/project-direction.md", "docs/react/components.md"],
  ])("%s만 골라도 %s 프리셋을 먼저 설치한다", async (name, required, first, second) => {
    await expect(runInit(["--preset", name, "--skip-hooks"], io())).resolves.toBe(0);

    expect(out).toContain(`${required} (${name}에 필요)`);
    const agents = await readFile(join(root, "AGENTS.md"), "utf8");
    expect(agents.indexOf(first)).toBeGreaterThan(-1);
    expect(agents.indexOf(first)).toBeLessThan(agents.indexOf(second));
    expect(agents).toContain("## 검증");
    await expect(checkRepository({ root })).resolves.toEqual([]);
  });

  // 함께 설치하는 프리셋은 사용자가 고른 것이 아니다. 이미 있으면 사람이 다듬은 문서와 AGENTS.md를 다시 건드리지 않는다.
  it("필요한 프리셋이 이미 설치돼 있으면 다시 설치하지 않고 AGENTS.md에서 지운 규칙도 되살리지 않는다", async () => {
    await runInit(["--preset", "java", "--skip-hooks"], io());
    const removedRule = "새 의존성은 사용자에게 묻고 추가한다.";
    const agentsPath = join(root, "AGENTS.md");
    const trimmed = (await readFile(agentsPath, "utf8"))
      .split("\n")
      .filter((line) => !line.includes(removedRule))
      .join("\n");
    await writeFile(agentsPath, trimmed);
    await writeFile(join(root, "docs/java/testing.md"), "# 우리 팀 테스트 규칙\n");
    out = "";

    await expect(runInit(["--preset", "spring", "--skip-hooks"], io())).resolves.toBe(0);

    expect(out).toMatch(/^spring 프리셋: 파일 \d+개를 설치했습니다\./);
    expect(out).not.toContain("고르지 않았지만");
    expect(out).not.toContain("건너뛴 파일");
    const agents = await readFile(agentsPath, "utf8");
    expect(agents).not.toContain(removedRule);
    expect(agents).toContain("[docs/spring/architecture.md](docs/spring/architecture.md)");
    await expect(checkRepository({ root })).resolves.toEqual([]);
  });

  it("--force는 고른 프리셋만 덮어쓰고, 함께 설치하는 프리셋 자리에 있던 파일은 남긴다", async () => {
    await writeFile(join(root, ".nvmrc"), "18\n");

    await expect(runInit(["--preset", "react", "--skip-hooks", "--force"], io())).resolves.toBe(0);

    expect(out).toContain("typescript (react에 필요)");
    await expect(readFile(join(root, ".nvmrc"), "utf8")).resolves.toBe("18\n");
  });

  it("--force로 프레임워크 프리셋을 다시 설치해도 이미 있는 언어 프리셋 문서는 덮어쓰지 않는다", async () => {
    await runInit(["--preset", "typescript,react", "--skip-hooks"], io());
    await writeFile(join(root, "docs/typescript/rules.md"), "# 우리 팀 규칙\n");
    await writeFile(join(root, "docs/react/components.md"), "# 고친 문서\n");

    await runInit(["--preset", "react", "--skip-hooks", "--force"], io());

    await expect(readFile(join(root, "docs/typescript/rules.md"), "utf8")).resolves.toBe(
      "# 우리 팀 규칙\n",
    );
    await expect(readFile(join(root, "docs/react/components.md"), "utf8")).resolves.not.toBe(
      "# 고친 문서\n",
    );
  });

  // github을 고르면 git이 따라오므로 훅도 연결된다. 고르지 않은 설정이 바뀌므로 출력으로 알려야 한다.
  it("github만 골라 git을 처음 설치하면 훅을 연결하고 알린다", async () => {
    await git("git", ["-C", root, "init", "-q"]);

    await runInit(["--preset", "github"], io());

    const { stdout } = await git("git", ["-C", root, "config", "core.hooksPath"]);
    expect(stdout.trim()).toBe(".githooks");
    expect(out).toContain("Git 훅을 연결했습니다: core.hooksPath=.githooks");
  });

  it("git이 이미 설치돼 있으면 github을 더할 때 훅 설정을 건드리지 않는다", async () => {
    await git("git", ["-C", root, "init", "-q"]);
    await runInit(["--preset", "git", "--skip-hooks"], io());
    out = "";

    await runInit(["--preset", "github"], io());

    await expect(git("git", ["-C", root, "config", "core.hooksPath"])).rejects.toThrow();
    expect(out).not.toContain("Git 훅");
  });

  it("필요한 프리셋을 직접 골랐으면 더했다고 알리지 않는다", async () => {
    await runInit(["--preset", "spring,java", "--skip-hooks"], io());

    expect(out).toMatch(/^java, spring 프리셋:/);
    expect(out).not.toContain("고르지 않았지만");
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
