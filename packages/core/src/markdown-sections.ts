/** `## 제목` 절의 줄 범위. `start`는 제목 줄, `end`는 다음 제목 줄(없으면 줄 수)이다. */
export interface Section {
  readonly start: number;
  readonly end: number;
}

const FENCE = /^\s{0,3}(`{3,}|~{3,})/;
const HEADING = /^#{1,2}\s/;

/**
 * `## 제목` 절을 찾는다. 절은 다음 `#`·`##` 제목 앞에서 끝난다.
 * 코드 블록 안의 `##` 줄은 제목으로 보지 않는다.
 */
export function findSection(lines: readonly string[], title: string): Section | undefined {
  const start = lines.findIndex((line) => line.trim() === `## ${title}`);
  if (start === -1) {
    return undefined;
  }
  let inFence = false;
  for (let index = start + 1; index < lines.length; index++) {
    const line = lines[index] ?? "";
    if (FENCE.test(line)) {
      inFence = !inFence;
    } else if (!inFence && HEADING.test(line)) {
      return { start, end: index };
    }
  }
  return { start, end: lines.length };
}

/** 절 안에서 마지막으로 내용이 있는 줄. 절이 제목뿐이면 제목 줄이다. */
export function lastContentLine(lines: readonly string[], section: Section): number {
  for (let index = section.end - 1; index > section.start; index--) {
    if ((lines[index] ?? "").trim() !== "") {
      return index;
    }
  }
  return section.start;
}

/**
 * 새 `## 제목` 절을 넣는다.
 *
 * `before`에 적힌 절 가운데 문서에 있는 첫 번째 절 앞에 넣고, 하나도 없으면 문서 끝에 붙인다.
 * 절 사이에는 빈 줄 하나를 둔다.
 */
export function insertSection(
  lines: readonly string[],
  title: string,
  body: readonly string[],
  before: readonly string[],
): string[] {
  const block = [`## ${title}`, "", ...body, ""];
  const next = before
    .map((other) => findSection(lines, other)?.start)
    .filter((start) => start !== undefined)
    .sort((a, b) => a - b)[0];
  if (next !== undefined) {
    return [...lines.slice(0, next), ...block, ...lines.slice(next)];
  }
  const trimmed = trimTrailingBlank(lines);
  return [...trimmed, ...(trimmed.length > 0 ? [""] : []), ...block];
}

function trimTrailingBlank(lines: readonly string[]): string[] {
  let end = lines.length;
  while (end > 0 && (lines[end - 1] ?? "").trim() === "") {
    end--;
  }
  return lines.slice(0, end);
}
