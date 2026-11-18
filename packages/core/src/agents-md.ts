import { findSection, insertSection, lastContentLine } from "./markdown-sections.js";
import { formatTable, parseTableRow } from "./markdown-table.js";
import { parseDocMap } from "./parse-doc-map.js";
import type { DocMapEntry, Preset } from "./preset.js";
import { resolveLink } from "./resolve-link.js";

/** Claude Code가 AGENTS.md를 읽도록 불러오기만 하는 CLAUDE.md. 규칙이 두 곳으로 갈라지지 않게 한다. */
export const CLAUDE_MD = `@AGENTS.md

<!-- 규칙은 이 파일에 쓰지 않는다. AGENTS.md 와 docs/ 에만 작성한다. -->
`;

/** 프리셋이 아무것도 넣지 않은 AGENTS.md. 여기에 프리셋을 합치면 새 지도가 된다. */
const SKELETON = `# AGENTS.md

에이전트 작업 지침의 진입점. 작업 전 이 파일을 읽고, 작업 종류에 맞는 문서를 연다.

## 지침 관리

- 지침 추가·변경 요청은 메모리에 저장하지 않는다. 이 파일이나 \`docs/\` 에 반영한다.
- 새 문서를 만들면 위 문서 지도에 한 줄 추가한다.
- 문서 수정도 코드와 같은 커밋 규칙을 따른다.
`;

const DOCS = "문서 지도";
const RULES = "핵심 규칙";
const VERIFY = "검증";
/** 절을 새로 만들 때 이 순서를 지킨다. */
const SECTION_ORDER = [DOCS, RULES, VERIFY, "지침 관리"];

const RULES_INTRO = "문서를 다 읽지 못했더라도 아래는 반드시 지킨다.";
/** 검증 절에는 명령 목록 대신 이 한 줄만 둔다. 단계 목록은 `.agentsmd/verify.json`이 갖는다. */
const VERIFY_COMMAND = "agentsmd verify";
const VERIFY_GUIDE =
  "작업을 마치기 전에 `agentsmd verify` 를 실행하고 결과를 그대로 보고한다. 단계 목록은 `.agentsmd/verify.json`.";
const LIST_ITEM = /^(\d+)\.\s+(.*)$|^[-*]\s+(.*)$/;

/** 합치면서 새로 넣은 항목. */
export interface AgentsMdAdditions {
  /** 문서 지도에 넣은 문서 경로. */
  readonly docs: readonly string[];
  readonly rules: readonly string[];
  /** `## 검증` 절이 없어 안내 한 줄을 넣었는가. */
  readonly verifyGuide: boolean;
}

/** 넣을 절을 찾지 못해 AGENTS.md에 넣지 않은 항목. 사람이 기존 절에 옮겨야 한다. */
export interface UnplacedItems {
  readonly docs: readonly DocMapEntry[];
  readonly rules: readonly string[];
  /** 안내 한 줄을 넣지 못했고 AGENTS.md가 `agentsmd verify`를 따로 알리지도 않을 때, 사람이 옮길 안내 줄. */
  readonly verify: readonly string[];
}

export interface MergedAgentsMd {
  readonly content: string;
  readonly added: AgentsMdAdditions;
  readonly unplaced: UnplacedItems;
}

/** 고른 프리셋들의 문서·규칙으로 새 AGENTS.md를 만든다. 검증 명령이 있으면 검증 절에 안내 한 줄을 둔다. */
export function renderAgentsMd(presets: readonly Preset[]): string {
  return merge(SKELETON, presets).content;
}

/**
 * 이미 있는 AGENTS.md에 프리셋의 문서·규칙 가운데 빠진 것만 넣는다.
 *
 * 프리셋을 나눠 설치해도 지도에서 문서가 빠지지 않게 하려는 것이다. 설치 순서와 상관없이 같은 항목이 모이고,
 * 같은 프리셋을 다시 합치면 아무것도 바뀌지 않는다. 사람이 고쳐 둔 줄은 지우거나 바꾸지 않는다.
 *
 * - 문서: 이미 링크된 문서는 건너뛰고, `## 문서 지도` 표 끝에 행을 더한다. 표 정렬은 다시 맞춘다.
 * - 규칙: 같은 문장이 없으면 `## 핵심 규칙` 목록 끝에 이어 붙인다.
 * - 검증: 프리셋에 검증 명령이 있는데 `## 검증` 절이 없으면 `agentsmd verify` 안내 한 줄만 둔 절을 만든다.
 *   명령은 AGENTS.md가 아니라 `.agentsmd/verify.json`에 두므로, 절이 이미 있으면 사람이 쓴 것으로 보고 건드리지 않는다.
 *
 * `## 문서 지도` 절이 있으면 빠진 절·표·목록을 새로 만든다.
 * 없으면 사람이 다른 이름(예: `## 작업 전 읽을 문서`)으로 쓴 지침으로 보고 아무것도 넣지 않는다.
 * 같은 역할의 절을 하나 더 만들면 지침이 두 벌이 되기 때문이다. 넣지 못한 항목은 `unplaced`로 돌려준다.
 * 검증 안내 줄도 같다. 절이 이미 있어 넣지 못했고 글 어디에도 `agentsmd verify`가 없으면 `unplaced.verify`로 돌려준다.
 */
export function mergeAgentsMd(existing: string, presets: readonly Preset[]): MergedAgentsMd {
  if (findSection(existing.split(/\r?\n/), DOCS) === undefined) {
    return {
      content: existing,
      added: { docs: [], rules: [], verifyGuide: false },
      unplaced: unplacedItems(existing, presets),
    };
  }
  return merge(existing, presets);
}

/** 문서 지도 절이 없는 AGENTS.md에 없는 항목. 규칙은 파일 어디에든 같은 문장이 있으면 이미 있는 것으로 본다. */
function unplacedItems(existing: string, presets: readonly Preset[]): UnplacedItems {
  const absent = (item: string): boolean => !existing.includes(item.trim());
  return {
    docs: missingDocs(existing, presets),
    rules: missingItems(
      [],
      presets.flatMap((preset) => preset.rules ?? []),
    ).filter(absent),
    verify: unplacedVerifyGuide(existing, presets),
  };
}

/** 검증 안내를 넣지 못한 채 끝났을 때, 사람이 넣어야 할 안내 줄. 프리셋에 검증 명령이 없거나 이미 안내가 있으면 없다. */
function unplacedVerifyGuide(content: string, presets: readonly Preset[]): string[] {
  const needed = presets.some((preset) => preset.verify !== undefined);
  return needed && !content.includes(VERIFY_COMMAND) ? [VERIFY_GUIDE] : [];
}

function merge(existing: string, presets: readonly Preset[]): MergedAgentsMd {
  let lines = existing.split(/\r?\n/);

  const docs = missingDocs(existing, presets);
  lines = addDocs(lines, docs);

  const rules = missingItems(
    listItems(lines),
    presets.flatMap((preset) => preset.rules ?? []),
  );
  lines = addRules(lines, rules);

  const verifyGuide =
    presets.some((preset) => preset.verify !== undefined) &&
    findSection(lines, VERIFY) === undefined;
  if (verifyGuide) {
    lines = insertSection(lines, VERIFY, [VERIFY_GUIDE], later(VERIFY));
  }

  const content = `${lines.join("\n").replace(/\s+$/, "")}\n`;
  return {
    content,
    added: { docs: docs.map((doc) => doc.path), rules, verifyGuide },
    // 안내 절을 방금 만들었으면 글에 이미 들어 있으므로 비게 된다.
    unplaced: { docs: [], rules: [], verify: unplacedVerifyGuide(content, presets) },
  };
}

/** 프리셋 문서 가운데 AGENTS.md에서 아직 링크하지 않은 것. */
function missingDocs(existing: string, presets: readonly Preset[]): DocMapEntry[] {
  const linked = new Set(
    parseDocMap("AGENTS.md", existing).links.flatMap(
      (link) => resolveLink("AGENTS.md", link.target) ?? [],
    ),
  );
  return uniqueByPath(presets.flatMap((preset) => preset.docs ?? [])).filter(
    (doc) => !linked.has(doc.path),
  );
}

function addDocs(lines: string[], docs: readonly DocMapEntry[]): string[] {
  if (docs.length === 0) {
    return lines;
  }
  const newRows = docs.map((doc) => [`[${doc.path}](${doc.path})`, doc.when]);
  const section = findSection(lines, DOCS);
  if (section === undefined) {
    return insertSection(lines, DOCS, docsTable(newRows), later(DOCS));
  }

  const tableStart = findIndexIn(lines, section.start + 1, section.end, isTableLine);
  if (tableStart === undefined) {
    const at = lastContentLine(lines, section) + 1;
    return splice(lines, at, 0, ["", ...docsTable(newRows)]);
  }
  const tableEnd =
    findIndexIn(lines, tableStart, section.end, (line) => !isTableLine(line)) ?? section.end;
  const [header = [], , ...rows] = lines.slice(tableStart, tableEnd).map(parseTableRow);
  const table = formatTable(header, [...rows, ...newRows]).split("\n");
  return splice(lines, tableStart, tableEnd - tableStart, table);
}

function addRules(lines: string[], rules: readonly string[]): string[] {
  if (rules.length === 0) {
    return lines;
  }
  const section = findSection(lines, RULES);
  if (section === undefined) {
    return insertSection(lines, RULES, [RULES_INTRO, "", ...numbered(rules, 1)], later(RULES));
  }

  const lastItem = findLastIndexIn(lines, section.start + 1, section.end, (line) =>
    LIST_ITEM.test(line),
  );
  if (lastItem === undefined) {
    const at = lastContentLine(lines, section) + 1;
    return splice(lines, at, 0, ["", ...numbered(rules, 1)]);
  }
  // 목록의 마지막 항목이 여러 줄이면 들여쓴 이어지는 줄 뒤에 넣는다.
  let at = lastItem + 1;
  while (at < section.end && /^\s+\S/.test(lines[at] ?? "")) {
    at++;
  }
  const number = /^(\d+)\./.exec(lines[lastItem] ?? "")?.[1];
  const items =
    number === undefined ? rules.map((rule) => `- ${rule}`) : numbered(rules, Number(number) + 1);
  return splice(lines, at, 0, items);
}

function docsTable(rows: readonly (readonly string[])[]): string[] {
  return formatTable(["문서", "읽는 시점"], rows).split("\n");
}

function numbered(items: readonly string[], from: number): string[] {
  return items.map((item, index) => `${String(from + index)}. ${item}`);
}

/** `## 핵심 규칙` 목록의 항목 문장. 번호·글머리표는 뗀다. */
function listItems(lines: readonly string[]): string[] {
  const section = findSection(lines, RULES);
  if (section === undefined) {
    return [];
  }
  return lines.slice(section.start + 1, section.end).flatMap((line) => {
    const match = LIST_ITEM.exec(line);
    const text = match?.[2] ?? match?.[3];
    return text === undefined ? [] : [text.trim()];
  });
}

/** 이미 있는 항목과 같은 것, 앞에서 이미 나온 것을 뺀다. */
function missingItems(existing: readonly string[], candidates: readonly string[]): string[] {
  const seen = new Set(existing);
  return candidates.filter((item) => {
    if (seen.has(item.trim())) {
      return false;
    }
    seen.add(item.trim());
    return true;
  });
}

function uniqueByPath(entries: readonly DocMapEntry[]): DocMapEntry[] {
  const seen = new Set<string>();
  return entries.filter((entry) => {
    if (seen.has(entry.path)) {
      return false;
    }
    seen.add(entry.path);
    return true;
  });
}

function later(title: string): string[] {
  return SECTION_ORDER.slice(SECTION_ORDER.indexOf(title) + 1);
}

function isTableLine(line: string): boolean {
  return line.trimStart().startsWith("|");
}

function findIndexIn(
  lines: readonly string[],
  from: number,
  to: number,
  test: (line: string) => boolean,
): number | undefined {
  for (let index = from; index < to; index++) {
    if (test(lines[index] ?? "")) {
      return index;
    }
  }
  return undefined;
}

function findLastIndexIn(
  lines: readonly string[],
  from: number,
  to: number,
  test: (line: string) => boolean,
): number | undefined {
  for (let index = to - 1; index >= from; index--) {
    if (test(lines[index] ?? "")) {
      return index;
    }
  }
  return undefined;
}

function splice(
  lines: readonly string[],
  start: number,
  deleteCount: number,
  items: readonly string[],
): string[] {
  return [...lines.slice(0, start), ...items, ...lines.slice(start + deleteCount)];
}
