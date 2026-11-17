import { mkdir, mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { installVerifyConfig } from "../src/install-verify-config.js";
import type { Preset } from "../src/preset.js";

const java = {
  name: "java",
  description: "",
  filesDir: "",
  verify: "./gradlew spotlessCheck build",
} satisfies Preset;

const noVerify = { name: "git", description: "", filesDir: "" } satisfies Preset;

const OLD_AGENTS_MD = "# AGENTS.md\n\n## 검증\n\n작업 전에 실행한다.\n\n```bash\na\nb\n```\n";

let target: string;

beforeEach(async () => {
  target = await mkdtemp(join(tmpdir(), "agentsmd-verify-config-"));
});

afterEach(async () => {
  await rm(target, { recursive: true, force: true });
});

async function writeConfig(content: string): Promise<void> {
  await mkdir(join(target, ".agentsmd"), { recursive: true });
  await writeFile(join(target, ".agentsmd/verify.json"), content);
}

async function readConfig(): Promise<unknown> {
  const text = await readFile(join(target, ".agentsmd/verify.json"), "utf8");
  const config: unknown = JSON.parse(text);
  return config;
}

describe("installVerifyConfig", () => {
  it("빈 저장소에는 프리셋의 검증 명령을 프리셋 이름의 단계로 만든다", async () => {
    const result = await installVerifyConfig([java], target, undefined);

    expect(result).toEqual({
      written: true,
      added: [{ name: "java", run: "./gradlew spotlessCheck build" }],
      migrated: [],
    });
    await expect(readConfig()).resolves.toEqual({
      steps: [{ name: "java", run: "./gradlew spotlessCheck build" }],
    });
  });

  it("verify.json이 없고 AGENTS.md 검증 블록에 명령이 있으면 step-N 단계로 옮긴 뒤 프리셋 단계를 붙인다", async () => {
    const result = await installVerifyConfig([java], target, OLD_AGENTS_MD);

    expect(result.migrated).toEqual([
      { name: "step-1", run: "a" },
      { name: "step-2", run: "b" },
    ]);
    expect(result.added).toEqual([{ name: "java", run: "./gradlew spotlessCheck build" }]);
    await expect(readConfig()).resolves.toEqual({
      steps: [
        { name: "step-1", run: "a" },
        { name: "step-2", run: "b" },
        { name: "java", run: "./gradlew spotlessCheck build" },
      ],
    });
  });

  it("옮겨 온 명령과 같은 run의 프리셋 단계는 넣지 않는다", async () => {
    const agents = "## 검증\n\n```bash\n./gradlew spotlessCheck build\n```\n";

    const result = await installVerifyConfig([java], target, agents);

    expect(result.migrated).toEqual([{ name: "java", run: "./gradlew spotlessCheck build" }]);
    expect(result.added).toEqual([]);
  });

  // 0.7 이하 저장소를 옮긴 뒤에도 `--only java`로 고를 수 있어야 한다. 나머지는 블록 안 순서로 번호를 매긴다.
  it("옮겨 온 명령이 프리셋의 검증 명령과 같으면 step-N 대신 프리셋 이름을 단계 이름으로 쓴다", async () => {
    const agents = "## 검증\n\n```bash\n  ./gradlew spotlessCheck build \ncustom\n```\n";

    const result = await installVerifyConfig([java], target, agents);

    expect(result.migrated).toEqual([
      { name: "java", run: "./gradlew spotlessCheck build" },
      { name: "step-2", run: "custom" },
    ]);
    expect(result.added).toEqual([]);
    await expect(readConfig()).resolves.toEqual({
      steps: [
        { name: "java", run: "./gradlew spotlessCheck build" },
        { name: "step-2", run: "custom" },
      ],
    });
  });

  it("프리셋 검증 명령이 없어도 AGENTS.md 블록이 있으면 옮긴다", async () => {
    const result = await installVerifyConfig([noVerify], target, OLD_AGENTS_MD);

    expect(result).toMatchObject({ written: true, added: [] });
    expect(result.migrated).toHaveLength(2);
  });

  it("사람이 고친 verify.json의 단계는 그대로 두고 새 run은 겹치지 않는 이름으로 붙인다", async () => {
    await writeConfig(
      `${JSON.stringify({ steps: [{ name: "java", run: "./gradlew build" }] }, null, 2)}\n`,
    );

    const result = await installVerifyConfig([java], target, OLD_AGENTS_MD);

    expect(result).toEqual({
      written: true,
      added: [{ name: "java-2", run: "./gradlew spotlessCheck build" }],
      migrated: [],
    });
    await expect(readConfig()).resolves.toEqual({
      steps: [
        { name: "java", run: "./gradlew build" },
        { name: "java-2", run: "./gradlew spotlessCheck build" },
      ],
    });
  });

  it("같은 프리셋을 다시 설치하면 파일을 건드리지 않는다", async () => {
    await installVerifyConfig([java], target, undefined);
    const before = await stat(join(target, ".agentsmd/verify.json"));

    const result = await installVerifyConfig([java], target, undefined);

    expect(result).toEqual({ written: false, added: [], migrated: [] });
    expect((await stat(join(target, ".agentsmd/verify.json"))).mtimeMs).toBe(before.mtimeMs);
  });

  it("형식이 틀린 verify.json은 고치지 않고 이유를 돌려준다", async () => {
    await writeConfig("{ 깨진 json");

    const result = await installVerifyConfig([java], target, OLD_AGENTS_MD);

    expect(result.written).toBe(false);
    expect(result.added).toEqual([]);
    expect(result.migrated).toEqual([]);
    expect(result.invalid).toContain(".agentsmd/verify.json");
    await expect(readFile(join(target, ".agentsmd/verify.json"), "utf8")).resolves.toBe(
      "{ 깨진 json",
    );
  });

  it("verify.json을 읽을 수 없으면(디렉터리 등) 무엇을 읽지 못했는지 밝힌 오류를 낸다", async () => {
    await mkdir(join(target, ".agentsmd/verify.json"), { recursive: true });

    await expect(installVerifyConfig([java], target, undefined)).rejects.toThrow(
      ".agentsmd/verify.json을 읽을 수 없습니다 (EISDIR)",
    );
  });

  it("넣을 단계가 하나도 없으면 파일을 만들지 않는다", async () => {
    const result = await installVerifyConfig([noVerify], target, "# AGENTS.md\n");

    expect(result).toEqual({ written: false, added: [], migrated: [] });
    await expect(stat(join(target, ".agentsmd"))).rejects.toThrow();
  });
});
