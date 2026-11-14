import { execFile } from "node:child_process";
import { realpath } from "node:fs/promises";
import { basename, dirname, join, posix, resolve } from "node:path";
import { promisify } from "node:util";

const run = promisify(execFile);

export type HooksResult =
  /** `path`는 `core.hooksPath`에 넣은(또는 이미 들어 있던 것과 같은) 값. 저장소 최상위 기준 상대 경로다. */
  | { readonly status: "configured"; readonly path: string }
  | { readonly status: "not-a-repo" }
  /**
   * 이미 다른 훅 디렉터리를 쓰고 있어 바꾸지 않았다.
   * `current`는 그 값, `scope`는 그 값이 적힌 곳(`local`, `global`, `system` 등 `git config --show-scope`의 표기)이다.
   * 오래된 Git이라 적힌 곳을 알 수 없으면 `scope`는 빈 문자열이다.
   */
  | {
      readonly status: "kept";
      readonly path: string;
      readonly current: string;
      readonly scope: string;
    }
  /** Git 명령이 실패해 연결하지 못했다. `detail`은 Git이 낸 오류의 첫 줄이다. */
  | { readonly status: "failed"; readonly detail: string };

interface CurrentHooksPath {
  readonly value: string;
  readonly scope: string;
}

interface WorkTree {
  /** 작업 트리의 최상위. Git이 심볼릭 링크를 푼 절대 경로로 알려 준다. */
  readonly top: string;
  /** 최상위에서 본 `dir`의 위치. 최상위면 빈 문자열, 아니면 `packages/a/`처럼 `/`로 끝난다. */
  readonly prefix: string;
}

/** Git이 "옵션을 모른다"고 끝낼 때의 종료 코드. */
const USAGE_ERROR = 129;

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
 *
 * Git 명령이 실패해도 던지지 않고 `failed`로 돌려준다. 파일 설치는 이미 끝났으므로 호출한 쪽이 설치 결과를 알릴 수 있어야 한다.
 * 실패를 "설정 없음"이나 "저장소 아님"으로 보지 않는다. 읽지 못한 기존 값을 덮어쓰거나 틀린 안내를 내게 된다.
 */
export async function configureHooksPath(dir: string, hooksPath: string): Promise<HooksResult> {
  try {
    return await configure(dir, hooksPath);
  } catch (error) {
    return { status: "failed", detail: describe(error) };
  }
}

async function configure(dir: string, hooksPath: string): Promise<HooksResult> {
  const tree = await findWorkTree(dir);
  if (tree === undefined) {
    return { status: "not-a-repo" };
  }
  const path = posix.join(tree.prefix, hooksPath);
  const target = resolve(tree.top, path);

  const current = await readHooksPath(dir);
  if (current !== undefined) {
    // `.githooks/`나 절대 경로처럼 표기만 다른 같은 디렉터리는 이미 연결된 것으로 본다.
    return (await canonical(resolve(tree.top, current.value))) === (await canonical(target))
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
  const get = ["--type=path", "--get", "core.hooksPath"];
  try {
    // 출력은 "<scope>\t<값>" 한 줄이다.
    const line = await readConfig(dir, ["--show-scope", ...get]);
    const tab = line?.indexOf("\t") ?? -1;
    return line === undefined || tab < 0
      ? undefined
      : toCurrent(line.slice(tab + 1), line.slice(0, tab));
  } catch (error) {
    // --show-scope는 Git 2.26부터 있다. 그보다 오래된 Git에서는 적힌 곳을 빼고 값만 읽는다.
    if (exitCode(error) !== USAGE_ERROR) {
      throw error;
    }
  }
  const value = await readConfig(dir, get);
  return value === undefined ? undefined : toCurrent(value, "");
}

function toCurrent(value: string, scope: string): CurrentHooksPath | undefined {
  return value === "" ? undefined : { value, scope };
}

/** `git config`의 출력 한 줄. 값이 없으면 `undefined`. 그 밖의 실패는 던진다. */
async function readConfig(dir: string, args: readonly string[]): Promise<string | undefined> {
  try {
    const { stdout } = await run("git", ["-C", dir, "config", ...args]);
    return stdout.replace(/\r?\n$/, "");
  } catch (error) {
    // 값이 없으면 git이 종료 코드 1로 끝난다.
    if (exitCode(error) === 1) {
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

/**
 * `dir`이 속한 작업 트리. Git 저장소가 아니면 `undefined`.
 *
 * 저장소가 아닌 것과 그 밖의 실패(소유권 검사, Git 없음 등)를 나눈다.
 * 섞으면 저장소인데도 "git init 후 다시 실행하세요"라고 안내하게 된다.
 */
async function findWorkTree(dir: string): Promise<WorkTree | undefined> {
  try {
    const { stdout } = await run(
      "git",
      ["-C", dir, "rev-parse", "--show-toplevel", "--show-prefix"],
      // 오류 문구로 "저장소 아님"을 가려내므로 번역되지 않은 문구를 받는다.
      { env: { ...process.env, LC_ALL: "C", LANGUAGE: "" } },
    );
    const [top = "", prefix = ""] = stdout.split(/\r?\n/);
    return { top, prefix };
  } catch (error) {
    if (stderrOf(error).includes("not a git repository")) {
      return undefined;
    }
    throw error;
  }
}

function exitCode(error: unknown): unknown {
  return typeof error === "object" && error !== null && "code" in error ? error.code : undefined;
}

function stderrOf(error: unknown): string {
  return typeof error === "object" &&
    error !== null &&
    "stderr" in error &&
    typeof error.stderr === "string"
    ? error.stderr
    : "";
}

/** 사용자에게 보일 실패 이유 한 줄. Git이 낸 문구가 있으면 그것을 쓴다. */
function describe(error: unknown): string {
  const stderr = stderrOf(error).trim();
  const message = stderr === "" && error instanceof Error ? error.message : stderr;
  return message.split(/\r?\n/)[0] ?? "";
}
