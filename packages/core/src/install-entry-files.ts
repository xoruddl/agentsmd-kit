import { existsSync } from "node:fs";
import { chmod, mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { CLAUDE_MD, renderAgentsMd } from "./agents-md.js";
import type { InstallOptions, InstallResult } from "./install.js";
import { PRE_COMMIT_HOOK } from "./pre-commit-hook.js";
import type { Preset } from "./preset.js";

interface EntryFile {
  readonly path: string;
  readonly content: string;
  readonly executable: boolean;
}

/**
 * 여러 프리셋이 함께 쓰는 파일을 고른 프리셋에 맞게 만들어 설치한다.
 *
 * - `AGENTS.md`: 고른 프리셋들의 문서 지도를 합친 것
 * - `CLAUDE.md`: `AGENTS.md`를 불러오기만 한다
 * - `<hooksPath>/pre-commit`: 훅이 있는 프리셋을 골랐을 때만. 각 프리셋의 `pre-commit.d/` 검사를 실행한다
 *
 * 프리셋 파일과 같은 규칙으로, 이미 있는 파일은 `force`가 아니면 건너뛴다.
 */
export async function installEntryFiles(
  presets: readonly Preset[],
  targetDir: string,
  options: InstallOptions = {},
): Promise<InstallResult> {
  const written: string[] = [];
  const skipped: string[] = [];

  for (const file of entryFiles(presets)) {
    const destination = join(targetDir, file.path);
    if (options.force !== true && existsSync(destination)) {
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

  return { written, skipped };
}

function entryFiles(presets: readonly Preset[]): EntryFile[] {
  const files: EntryFile[] = [
    { path: "AGENTS.md", content: renderAgentsMd(presets), executable: false },
    { path: "CLAUDE.md", content: CLAUDE_MD, executable: false },
  ];
  const hooksPath = presets.find((preset) => preset.hooksPath !== undefined)?.hooksPath;
  if (hooksPath !== undefined) {
    files.push({ path: `${hooksPath}/pre-commit`, content: PRE_COMMIT_HOOK, executable: true });
  }
  return files;
}
