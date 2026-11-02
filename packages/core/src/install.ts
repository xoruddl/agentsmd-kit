import { copyFile, mkdir, readFile, readdir } from "node:fs/promises";
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
  /**
   * 이미 있는데 내용이 달라서 건드리지 않은 파일. 대상 디렉터리 기준 posix 경로.
   * 설치할 내용과 똑같은 파일은 할 일이 없으므로 어느 목록에도 넣지 않는다.
   */
  readonly skipped: readonly string[];
}

/**
 * 프리셋 파일을 대상 디렉터리에 복사한다.
 *
 * 기존 저장소에 적용할 때 사람이 다듬어 둔 지침을 지우지 않도록, 기본으로는 이미 있는 파일을 건너뛴다.
 * 내용이 같은 파일은 건너뛴 것으로 알리지 않는다. 같은 프리셋을 다시 설치해도 바뀐 것이 없으면 조용하다.
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
    const source = join(preset.filesDir, file);
    const destination = join(targetDir, file);
    if (options.force !== true && existsSync(destination)) {
      if (!(await hasContent(destination, await readFile(source)))) {
        skipped.push(file);
      }
      continue;
    }
    await mkdir(dirname(destination), { recursive: true });
    await copyFile(source, destination);
    written.push(file);
  }

  return { written, skipped };
}

/** 파일 내용이 주어진 내용과 바이트 단위로 같은지 본다. */
export async function hasContent(path: string, content: Uint8Array | string): Promise<boolean> {
  const existing = await readFile(path);
  return existing.equals(typeof content === "string" ? Buffer.from(content) : content);
}

/** 디렉터리 아래 모든 파일을 posix 상대 경로로, 정렬해서 돌려준다. */
async function listFiles(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { recursive: true, withFileTypes: true });
  return entries
    .filter((entry) => entry.isFile())
    .map((entry) => relative(dir, join(entry.parentPath, entry.name)).split(sep).join("/"))
    .sort();
}
