import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { runVerify } from "../../src/commands/verify.js";
import type { Io } from "../../src/io.js";
import type { Runner } from "../../src/runner.js";

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

/** 받은 명령과 cwd를 기록하고, 명령별로 정해 둔 종료 코드(없으면 0)를 돌려주는 가짜 실행기. */
function fakeRunner(codes: Record<string, number>): Runner & { calls: [string, string][] } {
  const calls: [string, string][] = [];
  return {
    calls,
    run: (command, cwd) => {
      calls.push([command, cwd]);
      return Promise.resolve(codes[command] ?? 0);
    },
  };
}

const config = (...steps: [string, string][]) =>
  JSON.stringify({ steps: steps.map(([name, run]) => ({ name, run })) });

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), "agentsmd-verify-"));
  out = "";
  err = "";
});

afterEach(async () => {
  await rm(root, { recursive: true, force: true });
});

describe("runVerify", () => {
  it("단계를 차례로 실행하고 모두 통과하면 0", async () => {
    await write({ ".agentsmd/verify.json": config(["build", "a"], ["test", "b"]) });
    const runner = fakeRunner({});
    await expect(runVerify([], io(), runner)).resolves.toBe(0);
    expect(runner.calls).toEqual([
      ["a", root],
      ["b", root],
    ]);
    expect(out).toContain("[verify 1/2 build] a");
    expect(out).toContain("검증 통과 (2단계)");
  });

  it("단계가 실패하면 멈추고 1, 실패 단계를 알린다", async () => {
    await write({ ".agentsmd/verify.json": config(["a", "a"], ["b", "b"], ["c", "c"]) });
    const runner = fakeRunner({ b: 127 });
    await expect(runVerify([], io(), runner)).resolves.toBe(1);
    expect(runner.calls.map(([c]) => c)).toEqual(["a", "b"]);
    expect(err).toContain("검증 실패: [verify 2/3 b] b (종료 코드 127)");
  });

  it("--only로 고른 단계만 파일 순서대로 실행한다", async () => {
    await write({ ".agentsmd/verify.json": config(["a", "a"], ["b", "b"], ["c", "c"]) });
    const runner = fakeRunner({});
    await expect(runVerify(["--only", "c,a"], io(), runner)).resolves.toBe(0);
    expect(runner.calls.map(([c]) => c)).toEqual(["a", "c"]);
    expect(out).toContain("[verify 2/2 c] c");
  });

  it("--only에 없는 이름이면 2와 있는 단계 목록", async () => {
    await write({ ".agentsmd/verify.json": config(["a", "a"]) });
    await expect(runVerify(["--only", "x"], io(), fakeRunner({}))).resolves.toBe(2);
    expect(err).toContain("없는 단계: x (있는 단계: a)");
  });

  it("verify.json이 없으면 2와 init 안내", async () => {
    await expect(runVerify([], io(), fakeRunner({}))).resolves.toBe(2);
    expect(err).toContain("agentsmd init");
  });

  it("verify.json 형식이 틀리면 2", async () => {
    await write({ ".agentsmd/verify.json": "{" });
    await expect(runVerify([], io(), fakeRunner({}))).resolves.toBe(2);
  });

  it("--root가 없는 디렉터리면 2", async () => {
    await expect(runVerify(["--root", "nope"], io(), fakeRunner({}))).resolves.toBe(2);
  });

  it("--root 기준으로 읽고 실행한다", async () => {
    await write({ "sub/.agentsmd/verify.json": config(["a", "a"]) });
    const runner = fakeRunner({});
    await expect(runVerify(["--root", "sub"], io(), runner)).resolves.toBe(0);
    expect(runner.calls).toEqual([["a", join(root, "sub")]]);
  });

  it("--only 값이 비어 있으면 2", async () => {
    await expect(runVerify(["--only", ""], io(), fakeRunner({}))).resolves.toBe(2);
  });

  it("--only의 빈 항목은 무시한다", async () => {
    await write({ ".agentsmd/verify.json": config(["a", "a"], ["b", "b"]) });
    const runner = fakeRunner({});
    await expect(runVerify(["--only", "a,"], io(), runner)).resolves.toBe(0);
    expect(runner.calls.map(([c]) => c)).toEqual(["a"]);
  });

  it("--only가 쉼표뿐이면 빈 값처럼 2", async () => {
    await write({ ".agentsmd/verify.json": config(["a", "a"]) });
    await expect(runVerify(["--only", ",,"], io(), fakeRunner({}))).resolves.toBe(2);
    expect(err).toContain("--only 값이 비어 있습니다");
  });

  it("--only의 이름 앞뒤 공백은 무시하고 파일 순서로 실행한다", async () => {
    await write({ ".agentsmd/verify.json": config(["a", "a"], ["b", "b"]) });
    const runner = fakeRunner({});
    await expect(runVerify(["--only", "b, a"], io(), runner)).resolves.toBe(0);
    expect(runner.calls.map(([c]) => c)).toEqual(["a", "b"]);
  });

  it("verify.json을 읽을 수 없으면(디렉터리 등) 예외 대신 2", async () => {
    await mkdir(join(root, ".agentsmd/verify.json"), { recursive: true });
    await expect(runVerify([], io(), fakeRunner({}))).resolves.toBe(2);
    expect(err).toContain(".agentsmd/verify.json 을 읽을 수 없습니다 (EISDIR)");
  });
});
