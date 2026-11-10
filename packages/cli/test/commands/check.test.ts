import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { runCheck } from "../../src/commands/check.js";
import type { Io } from "../../src/io.js";

let root: string;
let out: string;
let err: string;

function io(cwd = root): Io {
  return {
    cwd,
    stdout: (text) => (out += text),
    stderr: (text) => (err += text),
  };
}

async function write(files: Record<string, string>): Promise<void> {
  for (const [path, content] of Object.entries(files)) {
    await mkdir(dirname(join(root, path)), { recursive: true });
    await writeFile(join(root, path), content);
  }
}

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), "agentsmd-cli-"));
  out = "";
  err = "";
});

afterEach(async () => {
  await rm(root, { recursive: true, force: true });
});

describe("runCheck", () => {
  it("문제가 없으면 0을 돌려준다", async () => {
    await write({ "AGENTS.md": "[흐름](docs/workflow.md)", "docs/workflow.md": "" });

    await expect(runCheck([], io())).resolves.toBe(0);
    expect(out).toBe("문제 없음\n");
  });

  it("규칙 위반이 있으면 결과를 출력하고 1을 돌려준다", async () => {
    await write({ "AGENTS.md": "[api](docs/api.md)" });

    await expect(runCheck([], io())).resolves.toBe(1);
    expect(out).toContain("AGENTS.md:1  [broken-link]  링크 대상이 없습니다: docs/api.md");
  });

  it("--root는 현재 디렉터리를 기준으로 풀린다", async () => {
    await write({ "repo/AGENTS.md": "[README](README.md)", "repo/README.md": "" });

    await expect(runCheck(["--root", "repo"], io(root))).resolves.toBe(0);
  });

  it("--agents와 --docs로 위치를 바꿀 수 있다", async () => {
    await write({ "guide/AGENTS.md": "[a](../design/a.md)", "design/a.md": "" });

    await expect(runCheck(["--agents", "guide/AGENTS.md", "--docs", "design"], io())).resolves.toBe(
      0,
    );
  });

  // CI 변수가 비어 `--agents ""`처럼 넘어오면 루트 디렉터리를 파일로 읽다 예외로 죽는다. 옵션 오류로 알린다.
  it.each(["--root", "--agents", "--docs", "--claude"])(
    "%s 값이 비어 있으면 안내와 함께 2를 돌려준다",
    async (option) => {
      await write({ "AGENTS.md": "" });

      await expect(runCheck([option, ""], io())).resolves.toBe(2);
      expect(err).toContain(`${option} 값이 비어 있습니다`);
    },
  );

  it("문서 지도가 없으면 안내와 함께 2를 돌려준다", async () => {
    await expect(runCheck([], io())).resolves.toBe(2);
    expect(err).toContain("문서 지도를 찾을 수 없습니다: AGENTS.md");
  });

  it("--help는 도움말을 출력하고 0을 돌려준다", async () => {
    await expect(runCheck(["--help"], io())).resolves.toBe(0);
    expect(out).toContain("사용법: agentsmd check");
  });

  it("모르는 옵션은 예외로 알린다", async () => {
    await expect(runCheck(["--unknown"], io())).rejects.toThrow(/unknown/i);
  });
});
