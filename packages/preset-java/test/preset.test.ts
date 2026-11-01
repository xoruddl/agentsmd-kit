import { access, constants } from "node:fs/promises";
import { join } from "node:path";
import { checkRepository } from "@agentsmd/core";
import { describe, expect, it } from "vitest";
import { javaPreset } from "../src/index.js";

describe("javaPreset", () => {
  it("설치할 파일 디렉터리가 실제로 있다", async () => {
    await expect(access(join(javaPreset.filesDir, "AGENTS.md"))).resolves.toBeUndefined();
  });

  // 프리셋이 설치하는 지침이 이 도구의 검사를 통과해야, 설치 직후의 저장소도 바로 CI를 통과한다.
  it("프리셋 지침이 agentsmd check 규칙을 모두 통과한다", async () => {
    await expect(checkRepository({ root: javaPreset.filesDir })).resolves.toEqual([]);
  });

  it("Git 훅이 실행 권한을 가진다", async () => {
    for (const hook of ["pre-commit", "commit-msg"]) {
      await expect(
        access(join(javaPreset.filesDir, ".githooks", hook), constants.X_OK),
      ).resolves.toBeUndefined();
    }
  });
});
