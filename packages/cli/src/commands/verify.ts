import { readFile, stat } from "node:fs/promises";
import { join, resolve } from "node:path";
import { parseArgs } from "node:util";
import { parseVerifyConfig, VERIFY_CONFIG } from "@agentsmd/core";
import type { ExitCode, Io } from "../io.js";
import type { Runner } from "../runner.js";

export const VERIFY_USAGE = `사용법: agentsmd verify [옵션]

${VERIFY_CONFIG} 의 검증 단계를 파일 순서대로 실행합니다.
단계가 실패하면 거기서 멈춥니다. hook과 CI에서 이 명령 하나를 부르면 됩니다.

옵션:
  --root <경로>        검증할 저장소 루트 (기본값: 현재 디렉터리)
  --only <이름,이름>   고른 단계만 파일 순서대로 실행. 이름은 쉼표로 잇습니다
  -h, --help           이 도움말

종료 코드:
  0  모든 단계 통과
  1  검증 단계 실패
  2  옵션이 잘못됐거나 ${VERIFY_CONFIG} 가 없거나 형식이 틀림
`;

/** `agentsmd verify` 명령. 단계는 `runner`로 실행하고, 실패하면 남은 단계를 건너뛴다. */
export async function runVerify(
  args: readonly string[],
  io: Io,
  runner: Runner,
): Promise<ExitCode> {
  const { values } = parseArgs({
    args: [...args],
    strict: true,
    allowPositionals: false,
    options: {
      root: { type: "string" },
      only: { type: "string" },
      help: { type: "boolean", short: "h" },
    },
  });

  if (values.help === true) {
    io.stdout(VERIFY_USAGE);
    return 0;
  }

  const empty = (["root", "only"] as const).find((option) => values[option]?.trim() === "");
  if (empty !== undefined) {
    io.stderr(`--${empty} 값이 비어 있습니다. 옵션을 빼면 기본값을 씁니다.\n`);
    return 2;
  }

  const root = resolve(io.cwd, values.root ?? ".");
  if (!(await isDirectory(root))) {
    io.stderr(`루트 디렉터리가 없습니다: ${root}\n`);
    return 2;
  }

  const read = await readConfig(root);
  if (read.kind === "missing") {
    io.stderr(`${VERIFY_CONFIG} 이 없습니다. agentsmd init 으로 만드세요\n`);
    return 2;
  }
  if (read.kind === "unreadable") {
    io.stderr(`${VERIFY_CONFIG} 을 읽을 수 없습니다 (${read.reason})\n`);
    return 2;
  }
  const parsed = parseVerifyConfig(read.json);
  if (!parsed.ok) {
    io.stderr(`${parsed.error}\n`);
    return 2;
  }

  let steps = parsed.steps;
  if (values.only !== undefined) {
    // `a,`나 `a,,b`의 빈 항목은 무시한다. 남는 이름이 없으면 빈 값과 같이 거부한다.
    const wanted = values.only
      .split(",")
      .map((name) => name.trim())
      .filter((name) => name !== "");
    if (wanted.length === 0) {
      io.stderr("--only 값이 비어 있습니다. 옵션을 빼면 기본값을 씁니다.\n");
      return 2;
    }
    const known = parsed.steps.map((step) => step.name);
    const missing = wanted.filter((name) => !known.includes(name));
    if (missing.length > 0) {
      io.stderr(`없는 단계: ${missing.join(", ")} (있는 단계: ${known.join(", ")})\n`);
      return 2;
    }
    steps = parsed.steps.filter((step) => wanted.includes(step.name));
  }

  for (const [index, step] of steps.entries()) {
    const label = `[verify ${String(index + 1)}/${String(steps.length)} ${step.name}] ${step.run}`;
    io.stdout(`${label}\n`);
    const code = await runner.run(step.run, root);
    if (code !== 0) {
      io.stderr(`검증 실패: ${label} (종료 코드 ${String(code)})\n`);
      return 1;
    }
  }
  io.stdout(`검증 통과 (${String(steps.length)}단계)\n`);
  return 0;
}

async function isDirectory(path: string): Promise<boolean> {
  try {
    return (await stat(path)).isDirectory();
  } catch {
    return false;
  }
}

type ConfigRead =
  | { readonly kind: "found"; readonly json: string }
  | { readonly kind: "missing" }
  | { readonly kind: "unreadable"; readonly reason: string };

/** 파일이 없으면 `missing`, 그 밖의 읽기 오류(디렉터리·권한 등)는 오류 코드와 함께 `unreadable`. */
async function readConfig(root: string): Promise<ConfigRead> {
  try {
    return { kind: "found", json: await readFile(join(root, VERIFY_CONFIG), "utf8") };
  } catch (error) {
    if (error instanceof Error && "code" in error && typeof error.code === "string") {
      return error.code === "ENOENT"
        ? { kind: "missing" }
        : { kind: "unreadable", reason: error.code };
    }
    throw error;
  }
}
