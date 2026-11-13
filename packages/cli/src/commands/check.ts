import { resolve } from "node:path";
import { parseArgs } from "node:util";
import { checkRepository, DocMapNotFoundError } from "@agentsmd/core";
import { formatFindings } from "../format.js";
import type { ExitCode, Io } from "../io.js";

export const CHECK_USAGE = `사용법: agentsmd check [옵션]

AGENTS.md 문서 지도가 저장소와 맞는지 검사합니다.

검사 규칙:
  broken-link     지도나 문서 디렉터리 문서의 링크가 없는 파일·디렉터리를 가리킴
  unlisted-doc    문서 디렉터리에 있지만 지도에서 안내하지 않는 문서
  claude-import   CLAUDE.md가 @AGENTS.md로 지도를 불러오지 않음

옵션:
  --root <경로>     검사할 저장소 루트 (기본값: 현재 디렉터리)
  --agents <경로>   문서 지도 파일, 루트 기준 (기본값: AGENTS.md)
  --docs <경로>     문서 디렉터리. 안의 문서는 지도에 모두 있어야 하고 링크도 검사함, 루트 기준 (기본값: docs)
  --claude <경로>   Claude Code 지침 파일, 루트 기준 (기본값: CLAUDE.md)
  -h, --help        이 도움말

종료 코드:
  0  문제 없음
  1  규칙 위반이 있음
  2  옵션이 잘못됐거나 문서 지도가 없음
`;

const pathOptions = ["root", "agents", "docs", "claude"] as const;

/** `agentsmd check` 명령. 문제가 있으면 1을 돌려줘 CI가 실패하게 한다. */
export async function runCheck(args: readonly string[], io: Io): Promise<ExitCode> {
  const { values } = parseArgs({
    args: [...args],
    strict: true,
    allowPositionals: false,
    options: {
      root: { type: "string" },
      agents: { type: "string" },
      docs: { type: "string" },
      claude: { type: "string" },
      help: { type: "boolean", short: "h" },
    },
  });

  if (values.help === true) {
    io.stdout(CHECK_USAGE);
    return 0;
  }

  // CI 변수가 비어 `--agents ""`처럼 오면 빈 경로가 루트 디렉터리로 풀려 예외로 죽고,
  // 공백뿐이면 없는 디렉터리로 풀려 조용히 통과한다. 둘 다 옵션 오류로 알린다.
  const empty = pathOptions.find((option) => values[option]?.trim() === "");
  if (empty !== undefined) {
    io.stderr(`--${empty} 값이 비어 있습니다. 옵션을 빼면 기본값을 씁니다.\n`);
    return 2;
  }

  try {
    const findings = await checkRepository({
      root: resolve(io.cwd, values.root ?? "."),
      ...(values.agents === undefined ? {} : { agentsFile: values.agents }),
      ...(values.docs === undefined ? {} : { docsDir: values.docs }),
      ...(values.claude === undefined ? {} : { claudeFile: values.claude }),
    });
    io.stdout(formatFindings(findings));
    return findings.length === 0 ? 0 : 1;
  } catch (error) {
    if (error instanceof DocMapNotFoundError) {
      io.stderr(`${error.message}\n--root 나 --agents 옵션으로 위치를 지정할 수 있습니다.\n`);
      return 2;
    }
    throw error;
  }
}
