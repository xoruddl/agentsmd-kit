import { resolve } from "node:path";
import { parseArgs } from "node:util";
import {
  installEntryFiles,
  installPreset,
  type AgentsMdAdditions,
  type EntryFilesResult,
  type Preset,
  type UnplacedItems,
} from "@agentsmd/core";
import { configureHooksPath, type HooksResult } from "../git-hooks.js";
import { makeHooksExecutable } from "../hook-permissions.js";
import type { ExitCode, Io } from "../io.js";
import { PRESETS, selectPresets, type AddedPreset } from "../presets.js";

// 이름 열 너비를 가장 긴 이름에 맞춰 설명과 붙지 않게 한다.
const nameWidth = Math.max(...PRESETS.map((preset) => preset.name.length)) + 2;
const presetList = PRESETS.map(
  (preset) => `  ${preset.name.padEnd(nameWidth)}${preset.description}`,
).join("\n");
// `PRESETS`에 적힌 순서대로 "github → git, java → project, spring → java, ..."처럼 잇는다.
const requiresList = PRESETS.flatMap((preset) =>
  (preset.requires ?? []).map((required) => `${preset.name} → ${required}`),
).join(", ");

export const INIT_USAGE = `사용법: agentsmd init --preset <이름>[,<이름>...] [옵션]

AI 작업 지침(AGENTS.md, docs/)을 저장소에 설치합니다.
Git 훅은 git 프리셋에, GitHub 템플릿은 github 프리셋에 들어 있습니다.
다른 프리셋이 있어야 하는 프리셋을 고르면 그 프리셋을 먼저 함께 설치합니다 (${requiresList}).
함께 설치하는 프리셋에 Git 훅이 있으면 그 훅도 설치하고 연결합니다.
여러 프리셋을 고르면 문서 지도(AGENTS.md)를 설치한 순서대로 합칩니다.
AGENTS.md가 이미 있으면 빠진 문서·규칙만 더하고, 다른 파일은 이미 있으면 건너뜁니다.
AGENTS.md에 '## 문서 지도' 절이 없으면 바꾸지 않고 직접 옮길 항목을 알려 줍니다.

프리셋:
${presetList}

예:
  agentsmd init --preset git,typescript          Git 규칙과 TypeScript 규칙을 함께 설치
  agentsmd init --preset git,github,typescript   GitHub 템플릿까지 함께 설치
  agentsmd init --preset git,typescript,react    React 프론트엔드 규칙까지 함께 설치
  agentsmd init --preset git,java,spring         Spring Boot 서버 규칙까지 함께 설치
  agentsmd init --preset java                    Git 규칙 없이 Java 규칙과 프로젝트 방향 문서만 설치

옵션:
  --preset <이름>   설치할 프리셋. 여러 개는 쉼표로 잇습니다 (필수)
  --root <경로>     설치할 저장소 루트 (기본값: 현재 디렉터리)
  --force           직접 고른 프리셋의 파일을 이미 있어도 덮어쓰고, AGENTS.md 를 새로 만듭니다
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
  // 필요해서 더한 프리셋도 직접 고른 것과 같이 설치한다. `--preset github`은 `--preset git,github`과 같다.
  // 이미 설치돼 있는지 추측해서 건너뛰지 않는다. 빠진 파일은 채우고 있는 파일은 그대로 두는 기존 동작이면 충분하다.
  const { presets, added } = selection;
  const result = await installAll(presets, added, root, values.force === true);
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

/** 고르지 않았지만 함께 설치한 프리셋 하나에서 일어난 일. */
interface AddedResult extends AddedPreset {
  /** 새로 쓴 파일 수. 0이면 이미 설치돼 있던 것이다. */
  readonly written: number;
  /** 이미 있고 내용이 달라 그대로 둔 파일. */
  readonly skipped: readonly string[];
}

/** `skipped`에는 직접 고른 프리셋과 공통 파일에서 건너뛴 것만 담는다. 함께 설치한 프리셋의 것은 `added`에 있다. */
interface InitResult extends EntryFilesResult {
  readonly added: readonly AddedResult[];
}

/**
 * 프리셋 파일을 설치한 뒤, 프리셋 조합에 맞춘 AGENTS.md·CLAUDE.md를 만든다.
 *
 * `--force`의 파일 덮어쓰기는 사용자가 고른 프리셋에만 적용한다. 고르지 않았는데 함께 설치하는 프리셋의
 * 문서를 사람이 다듬어 뒀거나 그 자리에 다른 파일(예: `.nvmrc`)이 있으면 덮어쓰지 않는다.
 */
async function installAll(
  presets: readonly Preset[],
  added: readonly AddedPreset[],
  root: string,
  force: boolean,
): Promise<InitResult> {
  const reasonByName = new Map(added.map((item) => [item.name, item]));
  const written: string[] = [];
  const skipped: string[] = [];
  const addedResults: AddedResult[] = [];
  for (const preset of presets) {
    const reason = reasonByName.get(preset.name);
    const result = await installPreset(preset, root, { force: force && reason === undefined });
    written.push(...result.written);
    if (reason === undefined) {
      skipped.push(...result.skipped);
    } else {
      addedResults.push({ ...reason, written: result.written.length, skipped: result.skipped });
    }
  }
  const entry = await installEntryFiles(presets, root, { force });
  written.push(...entry.written);
  skipped.push(...entry.skipped);
  return { written, skipped, merged: entry.merged, unplaced: entry.unplaced, added: addedResults };
}

function formatReport(
  presets: readonly Preset[],
  result: InitResult,
  hooksPath: string | undefined,
  hooks: HooksResult | undefined,
): string {
  const names = presets.map((preset) => preset.name).join(", ");
  const lines = [`${names} 프리셋: 파일 ${String(result.written.length)}개를 설치했습니다.`];
  if (result.added.length > 0) {
    // 고르지 않은 프리셋의 파일과 규칙이 생기므로, 무엇이 왜 더해졌는지 알린다.
    const reasons = result.added.map(
      ({ name, requiredBy, written }) =>
        `${name} (${requiredBy}에 필요${written === 0 ? ", 이미 있어 새로 쓴 파일 없음" : ""})`,
    );
    lines.push(`고르지 않았지만 필요한 프리셋을 함께 설치했습니다: ${reasons.join(", ")}`);
  }
  const unplaced = result.unplaced === undefined ? [] : formatUnplaced(result.unplaced);
  if (result.merged !== undefined && unplaced.length === 0) {
    lines.push(formatMerged(result.merged));
  }
  lines.push(...unplaced);

  if (result.skipped.length > 0) {
    lines.push(
      `이미 있어서 건너뛴 파일 ${String(result.skipped.length)}개 (덮어쓰려면 --force):`,
      ...result.skipped.map((file) => `  ${file}`),
    );
  }
  const addedSkipped = result.added.flatMap((item) => item.skipped);
  if (addedSkipped.length > 0) {
    // --force는 함께 설치한 프리셋의 파일을 덮지 않으므로, 위 안내와 달리 원본으로 되돌리는 방법을 따로 알린다.
    // 프로젝트 방향 문서처럼 사람이 채우는 파일이 여기에 자주 오므로, 덮어쓰기를 권하는 말투로 쓰지 않는다.
    lines.push(
      `함께 설치한 프리셋의 파일 ${String(addedSkipped.length)}개는 이미 있고 내용이 달라 그대로 두었습니다 (원본으로 되돌릴 때만 그 프리셋을 --preset 에 직접 적고 --force):`,
      ...addedSkipped.map((file) => `  ${file}`),
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

/**
 * AGENTS.md에 넣지 못한 항목을 사람이 옮길 수 있는 모양으로 보여 준다. 없으면 빈 배열.
 * 문서는 표 행으로 보여 주어 기존 문서 표에 그대로 붙일 수 있게 한다.
 */
function formatUnplaced(unplaced: UnplacedItems): string[] {
  const groups = [
    ["문서", unplaced.docs.map((doc) => `[${doc.path}](${doc.path}) | ${doc.when}`)],
    ["규칙", unplaced.rules],
    ["검증 명령", unplaced.verify],
  ] as const;
  const body = groups
    .filter(([, items]) => items.length > 0)
    .flatMap(([label, items]) => [`  ${label}:`, ...items.map((item) => `    ${item}`)]);
  if (body.length === 0) {
    return [];
  }
  return [
    "AGENTS.md에 '## 문서 지도' 절이 없어 아래 항목을 넣지 않았습니다.",
    "같은 역할을 하는 기존 절에 직접 옮기세요. 옮기기 전에는 agentsmd check 가 지도에 없는 문서를 알립니다.",
    ...body,
  ];
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
