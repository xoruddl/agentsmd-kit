import { resolve } from "node:path";
import { parseArgs } from "node:util";
import {
  installEntryFiles,
  installPreset,
  type AgentsMdAdditions,
  type EntryFilesResult,
  type InstallResult,
  type Preset,
} from "@agentsmd/core";
import { configureHooksPath, type HooksResult } from "../git-hooks.js";
import { makeHooksExecutable } from "../hook-permissions.js";
import type { ExitCode, Io } from "../io.js";
import { PRESETS, selectPresets } from "../presets.js";

// 이름 열 너비를 가장 긴 이름에 맞춰 설명과 붙지 않게 한다.
const nameWidth = Math.max(...PRESETS.map((preset) => preset.name.length)) + 2;
const presetList = PRESETS.map(
  (preset) => `  ${preset.name.padEnd(nameWidth)}${preset.description}`,
).join("\n");

export const INIT_USAGE = `사용법: agentsmd init --preset <이름>[,<이름>...] [옵션]

AI 작업 지침(AGENTS.md, docs/)을 저장소에 설치합니다.
Git 훅은 git 프리셋, GitHub 템플릿은 github 프리셋을 고를 때만 설치합니다.
여러 프리셋을 고르면 문서 지도(AGENTS.md)를 적은 순서대로 합칩니다.
AGENTS.md가 이미 있으면 빠진 문서·규칙만 더하고, 다른 파일은 이미 있으면 건너뜁니다.

프리셋:
${presetList}

예:
  agentsmd init --preset git,typescript          Git 규칙과 TypeScript 규칙을 함께 설치
  agentsmd init --preset git,github,typescript   GitHub 템플릿까지 함께 설치
  agentsmd init --preset java                    Java 규칙만 설치

옵션:
  --preset <이름>   설치할 프리셋. 여러 개는 쉼표로 잇습니다 (필수)
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

  const selection = selectPresets(values.preset ?? "");
  if (!selection.ok || selection.presets.length === 0) {
    const reason = selection.ok
      ? "--preset 을 지정해야 합니다"
      : `알 수 없는 프리셋입니다: ${selection.unknown.join(", ")}`;
    io.stderr(`${reason}\n\n프리셋:\n${presetList}\n`);
    return 2;
  }

  const root = resolve(io.cwd, values.root ?? ".");
  const { presets } = selection;
  const result = await installAll(presets, root, values.force === true);
  const hooksPath = presets.find((p) => p.hooksPath !== undefined)?.hooksPath;
  if (hooksPath !== undefined) {
    // npm 패키지에서 풀린 훅은 실행 권한이 없으므로, 훅 연결 여부와 상관없이 권한을 맞춘다.
    await makeHooksExecutable(root, hooksPath);
  }
  const hooks =
    hooksPath === undefined || values["skip-hooks"] === true
      ? undefined
      : await configureHooksPath(root, hooksPath);

  io.stdout(formatReport(presets, result, hooksPath, hooks));
  return 0;
}

/** 프리셋 파일을 설치한 뒤, 고른 프리셋 조합에 맞춘 AGENTS.md·CLAUDE.md·훅 실행기를 만든다. */
async function installAll(
  presets: readonly Preset[],
  root: string,
  force: boolean,
): Promise<EntryFilesResult> {
  const written: string[] = [];
  const skipped: string[] = [];
  const collect = (result: InstallResult): void => {
    written.push(...result.written);
    skipped.push(...result.skipped);
  };
  for (const preset of presets) {
    collect(await installPreset(preset, root, { force }));
  }
  const entry = await installEntryFiles(presets, root, { force });
  collect(entry);
  return { written, skipped, merged: entry.merged };
}

function formatReport(
  presets: readonly Preset[],
  result: EntryFilesResult,
  hooksPath: string | undefined,
  hooks: HooksResult | undefined,
): string {
  const names = presets.map((preset) => preset.name).join(", ");
  const lines = [`${names} 프리셋: 파일 ${String(result.written.length)}개를 설치했습니다.`];
  if (result.merged !== undefined) {
    lines.push(formatMerged(result.merged));
  }

  if (result.skipped.length > 0) {
    lines.push(
      `이미 있어서 건너뛴 파일 ${String(result.skipped.length)}개 (덮어쓰려면 --force):`,
      ...result.skipped.map((file) => `  ${file}`),
    );
  }

  if (hooks === "configured") {
    lines.push(`Git 훅을 연결했습니다: core.hooksPath=${hooksPath ?? ""}`);
  } else if (hooks === "not-a-repo") {
    lines.push("Git 저장소가 아니어서 훅을 연결하지 않았습니다. git init 후 다시 실행하세요.");
  }

  const steps = [
    ...presets.flatMap((preset) => preset.nextSteps ?? []),
    "agentsmd check 로 문서 지도를 검사하세요.",
  ];
  lines.push("", "다음 단계:", ...steps.map((step, index) => `  ${String(index + 1)}. ${step}`));
  return `${lines.join("\n")}\n`;
}

/** 이미 있던 AGENTS.md에 무엇을 더했는지 한 줄로 알린다. */
function formatMerged(added: AgentsMdAdditions): string {
  const parts = [
    [added.docs.length, "문서"],
    [added.rules.length, "규칙"],
    [added.verify.length, "검증 명령"],
  ] as const;
  const counts = parts
    .filter(([count]) => count > 0)
    .map(([count, label]) => `${label} ${String(count)}개`);
  return counts.length === 0
    ? "AGENTS.md에 이미 모든 항목이 있어 바꾸지 않았습니다."
    : `기존 AGENTS.md에 ${counts.join(", ")}를 더했습니다.`;
}
