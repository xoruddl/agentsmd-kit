#!/usr/bin/env node
import { run } from "./run.js";

// 실제 프로세스와 run을 잇는 얇은 진입점. 로직은 테스트할 수 있도록 run에 둔다.
process.exitCode = await run(process.argv.slice(2), {
  cwd: process.cwd(),
  stdout: (text) => process.stdout.write(text),
  stderr: (text) => process.stderr.write(text),
});
