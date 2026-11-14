import { execFile } from "node:child_process";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { checkRepository } from "@agentsmd/core";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { runInit } from "../../src/commands/init.js";
import type { Io } from "../../src/io.js";
import { PRESETS } from "../../src/presets.js";

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
  // 훅 연결은 전역 설정까지 합친 core.hooksPath를 본다. 테스트를 돌리는 사람의 전역 설정이 결과를 바꾸지 않게 한다.
  vi.stubEnv("GIT_CONFIG_GLOBAL", "/dev/null");
  vi.stubEnv("GIT_CONFIG_NOSYSTEM", "1");
});

afterEach(async () => {
  vi.unstubAllEnvs();
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
    expect(out).toMatch(/^git, project, java 프리셋: 파일 \d+개를 설치했습니다\./);
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

  it("java와 spring-java를 함께 고르면 두 프리셋의 문서와 Java 검증 명령을 설치한다", async () => {
    await expect(runInit(["--preset", "java,spring-java", "--skip-hooks"], io())).resolves.toBe(0);

    const agents = await readFile(join(root, "AGENTS.md"), "utf8");
    expect(agents).toContain("[docs/java/checklist.md](docs/java/checklist.md)");
    expect(agents).toContain(
      "[docs/spring-java/architecture.md](docs/spring-java/architecture.md)",
    );
    expect(agents).toContain("./gradlew spotlessCheck build");
    await expect(checkRepository({ root })).resolves.toEqual([]);
  });

  it("언어 프리셋만 고르면 Git 규칙은 설치하지 않는다", async () => {
    await expect(runInit(["--preset", "typescript", "--skip-hooks"], io())).resolves.toBe(0);

    expect(out).toMatch(/^project, typescript 프리셋: /);
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
    // PR 템플릿은 규칙 문서를 링크가 아닌 글자로 가리켜 check가 보지 못한다. 적힌 경로가 실제로 있는지 여기서 본다.
    const template = await readFile(join(root, ".github/pull_request_template.md"), "utf8");
    const mentioned = template.match(/docs\/[\w/-]+\.md/g) ?? [];
    expect(mentioned).not.toEqual([]);
    for (const path of mentioned) {
      await expect(readFile(join(root, path), "utf8"), path).resolves.not.toBe("");
    }
    await expect(checkRepository({ root })).resolves.toEqual([]);
  });

  // 방향 문서를 언어 프리셋마다 두면 두 언어를 쓰는 저장소에서 목표와 범위를 두 파일에 따로 적게 된다.
  it("java와 typescript를 함께 골라도 프로젝트 방향 문서는 하나만 설치하고 한 번만 안내한다", async () => {
    await expect(runInit(["--preset", "java,typescript", "--skip-hooks"], io())).resolves.toBe(0);

    expect(out).toMatch(/^project, java, typescript 프리셋:/);
    expect(out).toContain("project (java에 필요)");
    const count = (text: string, part: string): number => text.split(part).length - 1;
    expect(count(out, "프로젝트 목표와 범위를 채우세요")).toBe(1);
    const agents = await readFile(join(root, "AGENTS.md"), "utf8");
    expect(count(agents, "모든 작업 시작 전 (필수)")).toBe(1);
    // 모든 작업 전에 읽는 문서이므로 언어 문서보다 위에 온다.
    expect(agents.indexOf("docs/project/direction.md")).toBeLessThan(
      agents.indexOf("docs/java/code-style.md"),
    );
    await expect(readFile(join(root, "docs/java/project-direction.md"), "utf8")).rejects.toThrow();
    await expect(
      readFile(join(root, "docs/typescript/project-direction.md"), "utf8"),
    ).rejects.toThrow();
    await expect(checkRepository({ root })).resolves.toEqual([]);
  });

  // 프레임워크 프리셋은 검증 명령을 넣지 않는다. 언어 프리셋의 문서가 문서 지도에서 프레임워크 문서보다 위에 오게 먼저 설치한다.
  it.each([
    ["spring-java", "java", "docs/java/code-style.md", "docs/spring-java/architecture.md"],
    ["react", "typescript", "docs/typescript/rules.md", "docs/react/components.md"],
  ])("%s만 골라도 %s 프리셋을 먼저 설치한다", async (name, required, first, second) => {
    await expect(runInit(["--preset", name, "--skip-hooks"], io())).resolves.toBe(0);

    expect(out).toContain(`${required} (${name}에 필요)`);
    const agents = await readFile(join(root, "AGENTS.md"), "utf8");
    expect(agents.indexOf(first)).toBeGreaterThan(-1);
    expect(agents.indexOf(first)).toBeLessThan(agents.indexOf(second));
    expect(agents).toContain("## 검증");
    await expect(checkRepository({ root })).resolves.toEqual([]);
  });

  // `--preset spring-java`는 `--preset java,spring-java`와 같다. 이미 있는 java 문서는 그대로 두고, 그 사실을 정확히 알린다.
  it("필요한 프리셋이 이미 설치돼 있으면 다듬은 문서를 그대로 두고 새로 쓴 파일이 없다고 알린다", async () => {
    await runInit(["--preset", "java", "--skip-hooks"], io());
    await writeFile(join(root, "docs/java/testing.md"), "# 우리 팀 테스트 규칙\n");
    out = "";

    await expect(runInit(["--preset", "spring-java", "--skip-hooks"], io())).resolves.toBe(0);

    expect(out).toMatch(/^project, java, spring-java 프리셋: 파일 \d+개를 설치했습니다\./);
    expect(out).toContain("java (spring-java에 필요, 이미 있어 새로 쓴 파일 없음)");
    await expect(readFile(join(root, "docs/java/testing.md"), "utf8")).resolves.toBe(
      "# 우리 팀 테스트 규칙\n",
    );
    // 사용자가 고르지 않은 프리셋이므로 "덮어쓰려면 --force"라고 안내하지 않는다. --force로는 덮이지 않는다.
    expect(out).not.toContain("(덮어쓰려면 --force)");
    expect(out).toMatch(
      /함께 설치한 프리셋의 파일 1개는 이미 있고 내용이 달라 그대로 두었습니다.*\n {2}docs\/java\/testing\.md/,
    );
    await expect(checkRepository({ root })).resolves.toEqual([]);
  });

  // 문서 일부를 지운 저장소에서도 지도와 파일이 어긋나지 않아야 한다. 설치 여부를 추측해 건너뛰면 어긋난다.
  it("필요한 프리셋의 문서 일부가 없으면 채우고, AGENTS.md를 새로 써도 check를 통과한다", async () => {
    await runInit(["--preset", "java", "--skip-hooks"], io());
    await rm(join(root, "docs/java/testing.md"));
    out = "";

    await runInit(["--preset", "spring-java", "--skip-hooks", "--force"], io());

    expect(out).toContain("java (spring-java에 필요)");
    await expect(readFile(join(root, "docs/java/testing.md"), "utf8")).resolves.not.toBe("");
    await expect(checkRepository({ root })).resolves.toEqual([]);
  });

  it("필요한 프리셋이 설치돼 있고 AGENTS.md가 없으면 그 프리셋까지 넣어 새로 만든다", async () => {
    await runInit(["--preset", "java", "--skip-hooks"], io());
    await rm(join(root, "AGENTS.md"));

    await runInit(["--preset", "spring-java", "--skip-hooks"], io());

    const agents = await readFile(join(root, "AGENTS.md"), "utf8");
    expect(agents).toContain("[docs/java/checklist.md](docs/java/checklist.md)");
    expect(agents).toContain("./gradlew spotlessCheck build");
    await expect(checkRepository({ root })).resolves.toEqual([]);
  });

  it("--force는 고른 프리셋만 덮어쓰고, 함께 설치하는 프리셋 자리에 있던 파일은 남긴다", async () => {
    await writeFile(join(root, ".nvmrc"), "18\n");

    await expect(runInit(["--preset", "react", "--skip-hooks", "--force"], io())).resolves.toBe(0);

    expect(out).toContain("typescript (react에 필요)");
    await expect(readFile(join(root, ".nvmrc"), "utf8")).resolves.toBe("18\n");
    // 이미 --force를 줬으므로 "덮어쓰려면 --force"는 따를 수 없는 안내다. 실제 방법을 알린다.
    expect(out).not.toContain("(덮어쓰려면 --force)");
    expect(out).toContain("원본으로 되돌릴 때만 그 프리셋을 --preset 에 직접 적고 --force");
    expect(out).toMatch(/\n {2}\.nvmrc\n/);
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
    // --force는 AGENTS.md를 새로 쓴다. 덮어쓰지 않은 typescript의 문서와 검증 명령이 지도에서 빠지면 안 된다.
    const agents = await readFile(join(root, "AGENTS.md"), "utf8");
    expect(agents).toContain("[docs/typescript/rules.md](docs/typescript/rules.md)");
    expect(agents).toContain("## 검증");
    await expect(checkRepository({ root })).resolves.toEqual([]);
  });

  // github을 고르면 git이 따라오므로 훅도 연결된다. 고르지 않은 설정이 바뀌므로 출력으로 알려야 한다.
  it("github만 골라 git을 처음 설치하면 훅을 연결하고 알린다", async () => {
    await git("git", ["-C", root, "init", "-q"]);

    await runInit(["--preset", "github"], io());

    const { stdout } = await git("git", ["-C", root, "config", "core.hooksPath"]);
    expect(stdout.trim()).toBe(".githooks");
    expect(out).toContain("Git 훅을 연결했습니다: core.hooksPath=.githooks");
  });

  // husky 등으로 이미 다른 훅 디렉터리를 쓰면 바꾸지 않는다. 바꾸면 기존 훅이 조용히 꺼진다.
  it("core.hooksPath가 이미 다른 값이면 바꾸지 않고 기존 값과 바꾸는 방법을 알린다", async () => {
    await git("git", ["-C", root, "init", "-q"]);
    await git("git", ["-C", root, "config", "core.hooksPath", ".husky"]);

    await expect(runInit(["--preset", "github"], io())).resolves.toBe(0);

    const { stdout } = await git("git", ["-C", root, "config", "core.hooksPath"]);
    expect(stdout.trim()).toBe(".husky");
    expect(out).toContain("core.hooksPath가 이미 .husky 로 설정돼 있어 바꾸지 않았습니다.");
    expect(out).toContain("git config core.hooksPath .githooks 를 실행하세요.");
    expect(out).not.toContain("Git 훅을 연결했습니다");
    // 훅 파일은 설치해 둔다. 기존 훅에서 불러 쓰거나 나중에 연결할 수 있어야 한다.
    await expect(readFile(join(root, ".githooks/commit-msg"), "utf8")).resolves.toContain("#!");
  });

  // 전역 값을 저장소 설정으로 덮으면 그 저장소에서만 전역 훅이 꺼진다. 어디서 온 값인지 알려야 무엇을 잃는지 안다.
  it("전역 설정의 core.hooksPath면 전역 설정이라고 알린다", async () => {
    const globalConfig = join(root, "global.gitconfig");
    await writeFile(globalConfig, "[core]\n\thooksPath = /opt/hooks\n");
    vi.stubEnv("GIT_CONFIG_GLOBAL", globalConfig);
    await git("git", ["-C", root, "init", "-q"]);

    await runInit(["--preset", "git"], io());

    expect(out).toContain(
      "core.hooksPath가 전역 Git 설정에서 이미 /opt/hooks 로 설정돼 있어 바꾸지 않았습니다.",
    );
  });

  // Git은 상대 경로인 core.hooksPath를 저장소 최상위 기준으로 해석한다.
  it("--root가 저장소의 하위 디렉터리면 최상위 기준 경로로 훅을 연결한다", async () => {
    await git("git", ["-C", root, "init", "-q"]);

    await runInit(["--preset", "git", "--root", "packages/a"], io());

    const { stdout } = await git("git", ["-C", root, "config", "core.hooksPath"]);
    expect(stdout.trim()).toBe("packages/a/.githooks");
    expect(out).toContain("Git 훅을 연결했습니다: core.hooksPath=packages/a/.githooks");
  });

  // 파일 설치는 이미 끝났다. 훅 연결에서 죽으면 무엇이 설치됐는지 알 수 없다.
  it("기존 core.hooksPath를 읽지 못해도 설치 결과를 알리고 훅만 연결하지 못했다고 알린다", async () => {
    await git("git", ["-C", root, "init", "-q"]);
    await git("git", ["-C", root, "config", "core.hooksPath", "~agentsmd-no-such-user/hooks"]);

    await expect(runInit(["--preset", "git"], io())).resolves.toBe(0);

    expect(out).toMatch(/^git 프리셋: 파일 \d+개를 설치했습니다\./);
    expect(out).toContain("Git 훅을 연결하지 못했습니다: ");
    expect(out).toContain("훅 파일은 설치했습니다. 원인을 고친 뒤 같은 명령을 다시 실행하세요.");
    const { stdout } = await git("git", ["-C", root, "config", "core.hooksPath"]);
    expect(stdout.trim()).toBe("~agentsmd-no-such-user/hooks");
  });

  // --force는 이 도구가 설치한 파일을 다시 쓰라는 뜻이다. 다른 도구의 훅을 끄는 것까지 포함하지 않는다.
  it("--force여도 이미 다른 값인 core.hooksPath는 바꾸지 않는다", async () => {
    await git("git", ["-C", root, "init", "-q"]);
    await git("git", ["-C", root, "config", "core.hooksPath", ".husky"]);

    await runInit(["--preset", "git", "--force"], io());

    const { stdout } = await git("git", ["-C", root, "config", "core.hooksPath"]);
    expect(stdout.trim()).toBe(".husky");
    expect(out).toContain("core.hooksPath가 이미 .husky 로 설정돼 있어 바꾸지 않았습니다.");
  });

  // Git 저장소가 아니면 "git init 후 다시 실행하세요"라고 안내한다. 다시 실행했을 때 git 프리셋이 이미 있다고
  // 훅 연결까지 건너뛰면, 안내대로 했는데 훅이 동작하지 않는다.
  it("git init 전에 설치했다가 다시 실행하면 훅을 연결한다", async () => {
    await runInit(["--preset", "github"], io());
    expect(out).toContain("Git 저장소가 아니어서 훅을 연결하지 않았습니다");
    await git("git", ["-C", root, "init", "-q"]);
    out = "";

    await runInit(["--preset", "github"], io());

    expect(out).toContain("git (github에 필요, 이미 있어 새로 쓴 파일 없음)");
    const { stdout } = await git("git", ["-C", root, "config", "core.hooksPath"]);
    expect(stdout.trim()).toBe(".githooks");
    expect(out).toContain("Git 훅을 연결했습니다: core.hooksPath=.githooks");
  });

  it("필요한 프리셋을 직접 골랐으면 더했다고 알리지 않는다", async () => {
    await runInit(["--preset", "github,git", "--skip-hooks"], io());

    expect(out).toMatch(/^git, github 프리셋:/);
    expect(out).not.toContain("고르지 않았지만");
  });

  it("필요한 프리셋 가운데 직접 고르지 않은 것만 더했다고 알린다", async () => {
    await runInit(["--preset", "spring-java,java", "--skip-hooks"], io());

    expect(out).toMatch(/^project, java, spring-java 프리셋:/);
    expect(out).toContain("함께 설치했습니다: project (java에 필요)\n");
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

  it.each(["java", "spring-java", "typescript", "react"])(
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
    expect(out).toContain("docs/project/direction.md 에 프로젝트 목표와 범위를 채우세요.");
    expect(out).toContain("agentsmd check 로 문서 지도를 검사하세요.");
  });

  describe("0.6 이하로 설치한 저장소", () => {
    /** 0.6이 설치하던 대로 문서를 docs/ 바로 아래에 두고, 문서 지도에 올린다. */
    async function installed06(names: readonly string[]): Promise<void> {
      await mkdir(join(root, "docs"), { recursive: true });
      for (const name of names) {
        await writeFile(join(root, "docs", name), `# 사람이 고쳐 쓴 ${name}\n`);
      }
      const rows = names.map((name) => `| [docs/${name}](docs/${name}) | 항상 |`);
      await writeFile(
        join(root, "AGENTS.md"),
        [
          "# AGENTS.md",
          "",
          "## 문서 지도",
          "",
          "| 문서 | 읽는 시점 |",
          "| --- | --- |",
          ...rows,
          "",
        ].join("\n"),
      );
    }

    // 옛 문서와 새 문서가 모두 지도에 올라 check가 통과한다. 알리지 않으면 같은 규칙이 두 벌인 채로 남는다.
    it("옛 위치에 남은 문서를 새 위치와 함께 알리고, 옮기거나 지우지는 않는다", async () => {
      await installed06(["workflow.md", "git-conventions.md"]);

      await expect(runInit(["--preset", "git", "--skip-hooks"], io())).resolves.toBe(0);

      expect(out).toContain("이름이 같은 문서 2개가 옛 위치에 있습니다.");
      expect(out).toContain("  docs/workflow.md → docs/git/workflow.md\n");
      expect(out).toContain("  docs/git-conventions.md → docs/git/git-conventions.md\n");
      expect(out).not.toContain("docs/code-review.md →");
      // 기존 AGENTS.md에 합쳤으므로 옛 줄이 남아 있다.
      expect(out).toContain("AGENTS.md 문서 지도에서 그 줄도 지우세요.");
      await expect(readFile(join(root, "docs/workflow.md"), "utf8")).resolves.toBe(
        "# 사람이 고쳐 쓴 workflow.md\n",
      );
      await expect(readFile(join(root, "docs/git/workflow.md"), "utf8")).resolves.not.toContain(
        "사람이 고쳐 쓴",
      );
    });

    // 파일 이름만 보고 찾는다. docs/testing.md처럼 흔한 이름은 직접 쓴 문서일 수 있으므로 지우라고 단정하지 않는다.
    it("직접 쓴 문서일 수 있다고 알리고, 그대로 둬도 된다고 안내한다", async () => {
      await installed06(["testing.md"]);

      await runInit(["--preset", "typescript", "--skip-hooks"], io());

      expect(out).toContain("  docs/testing.md → docs/typescript/testing.md\n");
      expect(out).toContain("이전 버전이 설치한 문서라면");
      expect(out).toContain("직접 쓴 문서라면 그대로 두면 됩니다.");
    });

    // --force는 AGENTS.md를 새로 만든다. 없는 줄을 지우라거나, 건너뛴 파일이 없는데 다시 설치하라고 안내하지 않는다.
    it("--force로 AGENTS.md를 새로 만들었으면 지도의 옛 줄과 건너뛴 파일은 안내하지 않는다", async () => {
      await installed06(["workflow.md"]);

      await runInit(["--preset", "git", "--skip-hooks", "--force"], io());

      expect(out).toContain("  docs/workflow.md → docs/git/workflow.md\n");
      expect(out).not.toContain("문서 지도에서 그 줄도 지우세요");
      expect(out).not.toContain("위에서 건너뛴 파일");
    });

    // 0.6의 훅과 PR 템플릿은 옛 문서 경로를 적고 있다. 내용이 달라 건너뛰므로 그대로 남는다.
    it("건너뛴 파일이 있으면 옛 경로를 안내하는지 확인하라고 알린다", async () => {
      await installed06(["workflow.md"]);
      await mkdir(join(root, ".githooks"), { recursive: true });
      await writeFile(join(root, ".githooks/commit-msg"), "# 규칙: docs/git-conventions.md\n");

      await runInit(["--preset", "git", "--skip-hooks"], io());

      expect(out).toContain(
        "위에서 건너뛴 파일이 옛 경로를 안내하면 그 파일을 지우고 다시 설치하세요.",
      );
    });

    it("건너뛴 파일이 없으면 그 안내는 하지 않는다", async () => {
      await installed06(["code-style.md"]);

      await runInit(["--preset", "java", "--skip-hooks"], io());

      expect(out).toContain("  docs/code-style.md → docs/java/code-style.md\n");
      expect(out).not.toContain("위에서 건너뛴 파일");
    });

    // 사람이 채운 방향 문서다. 언어 프리셋을 고르면 project가 따라오므로 그때도 알려야 한다.
    it("언어 프리셋을 고르면 옛 프로젝트 방향 문서도 알린다", async () => {
      await installed06(["project-direction.md"]);

      await runInit(["--preset", "java", "--skip-hooks"], io());

      expect(out).toContain("  docs/project-direction.md → docs/project/direction.md\n");
    });

    // 0.6에서 java와 typescript가 같은 이름으로 설치하던 문서다. 어느 쪽 것인지는 내용을 봐야 안다.
    it("두 프리셋이 같은 이름으로 설치하던 문서는 한 줄로 묶고 내용을 보고 고르라고 알린다", async () => {
      await installed06(["lint-and-ci.md"]);

      await runInit(["--preset", "java,typescript", "--skip-hooks"], io());

      expect(out).toContain("이름이 같은 문서 1개가 옛 위치에 있습니다.");
      expect(out).toContain(
        "  docs/lint-and-ci.md → docs/java/lint-and-ci.md 또는 docs/typescript/lint-and-ci.md (내용을 보고 고르세요)\n",
      );
    });

    it("고르지 않은 프리셋의 옛 문서는 알리지 않는다", async () => {
      await installed06(["spring-api.md"]);

      await runInit(["--preset", "git", "--skip-hooks"], io());

      expect(out).not.toContain("옛 위치에");
    });
  });

  it("새로 설치하는 저장소에는 옛 위치 안내가 나오지 않는다", async () => {
    await runInit(
      ["--preset", "git,github,java,spring-java,typescript,react", "--skip-hooks"],
      io(),
    );
    expect(out).not.toContain("옛 위치에");
  });

  it("프리셋을 지정하지 않거나 모르는 프리셋이면 2를 돌려준다", async () => {
    await expect(runInit([], io())).resolves.toBe(2);
    expect(err).toContain("--preset 을 지정해야 합니다");

    await expect(runInit(["--preset", "kotlin"], io())).resolves.toBe(2);
    expect(err).toContain("알 수 없는 프리셋입니다: kotlin");
  });

  // 0.6 이하의 이름을 적은 사용자는 오타가 아니다. 목록에서 새 이름을 찾게 하지 않고 바로 알린다.
  it("이름이 바뀐 프리셋을 옛 이름으로 고르면 새 이름을 알리고 설치하지 않는다", async () => {
    await expect(runInit(["--preset", "git,java,spring"], io())).resolves.toBe(2);

    // 첫 줄만 봐도 오타가 아님을 알 수 있어야 한다.
    expect(err).toMatch(/^이름이 바뀐 프리셋입니다: spring → spring-java\n/);
    expect(err).not.toContain("알 수 없는 프리셋");
    await expect(readFile(join(root, "AGENTS.md"), "utf8")).rejects.toThrow();
  });

  // 이름 변경은 이전 버전의 명령을 깨는 변경이다. 오타 안내에 밀려 둘째 줄로 가면 첫 줄만 보는 사용자가 놓친다.
  it("모르는 이름과 옛 이름을 함께 적으면 따로 알리고, 이름 변경을 먼저 알린다", async () => {
    await expect(runInit(["--preset", "kotlin,spring"], io())).resolves.toBe(2);

    expect(err).toMatch(
      /^이름이 바뀐 프리셋입니다: spring → spring-java\n알 수 없는 프리셋입니다: kotlin\n/,
    );
  });

  it("옛 이름이 아닌 모르는 이름에는 바뀐 이름을 알리지 않는다", async () => {
    await runInit(["--preset", "kotlin"], io());
    expect(err).not.toContain("이름이 바뀐");
  });

  // 이름 길이와 무관하게 설명이 같은 열에서 시작하고, 가장 긴 이름과도 두 칸 떨어진다.
  it("프리셋 목록에서 이름과 설명을 띄어 쓰고 설명을 같은 열에 맞춘다", async () => {
    await runInit(["--preset", "kotlin"], io());

    const rows = err.split("\n").flatMap((line) => {
      const row = /^ {2}(\S+)( +)\S/.exec(line);
      return row === null ? [] : [{ name: row[1] ?? "", gap: row[2] ?? "" }];
    });
    expect(rows.map(({ name }) => name)).toEqual(PRESETS.map(({ name }) => name));
    expect(new Set(rows.map(({ name, gap }) => name.length + gap.length)).size).toBe(1);
    expect(Math.min(...rows.map(({ gap }) => gap.length))).toBe(2);
  });

  it("모르는 프리셋이 섞여 있으면 아무것도 설치하지 않는다", async () => {
    await expect(runInit(["--preset", "git,kotlin", "--skip-hooks"], io())).resolves.toBe(2);

    expect(err).toContain("알 수 없는 프리셋입니다: kotlin");
    await expect(readFile(join(root, "AGENTS.md"), "utf8")).rejects.toThrow();
  });
});
