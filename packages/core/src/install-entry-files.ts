import { existsSync } from "node:fs";
import { chmod, mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { CLAUDE_MD, mergeAgentsMd, renderAgentsMd, type AgentsMdAdditions } from "./agents-md.js";
import type { InstallOptions, InstallResult } from "./install.js";
import { PRE_COMMIT_HOOK } from "./pre-commit-hook.js";
import type { Preset } from "./preset.js";

const AGENTS_MD = "AGENTS.md";

interface EntryFile {
  readonly path: string;
  readonly content: string;
  readonly executable: boolean;
}

export interface EntryFilesResult extends InstallResult {
  /** 이미 있던 AGENTS.md에 합쳤으면 새로 넣은 항목. 새로 만들었거나 덮어썼으면 undefined. */
  readonly merged: AgentsMdAdditions | undefined;
}

/**
 * 여러 프리셋이 함께 쓰는 파일을 고른 프리셋에 맞게 만들어 설치한다.
 *
 * - `AGENTS.md`: 고른 프리셋들의 문서 지도를 합친 것
 * - `CLAUDE.md`: `AGENTS.md`를 불러오기만 한다
 * - `<hooksPath>/pre-commit`: 훅이 있는 프리셋을 골랐을 때만. 각 프리셋의 `pre-commit.d/` 검사를 실행한다
 *
 * `AGENTS.md`가 이미 있으면 빠진 문서·규칙·검증 명령만 합친다. 프리셋을 나눠 설치해도 지도에서 빠지지 않게 하려는 것이다.
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
  const merged = force ? undefined : await mergeExistingAgentsMd(presets, targetDir);

  for (const file of entryFiles(presets)) {
    const destination = join(targetDir, file.path);
    if (file.path === AGENTS_MD && merged !== undefined) {
      continue;
    }
    if (!force && existsSync(destination)) {
      skipped.push(file.path);
      continue;
    }
    await mkdir(dirname(destination), { recursive: true });
    await writeFile(destination, file.content);
    if (file.executable) {
      await chmod(destination, 0o755);
    }
    written.push(file.path);
  }

  return { written, skipped, merged };
}

/** 이미 있는 AGENTS.md에 빠진 항목을 합친다. 파일이 없으면 undefined, 넣을 것이 없으면 파일을 건드리지 않는다. */
async function mergeExistingAgentsMd(
  presets: readonly Preset[],
  targetDir: string,
): Promise<AgentsMdAdditions | undefined> {
  const path = join(targetDir, AGENTS_MD);
  if (!existsSync(path)) {
    return undefined;
  }
  const existing = await readFile(path, "utf8");
  const { content, added } = mergeAgentsMd(existing, presets);
  if (content !== existing) {
    await writeFile(path, content);
  }
  return added;
}

function entryFiles(presets: readonly Preset[]): EntryFile[] {
  const files: EntryFile[] = [
    { path: AGENTS_MD, content: renderAgentsMd(presets), executable: false },
    { path: "CLAUDE.md", content: CLAUDE_MD, executable: false },
  ];
  const hooksPath = presets.find((preset) => preset.hooksPath !== undefined)?.hooksPath;
  if (hooksPath !== undefined) {
    files.push({ path: `${hooksPath}/pre-commit`, content: PRE_COMMIT_HOOK, executable: true });
  }
  return files;
}
