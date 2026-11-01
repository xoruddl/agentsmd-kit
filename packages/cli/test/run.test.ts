import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { Io } from "../src/io.js";
import { run } from "../src/run.js";

let root: string;
let out: string;
let err: string;

function io(): Io {
  return { cwd: root, stdout: (text) => (out += text), stderr: (text) => (err += text) };
}

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), "agentsmd-run-"));
  out = "";
  err = "";
});

afterEach(async () => {
  await rm(root, { recursive: true, force: true });
});

describe("run", () => {
  it("명령 없이 실행하면 사용법을 보여 주고 2를 돌려준다", async () => {
    await expect(run([], io())).resolves.toBe(2);
    expect(out).toContain("사용법: agentsmd <명령>");
  });

  it("--help는 사용법을 보여 주고 0을 돌려준다", async () => {
    await expect(run(["--help"], io())).resolves.toBe(0);
    expect(out).toContain("check");
  });

  it("모르는 명령은 2를 돌려준다", async () => {
    await expect(run(["lint"], io())).resolves.toBe(2);
    expect(err).toContain("알 수 없는 명령입니다: lint");
  });

  it("명령 이름 뒤의 인자를 그 명령에 넘긴다", async () => {
    await writeFile(join(root, "AGENTS.md"), "[api](docs/api.md)");
    await expect(run(["check"], io())).resolves.toBe(1);
    expect(out).toContain("[broken-link]");
  });

  it("모르는 옵션은 예외 대신 사용법 오류(2)로 알린다", async () => {
    await expect(run(["check", "--unknown"], io())).resolves.toBe(2);
    expect(err).toContain("agentsmd check --help");
  });
});
