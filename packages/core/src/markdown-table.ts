/**
 * 마크다운 표를 Prettier와 같은 모양으로 정렬해 만든다.
 *
 * 설치한 문서가 대상 저장소의 `prettier --check`에 걸리지 않게 하려는 것이다.
 * Prettier는 열 너비를 화면에 보이는 폭으로 맞추므로, 한글처럼 두 칸을 차지하는 글자는 2로 센다.
 */
export function formatTable(
  header: readonly string[],
  rows: readonly (readonly string[])[],
): string {
  const widths = header.map((cell, column) =>
    Math.max(3, displayWidth(cell), ...rows.map((row) => displayWidth(row[column] ?? ""))),
  );
  const line = (cells: readonly string[]): string =>
    `| ${widths.map((width, column) => pad(cells[column] ?? "", width)).join(" | ")} |`;

  return [
    line(header),
    line(widths.map((width) => "-".repeat(width))),
    ...rows.map((row) => line(row)),
  ].join("\n");
}

/** 표의 한 줄을 칸으로 나눈다. `\|`로 이스케이프한 세로선은 칸 구분으로 보지 않는다. */
export function parseTableRow(line: string): string[] {
  const inner = line
    .trim()
    .replace(/^\|/, "")
    .replace(/(?<!\\)\|$/, "");
  return inner.split(/(?<!\\)\|/).map((cell) => cell.trim());
}

function pad(text: string, width: number): string {
  return text + " ".repeat(width - displayWidth(text));
}

/** 화면에 보이는 폭. 한글·한자·전각 문자는 2칸, 나머지는 1칸으로 센다. */
export function displayWidth(text: string): number {
  let width = 0;
  for (const char of text) {
    width += isWide(char.codePointAt(0) ?? 0) ? 2 : 1;
  }
  return width;
}

function isWide(code: number): boolean {
  return (
    (code >= 0x1100 && code <= 0x115f) || // 한글 자모
    (code >= 0x2e80 && code <= 0x303e) || // 한중일 부수·기호
    (code >= 0x3041 && code <= 0x33ff) || // 가나·한글 호환 자모
    (code >= 0x3400 && code <= 0x4dbf) || // 한자 확장 A
    (code >= 0x4e00 && code <= 0x9fff) || // 한자
    (code >= 0xac00 && code <= 0xd7a3) || // 한글 음절
    (code >= 0xf900 && code <= 0xfaff) || // 한자 호환
    (code >= 0xff00 && code <= 0xff60) || // 전각 문자
    (code >= 0xffe0 && code <= 0xffe6)
  );
}
