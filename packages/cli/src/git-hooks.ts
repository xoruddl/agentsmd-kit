import { execFile } from "node:child_process";
import { realpath } from "node:fs/promises";
import { basename, dirname, join, relative, resolve, sep } from "node:path";
import { promisify } from "node:util";

const run = promisify(execFile);

export type HooksResult =
  /** `path`는 `core.hooksPath`에 넣은(또는 이미 들어 있던 것과 같은) 값. 저장소 최상위 기준 상대 경로다. */
  | { readonly status: "configured"; readonly path: string }
  | { readonly status: "not-a-repo" }
  /**
   * 이미 다른 훅 디렉터리를 쓰고 있어 바꾸지 않았다.
   * `current`는 그 값, `scope`는 그 값이 적힌 곳(`local`, `global`, `system` 등 `git config --show-scope`의 표기)이다.
   */
  | {
      readonly status: "kept";
      readonly path: string;
      readonly current: string;
      readonly scope: string;
    };

interface CurrentHooksPath {
  readonly value: string;
  readonly scope: string;
}

/**
 * 저장소의 `core.hooksPath`를 설치한 훅 디렉터리로 설정한다.
 *
 * 훅 파일만 복사하면 Git이 실행하지 않으므로, 템플릿을 쓸 때 사람이 따로 하던 설정을 대신한다.
 * Git 저장소가 아니면 설정하지 않고 알려 주기만 한다. 나중에 `git init` 한 뒤 다시 실행하면 된다.
 *
 * Git은 상대 경로인 `core.hooksPath`를 저장소 최상위 기준으로 해석한다.
 * 그래서 `dir`이 저장소의 하위 디렉터리여도 최상위 기준 경로로 바꿔 넣고, 기존 값과 견줄 때도 최상위 기준으로 푼다.
 *
 * 이미 다른 값이 있으면 바꾸지 않는다. husky처럼 다른 도구의 훅이 조용히 꺼지기 때문이다.
 * `.git/config`의 변경은 diff에 보이지 않아, 꺼진 것을 사용자가 알아채기 어렵다.
 */
export async function configureHooksPath(dir: string, hooksPath: string): Promise<HooksResult> {
  const top = await findTopLevel(dir);
  if (top === undefined) {
    return { status: "not-a-repo" };
  }
  // Git이 알려 주는 최상위는 심볼릭 링크를 푼 경로다. `dir`도 풀어야 둘 사이의 상대 경로가 맞는다.
  const target = resolve(await canonical(dir), hooksPath);
  const path = relative(top, target).split(sep).join("/");

  const current = await readHooksPath(dir);
  if (current !== undefined) {
    // `.githooks/`나 절대 경로처럼 표기만 다른 같은 디렉터리는 이미 연결된 것으로 본다.
    return (await canonical(resolve(top, current.value))) === (await canonical(target))
      ? { status: "configured", path }
      : { status: "kept", path, current: current.value, scope: current.scope };
  }
  await run("git", ["-C", dir, "config", "core.hooksPath", path]);
  return { status: "configured", path };
}

/**
 * 지금 적용되는 `core.hooksPath`와 그 값이 적힌 곳. 없으면 `undefined`.
 *
 * 저장소 설정만 보지 않고 전역 설정까지 합친 값을 읽는다.
 * 전역으로 훅 디렉터리를 쓰는 사용자도 저장소 설정을 더하면 그 훅이 꺼지기 때문이다.
 * `--type=path`로 읽어 `~/hooks` 같은 값을 Git과 같은 방식으로 편다.
 */
async function readHooksPath(dir: string): Promise<CurrentHooksPath | undefined> {
  try {
    const { stdout } = await run("git", [
      "-C",
      dir,
      "config",
      "--show-scope",
      "--type=path",
      "--get",
      "core.hooksPath",
    ]);
    // 출력은 "<scope>\t<값>" 한 줄이다.
    const line = stdout.replace(/\r?\n$/, "");
    const tab = line.indexOf("\t");
    const value = line.slice(tab + 1);
    return value === "" ? undefined : { value, scope: line.slice(0, Math.max(tab, 0)) };
  } catch (error) {
    // 값이 없으면 git이 종료 코드 1로 끝난다. 그 밖의 실패를 "없음"으로 보면 읽지 못한 기존 값을 덮어쓰게 된다.
    if (typeof error === "object" && error !== null && "code" in error && error.code === 1) {
      return undefined;
    }
    throw error;
  }
}

/**
 * 심볼릭 링크를 푼 경로. 아직 없는 경로는 있는 상위 디렉터리까지만 풀고 나머지를 그대로 붙인다.
 * macOS의 `/var`처럼 상위가 링크면, 없는 디렉터리를 가리키는 값도 같은 기준으로 견줄 수 있어야 한다.
 */
async function canonical(path: string): Promise<string> {
  try {
    return await realpath(path);
  } catch {
    const parent = dirname(path);
    return parent === path ? path : join(await canonical(parent), basename(path));
  }
}

/** `dir`이 속한 작업 트리의 최상위. Git 저장소가 아니면 `undefined`. */
async function findTopLevel(dir: string): Promise<string | undefined> {
  try {
    const { stdout } = await run("git", ["-C", dir, "rev-parse", "--show-toplevel"]);
    const top = stdout.replace(/\r?\n$/, "");
    return top === "" ? undefined : top;
  } catch {
    return undefined;
  }
}
