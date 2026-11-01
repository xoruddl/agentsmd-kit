import { formatTable } from "./markdown-table.js";
import type { DocMapEntry, Preset } from "./preset.js";

/** Claude Code가 AGENTS.md를 읽도록 불러오기만 하는 CLAUDE.md. 규칙이 두 곳으로 갈라지지 않게 한다. */
export const CLAUDE_MD = `@AGENTS.md

<!-- 규칙은 이 파일에 쓰지 않는다. AGENTS.md 와 docs/ 에만 작성한다. -->
`;

/**
 * 고른 프리셋들의 문서·규칙·검증 명령을 합쳐 AGENTS.md를 만든다.
 *
 * 프리셋마다 AGENTS.md를 따로 두면 함께 설치할 때 한쪽이 덮이거나 건너뛰어져 지도에서 문서가 빠진다.
 * 그래서 각 프리셋은 자기 문서 목록만 갖고, 지도는 설치할 때 합쳐 만든다.
 * 같은 문서를 여러 프리셋이 올리면 먼저 나온 한 줄만 남긴다.
 */
export function renderAgentsMd(presets: readonly Preset[]): string {
  const docs = uniqueByPath(presets.flatMap((preset) => preset.docs ?? []));
  const rules = presets.flatMap((preset) => preset.rules ?? []);
  const verify = presets.flatMap((preset) => (preset.verify === undefined ? [] : [preset.verify]));

  const sections = [
    "# AGENTS.md\n\n에이전트 작업 지침의 진입점. 작업 전 이 파일을 읽고, 작업 종류에 맞는 문서를 연다.",
  ];
  if (docs.length > 0) {
    const rows = docs.map((doc) => [`[${doc.path}](${doc.path})`, doc.when]);
    sections.push(`## 문서 지도\n\n${formatTable(["문서", "읽는 시점"], rows)}`);
  }
  if (rules.length > 0) {
    const list = rules.map((rule, index) => `${String(index + 1)}. ${rule}`).join("\n");
    sections.push(`## 핵심 규칙\n\n문서를 다 읽지 못했더라도 아래는 반드시 지킨다.\n\n${list}`);
  }
  if (verify.length > 0) {
    sections.push(
      "## 검증\n\n작업을 마치기 전에 실행하고 결과를 그대로 보고한다. 실패를 숨기지 않는다.\n\n" +
        `\`\`\`bash\n${verify.join("\n")}\n\`\`\``,
    );
  }
  sections.push(
    [
      "## 지침 관리",
      "",
      "- 지침 추가·변경 요청은 메모리에 저장하지 않는다. 이 파일이나 `docs/` 에 반영한다.",
      "- 새 문서를 만들면 위 문서 지도에 한 줄 추가한다.",
      "- 문서 수정도 코드와 같은 커밋 규칙을 따른다.",
    ].join("\n"),
  );

  return `${sections.join("\n\n")}\n`;
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
