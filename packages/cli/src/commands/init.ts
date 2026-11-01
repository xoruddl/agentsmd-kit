import { resolve } from "node:path";
import { parseArgs } from "node:util";
import { installPreset, type InstallResult, type Preset } from "@agentsmd/core";
import { configureHooksPath, type HooksResult } from "../git-hooks.js";
import type { ExitCode, Io } from "../io.js";
import { findPreset, PRESETS } from "../presets.js";

const presetList = PRESETS.map((preset) => `  ${preset.name.padEnd(8)}${preset.description}`).join(
  "\n",
);

export const INIT_USAGE = `사용법: agentsmd init --preset <이름> [옵션]

AI 작업 지침(AGENTS.md, docs/, Git 훅, CI)을 저장소에 설치하고 훅을 연결합니다.
이미 있는 파일은 덮어쓰지 않고 건너뜁니다.

프리셋:
${presetList}

옵션:
  --preset <이름>   설치할 프리셋 (필수)
  --root <경로>     설치할 저장소 루트 (기본값: 현재 디렉터리)
  --force           이미 있는 파일도 덮어씁니다
  --skip-hooks      core.hooksPath 를 설정하지 않습니다
  -h, --help        이 도움말
`;

/** `agentsmd init` 명령. 파일 설치 → 훅 연결 → 남은 수작업 안내 순서로 진행한다. */
export async function runInit(args: readonly string[], io: Io): Promise<ExitCode> {
  const { values } = parseArgs({
    args: [...args],
    strict: true,
    allowPositionals: false,
    options: {
      preset: { type: "string" },
      root: { type: "string" },
      force: { type: "boolean" },
      "skip-hooks": { type: "boolean" },
      help: { type: "boolean", short: "h" },
    },
  });

  if (values.help === true) {
    io.stdout(INIT_USAGE);
    return 0;
  }

  const preset = values.preset === undefined ? undefined : findPreset(values.preset);
  if (preset === undefined) {
    const reason =
      values.preset === undefined
        ? "--preset 을 지정해야 합니다"
        : `알 수 없는 프리셋입니다: ${values.preset}`;
    io.stderr(`${reason}\n\n프리셋:\n${presetList}\n`);
    return 2;
  }

  const root = resolve(io.cwd, values.root ?? ".");
  const result = await installPreset(preset, root, { force: values.force === true });
  const hooks =
    preset.hooksPath === undefined || values["skip-hooks"] === true
      ? undefined
      : await configureHooksPath(root, preset.hooksPath);

  io.stdout(formatReport(preset, result, hooks));
  return 0;
}

function formatReport(
  preset: Preset,
  result: InstallResult,
  hooks: HooksResult | undefined,
): string {
  const lines = [`${preset.name} 프리셋: 파일 ${String(result.written.length)}개를 설치했습니다.`];

  if (result.skipped.length > 0) {
    lines.push(
      `이미 있어서 건너뛴 파일 ${String(result.skipped.length)}개 (덮어쓰려면 --force):`,
      ...result.skipped.map((file) => `  ${file}`),
    );
  }

  if (hooks === "configured") {
    lines.push(`Git 훅을 연결했습니다: core.hooksPath=${preset.hooksPath ?? ""}`);
  } else if (hooks === "not-a-repo") {
    lines.push("Git 저장소가 아니어서 훅을 연결하지 않았습니다. git init 후 다시 실행하세요.");
  }

  const steps = [...(preset.nextSteps ?? []), "agentsmd check 로 문서 지도를 검사하세요."];
  lines.push("", "다음 단계:", ...steps.map((step, index) => `  ${String(index + 1)}. ${step}`));
  return `${lines.join("\n")}\n`;
}
