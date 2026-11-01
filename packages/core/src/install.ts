import { copyFile, mkdir, readdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { dirname, join, relative, sep } from "node:path";
import type { Preset } from "./preset.js";

export interface InstallOptions {
  /** 이미 있는 파일도 덮어쓴다. 기본값 false. */
  readonly force?: boolean;
}

export interface InstallResult {
  /** 새로 만들었거나 덮어쓴 파일. 대상 디렉터리 기준 posix 경로. */
  readonly written: readonly string[];
  /** 이미 있어서 건드리지 않은 파일. 대상 디렉터리 기준 posix 경로. */
  readonly skipped: readonly string[];
}

/**
 * 프리셋 파일을 대상 디렉터리에 복사한다.
 *
 * 기존 저장소에 적용할 때 사람이 다듬어 둔 지침을 지우지 않도록, 기본으로는 이미 있는 파일을 건너뛴다.
 * 파일 권한도 함께 복사되므로 Git 훅의 실행 권한이 유지된다.
 */
export async function installPreset(
  preset: Preset,
  targetDir: string,
  options: InstallOptions = {},
): Promise<InstallResult> {
  const written: string[] = [];
  const skipped: string[] = [];

  for (const file of await listFiles(preset.filesDir)) {
    const destination = join(targetDir, file);
    if (options.force !== true && existsSync(destination)) {
      skipped.push(file);
      continue;
    }
    await mkdir(dirname(destination), { recursive: true });
    await copyFile(join(preset.filesDir, file), destination);
    written.push(file);
  }

  return { written, skipped };
}

/** 디렉터리 아래 모든 파일을 posix 상대 경로로, 정렬해서 돌려준다. */
async function listFiles(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { recursive: true, withFileTypes: true });
  return entries
    .filter((entry) => entry.isFile())
    .map((entry) => relative(dir, join(entry.parentPath, entry.name)).split(sep).join("/"))
    .sort();
}
