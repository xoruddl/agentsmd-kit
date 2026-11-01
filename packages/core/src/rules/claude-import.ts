import { posix } from "node:path";
import type { Finding } from "../types.js";

/**
 * CLAUDE.md가 AGENTS.md를 `@` 문법으로 불러오는지 검사한다.
 *
 * Claude Code는 CLAUDE.md를 읽으므로, 지침의 원본을 AGENTS.md 하나로 두려면 CLAUDE.md가 그 파일을 불러와야 한다.
 * 그렇지 않으면 두 파일의 지침이 따로 자라거나, Claude Code만 지침을 읽지 못한다.
 *
 * @param claudeFile CLAUDE.md의 저장소 루트 기준 경로.
 * @param content CLAUDE.md 내용. 파일이 없으면 undefined이고, 이때는 검사할 대상이 없다.
 * @param agentsFile 불러와야 하는 문서 지도의 저장소 루트 기준 경로.
 */
export function findMissingClaudeImport(
  claudeFile: string,
  content: string | undefined,
  agentsFile: string,
): Finding[] {
  if (content === undefined) {
    return [];
  }
  const importPath = posix.relative(posix.dirname(claudeFile), agentsFile);
  if (importsFile(content, importPath)) {
    return [];
  }
  return [
    {
      ruleId: "claude-import",
      file: claudeFile,
      message: `@${importPath} 로 문서 지도를 불러오지 않습니다`,
    },
  ];
}

/** `@AGENTS.md`, `@./AGENTS.md` 모두 인정한다. 코드 블록 안의 예시는 인정하지 않는다. */
function importsFile(content: string, importPath: string): boolean {
  let inFence = false;
  for (const line of content.split(/\r?\n/)) {
    if (/^\s{0,3}(`{3,}|~{3,})/.test(line)) {
      inFence = !inFence;
      continue;
    }
    if (inFence) {
      continue;
    }
    const imports = line.match(/(?:^|\s)@(\S+)/g) ?? [];
    if (imports.some((token) => posix.normalize(token.trim().slice(1)) === importPath)) {
      return true;
    }
  }
  return false;
}
