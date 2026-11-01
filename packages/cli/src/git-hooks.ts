import { execFile } from "node:child_process";
import { promisify } from "node:util";

const run = promisify(execFile);

export type HooksResult = "configured" | "not-a-repo";

/**
 * 저장소의 `core.hooksPath`를 설치한 훅 디렉터리로 설정한다.
 *
 * 훅 파일만 복사하면 Git이 실행하지 않으므로, 템플릿을 쓸 때 사람이 따로 하던 설정을 대신한다.
 * Git 저장소가 아니면 설정하지 않고 알려 주기만 한다. 나중에 `git init` 한 뒤 다시 실행하면 된다.
 */
export async function configureHooksPath(dir: string, hooksPath: string): Promise<HooksResult> {
  if (!(await isGitRepository(dir))) {
    return "not-a-repo";
  }
  await run("git", ["-C", dir, "config", "core.hooksPath", hooksPath]);
  return "configured";
}

async function isGitRepository(dir: string): Promise<boolean> {
  try {
    const { stdout } = await run("git", ["-C", dir, "rev-parse", "--is-inside-work-tree"]);
    return stdout.trim() === "true";
  } catch {
    return false;
  }
}
