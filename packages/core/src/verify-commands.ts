import { findSection } from "./markdown-sections.js";

const FENCE = /^\s{0,3}(`{3,}|~{3,})/;
// verify가 자기 자신을 다시 부르면 무한 반복이므로 이런 줄은 건너뛴다.
const SELF_VERIFY = /\bagentsmd(\/cli)?\s+verify\b/;

/**
 * AGENTS.md의 `## 검증` 절에서 첫 코드 블록의 명령 줄을 순서대로 돌려준다.
 * 빈 줄, `#`로 시작하는 줄, `agentsmd verify`를 부르는 줄은 뺀다. 블록이 없으면 빈 배열이다.
 */
export function verifyCommands(agentsMd: string): string[] {
  const lines = agentsMd.split(/\r?\n/);
  const section = findSection(lines, "검증");
  if (section === undefined) {
    return [];
  }
  const commands: string[] = [];
  let inFence = false;
  for (const line of lines.slice(section.start + 1, section.end)) {
    if (FENCE.test(line)) {
      if (inFence) {
        break;
      }
      inFence = true;
      continue;
    }
    const command = line.trim();
    if (inFence && command !== "" && !command.startsWith("#") && !SELF_VERIFY.test(command)) {
      commands.push(command);
    }
  }
  return commands;
}
