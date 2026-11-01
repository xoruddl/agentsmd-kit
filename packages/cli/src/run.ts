import { runCheck } from "./commands/check.js";
import { runInit } from "./commands/init.js";
import type { ExitCode, Io } from "./io.js";

type Command = (args: readonly string[], io: Io) => Promise<ExitCode>;

const COMMANDS: Readonly<Record<string, Command>> = {
  check: runCheck,
  init: runInit,
};

export const USAGE = `사용법: agentsmd <명령> [옵션]

AI 코딩 에이전트용 작업 지침(AGENTS.md)을 설치하고 검사합니다.

명령:
  init    프리셋으로 지침 파일을 설치하고 Git 훅을 연결합니다
  check   AGENTS.md 문서 지도가 저장소와 맞는지 검사합니다

명령별 옵션: agentsmd <명령> --help
`;

/** 첫 인자로 명령을 고르고 나머지 인자를 넘긴다. 옵션 파싱 오류는 사용법 오류(2)로 바꾼다. */
export async function run(argv: readonly string[], io: Io): Promise<ExitCode> {
  const [name, ...args] = argv;

  if (name === undefined || name === "-h" || name === "--help") {
    io.stdout(USAGE);
    return name === undefined ? 2 : 0;
  }

  const command = COMMANDS[name];
  if (command === undefined) {
    io.stderr(`알 수 없는 명령입니다: ${name}\n\n${USAGE}`);
    return 2;
  }

  try {
    return await command(args, io);
  } catch (error) {
    if (isParseArgsError(error)) {
      io.stderr(`${error.message}\n자세한 옵션: agentsmd ${name} --help\n`);
      return 2;
    }
    throw error;
  }
}

/** node:util parseArgs가 던지는 오류는 ERR_PARSE_ARGS_ 로 시작하는 code를 가진다. */
function isParseArgsError(error: unknown): error is Error {
  return (
    error instanceof Error &&
    "code" in error &&
    typeof error.code === "string" &&
    error.code.startsWith("ERR_PARSE_ARGS_")
  );
}
