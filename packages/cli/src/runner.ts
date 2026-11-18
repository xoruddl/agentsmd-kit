import { spawn } from "node:child_process";

/** 셸 명령 한 줄을 실행하고 종료 코드를 돌려주는 실행기. 명령이 이를 주입받아 테스트에서 가짜로 바꿀 수 있다. */
export interface Runner {
  /** 시그널로 끝나거나 실행에 실패하면 `1`을 돌려준다. */
  readonly run: (command: string, cwd: string) => Promise<number>;
}

/**
 * 명령은 보통 `process` 대신 `Io`로 출력한다. 이 파일은 그 예외다.
 * 자식 프로세스의 표준 입출력을 `stdio: "inherit"`로 그대로 물려받아야
 * 검증 명령의 출력이 가공 없이 사용자 터미널에 흘러가므로, `Io`를 거치지 않는다.
 */
export const shellRunner: Runner = {
  run: (command, cwd) =>
    new Promise((resolve) => {
      const child = spawn(command, { shell: true, cwd, stdio: "inherit" });
      // 실행 실패(`error`) 뒤에 `close`가 또 올 수 있어도 먼저 온 값만 쓰인다.
      child.on("error", () => {
        resolve(1);
      });
      child.on("close", (code) => {
        resolve(code ?? 1);
      });
    }),
};
