import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import type { Preset } from "./preset.js";
import { verifyCommands } from "./verify-commands.js";
import {
  VERIFY_CONFIG,
  mergeVerifySteps,
  parseVerifyConfig,
  renderVerifyConfig,
  type VerifyStep,
} from "./verify-config.js";

export interface VerifyConfigResult {
  /** `verify.json`을 새로 만들었거나 고쳐 썼는가. */
  readonly written: boolean;
  /** 프리셋의 검증 명령에서 새로 넣은 단계. */
  readonly added: readonly VerifyStep[];
  /** 옛 AGENTS.md `## 검증` 코드 블록의 명령에서 옮겨 온 단계. `verify.json`이 없었을 때만 생긴다. */
  readonly migrated: readonly VerifyStep[];
  /** 기존 `verify.json`의 형식이 틀려 손대지 않았다면 그 이유. */
  readonly invalid?: string;
}

/** 읽지 못하면(디렉터리 등) 어느 파일인지 밝혀 알린다. 호출한 쪽이 다른 파일을 쓰기 전에 실패하게 하려는 것이다. */
async function readConfig(path: string): Promise<string> {
  try {
    return await readFile(path, "utf8");
  } catch (error) {
    const code =
      error instanceof Error && "code" in error && typeof error.code === "string"
        ? error.code
        : String(error);
    throw new Error(`${VERIFY_CONFIG}을 읽을 수 없습니다 (${code})`, { cause: error });
  }
}

/**
 * 프리셋의 검증 명령을 `.agentsmd/verify.json`에 합친다. 단계 이름은 프리셋 이름이다.
 *
 * - 파일이 없으면 AGENTS.md `## 검증` 코드 블록의 명령을 `step-1`, `step-2`…로 먼저 옮기고(0.7 이하로 설치한 저장소),
 *   그 뒤에 프리셋 단계를 붙인다. 프리셋의 검증 명령과 같은 명령은 `step-N` 대신 프리셋 이름을 쓴다. 단계가 하나도 없으면 파일을 만들지 않는다.
 * - 파일이 있으면 프리셋 단계만 붙인다. 사람이 고친 단계는 `force`여도 지우지 않는다.
 *   형식이 틀린 파일은 고치지 않고 `invalid`로 알린다.
 *
 * AGENTS.md는 건드리지 않는다. `agentsMd`는 옮겨 올 명령을 읽기 위한 설치 전 내용이다.
 */
export async function installVerifyConfig(
  presets: readonly Preset[],
  targetDir: string,
  agentsMd: string | undefined,
): Promise<VerifyConfigResult> {
  const path = join(targetDir, VERIFY_CONFIG);
  const presetSteps = presets.flatMap((preset) =>
    preset.verify === undefined ? [] : [{ name: preset.name, run: preset.verify }],
  );

  let existing: readonly VerifyStep[] = [];
  let migrated: readonly VerifyStep[] = [];
  if (existsSync(path)) {
    const parsed = parseVerifyConfig(await readConfig(path));
    if (!parsed.ok) {
      return { written: false, added: [], migrated: [], invalid: parsed.error };
    }
    existing = parsed.steps;
  } else if (agentsMd !== undefined) {
    // 프리셋의 검증 명령과 같은 명령은 프리셋 이름을 단계 이름으로 쓴다. 옮긴 뒤에도 `--only java`로 고를 수 있게 한다.
    const presetNames = new Map(presetSteps.map((step) => [step.run.trim(), step.name]));
    const commands = verifyCommands(agentsMd).map((run, index): VerifyStep => ({
      name: presetNames.get(run.trim()) ?? `step-${String(index + 1)}`,
      run,
    }));
    // 같은 명령이 블록에 두 번 있으면 한 번만 옮긴다.
    const merged = mergeVerifySteps([], commands);
    existing = merged.steps;
    migrated = merged.added;
  }

  const merged = mergeVerifySteps(existing, presetSteps);
  if (merged.added.length === 0 && migrated.length === 0) {
    return { written: false, added: [], migrated: [] };
  }
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, renderVerifyConfig(merged.steps));
  return { written: true, added: merged.added, migrated };
}
