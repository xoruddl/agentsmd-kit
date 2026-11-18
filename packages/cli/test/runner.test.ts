import { mkdtemp, realpath, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { shellRunner } from "../src/runner.js";

// 실제 셸을 띄우는 테스트는 이 파일뿐이다.
describe("shellRunner", () => {
  it("명령의 종료 코드를 돌려준다", async () => {
    await expect(shellRunner.run("exit 0", tmpdir())).resolves.toBe(0);
    await expect(shellRunner.run("exit 3", tmpdir())).resolves.toBe(3);
  });

  it("&&로 이은 명령을 셸이 처리한다", async () => {
    await expect(shellRunner.run("true && exit 4", tmpdir())).resolves.toBe(4);
  });

  it("없는 프로그램이면 0이 아닌 코드를 돌려준다", async () => {
    await expect(shellRunner.run("agentsmd-no-such-command-xyz", tmpdir())).resolves.not.toBe(0);
  });

  it("cwd에서 실행한다", async () => {
    const dir = await mkdtemp(join(tmpdir(), "agentsmd-runner-"));
    try {
      await expect(shellRunner.run("test -d .", dir)).resolves.toBe(0);
      await expect(
        shellRunner.run(`test "$(pwd -P)" = "${await realpath(dir)}"`, dir),
      ).resolves.toBe(0);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});
