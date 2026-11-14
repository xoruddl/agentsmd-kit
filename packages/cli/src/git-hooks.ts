import { execFile } from "node:child_process";
import { resolve } from "node:path";
import { promisify } from "node:util";

const run = promisify(execFile);

export type HooksResult =
  | { readonly status: "configured" }
  | { readonly status: "not-a-repo" }
  /** 이미 다른 훅 디렉터리를 쓰고 있어 바꾸지 않았다. `current`는 그 값이다. */
  | { readonly status: "kept"; readonly current: string };

/**
 * 저장소의 `core.hooksPath`를 설치한 훅 디렉터리로 설정한다.
 *
 * 훅 파일만 복사하면 Git이 실행하지 않으므로, 템플릿을 쓸 때 사람이 따로 하던 설정을 대신한다.
 * Git 저장소가 아니면 설정하지 않고 알려 주기만 한다. 나중에 `git init` 한 뒤 다시 실행하면 된다.
 *
 * 이미 다른 값이 있으면 바꾸지 않는다. husky처럼 다른 도구의 훅이 조용히 꺼지기 때문이다.
 * `.git/config`의 변경은 diff에 보이지 않아, 꺼진 것을 사용자가 알아채기 어렵다.
 */
export async function configureHooksPath(dir: string, hooksPath: string): Promise<HooksResult> {
  if (!(await isGitRepository(dir))) {
    return { status: "not-a-repo" };
  }
  const current = await readHooksPath(dir);
  if (current !== undefined) {
    // `.githooks/`나 절대 경로처럼 표기만 다른 같은 디렉터리는 이미 연결된 것으로 본다.
    return resolve(dir, current) === resolve(dir, hooksPath)
      ? { status: "configured" }
      : { status: "kept", current };
  }
  await run("git", ["-C", dir, "config", "core.hooksPath", hooksPath]);
  return { status: "configured" };
}

/**
 * 지금 적용되는 `core.hooksPath`. 없으면 `undefined`.
 *
 * 저장소 설정만 보지 않고 전역 설정까지 합친 값을 읽는다.
 * 전역으로 훅 디렉터리를 쓰는 사용자도 저장소 설정을 더하면 그 훅이 꺼지기 때문이다.
 */
async function readHooksPath(dir: string): Promise<string | undefined> {
  try {
    const { stdout } = await run("git", ["-C", dir, "config", "--get", "core.hooksPath"]);
    const value = stdout.trim();
    return value === "" ? undefined : value;
  } catch {
    // 값이 없으면 git이 종료 코드 1로 끝난다.
    return undefined;
  }
}

async function isGitRepository(dir: string): Promise<boolean> {
  try {
    const { stdout } = await run("git", ["-C", dir, "rev-parse", "--is-inside-work-tree"]);
    return stdout.trim() === "true";
  } catch {
    return false;
  }
}
