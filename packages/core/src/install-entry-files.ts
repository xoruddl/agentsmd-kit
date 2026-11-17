import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import {
  CLAUDE_MD,
  mergeAgentsMd,
  renderAgentsMd,
  type AgentsMdAdditions,
  type MergedAgentsMd,
  type UnplacedItems,
} from "./agents-md.js";
import { hasContent, type InstallOptions, type InstallResult } from "./install.js";
import { installVerifyConfig, type VerifyConfigResult } from "./install-verify-config.js";
import type { Preset } from "./preset.js";

const AGENTS_MD = "AGENTS.md";

interface EntryFile {
  readonly path: string;
  readonly content: string;
}

export interface EntryFilesResult extends InstallResult {
  /** 이미 있던 AGENTS.md에 합쳤으면 새로 넣은 항목. 새로 만들었거나 덮어썼으면 undefined. */
  readonly merged: AgentsMdAdditions | undefined;
  /** 이미 있던 AGENTS.md에서 넣을 절을 찾지 못해 넣지 않은 항목. 합치지 않았으면 undefined. */
  readonly unplaced: UnplacedItems | undefined;
  /** `.agentsmd/verify.json`에 합친 결과. */
  readonly verify: VerifyConfigResult;
}

/**
 * 여러 프리셋이 함께 쓰는 파일을 고른 프리셋에 맞게 만들어 설치한다.
 *
 * - `AGENTS.md`: 고른 프리셋들의 문서 지도를 합친 것
 * - `CLAUDE.md`: `AGENTS.md`를 불러오기만 한다
 * - `.agentsmd/verify.json`: 프리셋의 검증 명령 (옛 AGENTS.md 검증 블록의 명령은 처음 한 번 옮겨 온다)
 *
 * `AGENTS.md`가 이미 있으면 빠진 문서·규칙만 합친다. 프리셋을 나눠 설치해도 지도에서 빠지지 않게 하려는 것이다.
 * 나머지 파일은 프리셋 파일과 같은 규칙으로, 이미 있으면 건너뛴다. `force`면 모두 새로 쓴다.
 */
export async function installEntryFiles(
  presets: readonly Preset[],
  targetDir: string,
  options: InstallOptions = {},
): Promise<EntryFilesResult> {
  const force = options.force === true;
  const written: string[] = [];
  const skipped: string[] = [];
  // 옮겨 올 검증 명령은 합치거나 덮어쓰기 전의 AGENTS.md에서 읽는다.
  const previousAgentsMd = await readIfExists(join(targetDir, AGENTS_MD));
  // verify.json을 읽지 못하면 AGENTS.md·CLAUDE.md를 쓰기 전에 실패하도록 가장 먼저 합친다.
  const verify = await installVerifyConfig(presets, targetDir, previousAgentsMd);
  const merged = force ? undefined : await mergeExistingAgentsMd(presets, targetDir);

  for (const file of entryFiles(presets)) {
    const destination = join(targetDir, file.path);
    if (file.path === AGENTS_MD && merged !== undefined) {
      continue;
    }
    if (!force && existsSync(destination)) {
      if (!(await hasContent(destination, file.content))) {
        skipped.push(file.path);
      }
      continue;
    }
    await mkdir(dirname(destination), { recursive: true });
    await writeFile(destination, file.content);
    written.push(file.path);
  }

  return { written, skipped, merged: merged?.added, unplaced: merged?.unplaced, verify };
}

async function readIfExists(path: string): Promise<string | undefined> {
  return existsSync(path) ? readFile(path, "utf8") : undefined;
}

/** 이미 있는 AGENTS.md에 빠진 항목을 합친다. 파일이 없으면 undefined, 넣을 것이 없으면 파일을 건드리지 않는다. */
async function mergeExistingAgentsMd(
  presets: readonly Preset[],
  targetDir: string,
): Promise<MergedAgentsMd | undefined> {
  const path = join(targetDir, AGENTS_MD);
  if (!existsSync(path)) {
    return undefined;
  }
  const existing = await readFile(path, "utf8");
  const merged = mergeAgentsMd(existing, presets);
  if (merged.content !== existing) {
    await writeFile(path, merged.content);
  }
  return merged;
}

function entryFiles(presets: readonly Preset[]): EntryFile[] {
  return [
    { path: AGENTS_MD, content: renderAgentsMd(presets) },
    { path: "CLAUDE.md", content: CLAUDE_MD },
  ];
}
