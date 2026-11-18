# 검증 통합과 Java 패키지 구조 검사 구현 계획

> **에이전트 작업자용:** 이 계획은 작업 단위로 하나씩 실행한다(superpowers:executing-plans 또는 superpowers:subagent-driven-development). 단계는 체크박스(`- [ ]`)로 추적한다.
> 사용자 지침에 따라 **작업 하나가 커밋 하나**다. 작업을 마치면 변경분을 스스로 리뷰하고, 그 작업의 파일만 `git add`한 뒤 멈춘다. `git commit`은 사용자가 요청할 때만 한다.

**목표:** `.agentsmd/verify.json`의 단계를 실행하는 `agentsmd verify`를 만들고, 프리셋 검증 명령을 그 파일로 옮기고, `java`·`spring-java` 프리셋이 패키지 크기·레이어 구조를 검사하는 ArchUnit 테스트 템플릿을 설치하게 한다.

**구조:** `verify.json` 해석·합치기와 AGENTS.md 블록 해석(옮겨 오기용)은 `core`의 순수 함수, 프로세스 실행은 `cli`에서 주입하는 `Runner`, 명령은 `Io`로 출력한다. 구조 검사 자체는 사용자 저장소에 설치되는 ArchUnit 테스트가 한다.

**기술:** TypeScript(Node 22+), vitest, `node:child_process`. 템플릿은 Java + ArchUnit(JUnit 5).

**설계:** [2026-11-17-verify-and-architecture-design.md](2026-11-17-verify-and-architecture-design.md)

## 전역 제약

- `core`의 규칙·해석 함수는 파일 시스템을 모르는 순수 함수다. 파일 읽기는 `cli`나 `checkRepository`에서만 한다.
- 명령은 `process` 대신 `Io`를 쓴다. 외부 의존성은 추가하지 않는다.
- 종료 코드: `0` 통과, `1` 실패(검증 단계 실패), `2` 사용법 오류이거나 시작할 수 없음.
- `packages/preset-*/files/`는 포맷터를 돌리지 않는다. 프리셋 테스트로 `check` 통과를 확인한다.
- 프리셋당 핵심 규칙은 5개 이하다(`presets.test.ts`). `java`는 이미 5개라 규칙을 더하지 않는다.
- 두 프리셋이 같은 경로의 파일을 두지 않는다.
- 패키지당 클래스 상한은 **15**다.
- `archunit.properties`: `freeze.store.default.path=src/test/resources/archunit_store`, `freeze.store.default.allowStoreCreation=false`.
- 작업 하나당 파일 10개 이하. 작업을 마칠 때 `pnpm build && pnpm format:check && pnpm lint && pnpm typecheck && pnpm test`와 `node packages/cli/dist/main.js check`를 돌린다.

## 리뷰 초점

설계는 정하지 않았지만 사용자가 실제로 만날 입력과, 그때 기대하는 동작이다. 각 항목의 테스트는 해당 작업에 넣었다.

1. `verify.json`이 JSON 문법 오류이거나 필드가 틀렸다 → 종료 코드 2와 무엇이 틀렸는지 (작업 2, 4)
2. 단계의 명령이 없는 프로그램이다(셸 종료 코드 127) → 그 단계에서 멈추고 종료 코드 1, 실패 단계 요약 (작업 4)
3. `--only`에 없는 이름이나 빈 값 → 종료 코드 2와 있는 이름 목록 (작업 4)
4. 사람이 `verify.json`의 단계를 고쳐 둔 뒤 `init`을 다시 실행한다 → 고친 단계를 지우거나 바꾸지 않는다 (작업 5)
5. 템플릿이 중첩·익명 클래스와 `package-info`를 세면 실제 파일 수와 달라져 AI가 혼란스러워한다 → 세지 않는다 (작업 6, orbit 사본에서 확인)

---

## 작업 목록 (커밋 단위)

| #   | 작업                                                                                    | 패키지             | 파일 수 |
| --- | --------------------------------------------------------------------------------------- | ------------------ | ------- |
| 1   | (완료) `## 검증` 블록에서 명령 목록 읽기 — 옮겨 오기용                                  | core               | 3       |
| 2   | `verify.json` 해석·합치기                                                               | core               | 3       |
| 3   | 셸 명령 실행기(`Runner`)                                                                | cli                | 2       |
| 4   | `agentsmd verify` 명령(`--only` 포함)과 문서                                            | cli, docs          | 6       |
| 5   | 프리셋 검증 명령을 `verify.json`으로, AGENTS.md는 안내 한 줄, 옮겨 오기, 이 저장소 전환 | core, cli, 루트    | 10 이하 |
| 6   | `java` 프리셋: 패키지 크기 테스트 템플릿과 문서                                         | preset-java, docs  | 6       |
| 7   | `spring-java` 프리셋: 레이어·위치 테스트 템플릿과 문서                                  | preset-spring-java | 7       |

orbit-server 적용(`entity` → `domain`, 템플릿 반영)은 orbit-server 저장소에서 별도 계획으로 한다.

---

### Task 1 (작업 1): `## 검증` 블록에서 명령 목록 읽기

**파일:**

- 만듦: `packages/core/src/verify-commands.ts`
- 고침: `packages/core/src/index.ts` (내보내기 한 줄)
- 테스트: `packages/core/test/verify-commands.test.ts`

**인터페이스:**

- 사용: `findSection(lines, title)` (`markdown-sections.ts`)
- 제공: `export function verifyCommands(agentsMd: string): string[]`. 블록이 없으면 빈 배열이다.

- [ ] **1단계: 실패하는 테스트 작성**

````ts
describe("verifyCommands", () => {
  it("## 검증 절의 첫 코드 블록 줄을 순서대로 돌려준다", () => {
    const md =
      "# A\n\n## 검증\n\n설명\n\n```bash\npnpm build && pnpm test\nnode x.js check\n```\n\n```bash\nnot-this\n```\n";
    expect(verifyCommands(md)).toEqual(["pnpm build && pnpm test", "node x.js check"]);
  });
  it("빈 줄과 #으로 시작하는 줄은 뺀다", () => {
    expect(verifyCommands("## 검증\n\n```\n# 주석\n\n./gradlew build\n```\n")).toEqual([
      "./gradlew build",
    ]);
  });
  it("agentsmd verify를 부르는 줄은 무한 반복을 막으려고 뺀다", () => {
    expect(
      verifyCommands(
        "## 검증\n\n```\nnpx @agentsmd/cli verify\nagentsmd verify --root .\npnpm test\n```\n",
      ),
    ).toEqual(["pnpm test"]);
  });
  it("CRLF 줄바꿈이어도 명령 끝에 \\r이 남지 않는다", () => {
    expect(verifyCommands("## 검증\r\n\r\n```\r\npnpm test\r\n```\r\n")).toEqual(["pnpm test"]);
  });
  it("검증 절이나 코드 블록이 없으면 빈 배열이다", () => {
    expect(verifyCommands("# A\n\n## 문서 지도\n")).toEqual([]);
    expect(verifyCommands("## 검증\n\n명령 없음\n")).toEqual([]);
  });
});
````

- [ ] **2단계: 실패 확인**

실행: `pnpm --filter @agentsmd/core test -- verify-commands`
기대: FAIL (`verifyCommands`가 없음)

- [ ] **3단계: `verifyCommands(agentsMd: string): string[]` 구현**

`findSection`으로 `검증` 절을 찾고, 그 안에서 첫 펜스가 열린 뒤 닫힐 때까지의 줄만 `trim()`해서 모은다.
`agentsmd verify` 판별은 `/\bagentsmd(\/cli)?\s+verify\b/`로 한다. `agents-md.ts`의 `codeBlockLines`는 블록을 모두 모으는 다른 용도라서 건드리지 않는다.

- [ ] **4단계: 통과 확인**

실행: `pnpm --filter @agentsmd/core test -- verify-commands`
기대: PASS

- [ ] **5단계: 전체 검증, 리뷰, 스테이징**

전역 제약의 검증 명령을 돌린다. `git add packages/core/src/verify-commands.ts packages/core/src/index.ts packages/core/test/verify-commands.test.ts`

---

### Task 2 (작업 2): `verify.json` 해석·합치기

**파일:**

- 만듦: `packages/core/src/verify-config.ts`
- 고침: `packages/core/src/index.ts` (내보내기)
- 테스트: `packages/core/test/verify-config.test.ts`

**인터페이스:**

- 제공:
  - `export const VERIFY_CONFIG = ".agentsmd/verify.json"`
  - `export interface VerifyStep { readonly name: string; readonly run: string; }`
  - `export type ParsedVerifyConfig = { readonly ok: true; readonly steps: readonly VerifyStep[] } | { readonly ok: false; readonly error: string }`
  - `export function parseVerifyConfig(json: string): ParsedVerifyConfig`
  - `export function mergeVerifySteps(existing: readonly VerifyStep[], added: readonly VerifyStep[]): { steps: VerifyStep[]; added: VerifyStep[] }` — `run`(trim)이 같은 단계는 넣지 않는다. 이름이 겹치면 `<이름>-2`, `-3`…을 붙인다. 기존 단계는 순서·내용 그대로.
  - `export function renderVerifyConfig(steps: readonly VerifyStep[]): string` — `JSON.stringify({ steps }, null, 2)` + 줄바꿈

- [ ] **1단계: 실패하는 테스트 작성**

```ts
describe("parseVerifyConfig", () => {
  it("단계 목록을 돌려준다", () => {
    expect(parseVerifyConfig('{"steps":[{"name":"build","run":"pnpm build"}]}')).toEqual({
      ok: true,
      steps: [{ name: "build", run: "pnpm build" }],
    });
  });
  it.each([
    ["{", "JSON"],
    ['{"steps":[]}', "steps"],
    ['{"steps":[{"name":"a"}]}', "run"],
    ['{"steps":[{"name":"A b","run":"x"}]}', "name"],
    ['{"steps":[{"name":"a","run":"x"},{"name":"a","run":"y"}]}', "중복"],
    ['{"steps":[{"name":"a","run":"  "}]}', "run"],
  ])("형식이 틀리면 ok:false와 원인을 돌려준다: %s", (json, word) => {
    const result = parseVerifyConfig(json);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain(word);
  });
});
describe("mergeVerifySteps", () => {
  it("같은 run은 넣지 않고 기존 단계는 그대로 둔다", () => {
    const existing = [{ name: "java", run: "./gradlew build --offline" }];
    expect(
      mergeVerifySteps(existing, [{ name: "java", run: "./gradlew build --offline " }]).added,
    ).toEqual([]);
  });
  it("이름이 겹치면 번호를 붙인다", () => {
    expect(
      mergeVerifySteps([{ name: "java", run: "a" }], [{ name: "java", run: "b" }]).steps.map(
        (s) => s.name,
      ),
    ).toEqual(["java", "java-2"]);
  });
});
```

`name` 규칙: `/^[a-z0-9][a-z0-9-]*$/`.

- [ ] **2단계: 실패 확인** — `pnpm --filter @agentsmd/core test -- verify-config`, 기대: FAIL
- [ ] **3단계: 구현** — `JSON.parse`는 `unknown`으로 받아 타입 가드로 좁힌다(`as` 금지). 오류 문구는 한국어로, 몇 번째 단계의 어느 필드인지 적는다.
- [ ] **4단계: 통과 확인** — 위 명령, 기대: PASS
- [ ] **5단계: 전체 검증, 리뷰, 스테이징** — 위 3개 파일만 `git add`

---

### Task 3 (작업 3): 셸 명령 실행기 (`Runner`)

**파일:**

- 만듦: `packages/cli/src/runner.ts`
- 테스트: `packages/cli/test/runner.test.ts`

**인터페이스:**

- 제공:
  - `export interface Runner { readonly run: (command: string, cwd: string) => Promise<number>; }`. 돌려주는 값은 종료 코드다. 시그널로 끝나면 `1`이다.
  - `export const shellRunner: Runner`

- [ ] **1단계: 실패하는 테스트 작성** (실제 셸을 띄운다. 이 파일만 그렇다)

```ts
describe("shellRunner", () => {
  it("명령의 종료 코드를 돌려준다", async () => {
    await expect(shellRunner.run("exit 0", tmpdir())).resolves.toBe(0);
    await expect(shellRunner.run("exit 3", tmpdir())).resolves.toBe(3);
  });
  it("&&로 이은 명령을 셸이 처리한다", async () => {
    await expect(shellRunner.run("true && exit 4", tmpdir())).resolves.toBe(4);
  });
  it("없는 프로그램이면 0이 아닌 코드를 돌려준다", async () => {
    await expect(shellRunner.run("agentsmd-no-such-command-xyz", tmpdir())).resolves.not.toBe(0);
  });
  it("cwd에서 실행한다", async () => {
    const dir = await mkdtemp(join(tmpdir(), "agentsmd-runner-"));
    await expect(shellRunner.run("test -d .", dir)).resolves.toBe(0);
    await expect(shellRunner.run(`test "$(pwd -P)" = "${await realpath(dir)}"`, dir)).resolves.toBe(
      0,
    );
    await rm(dir, { recursive: true, force: true });
  });
});
```

- [ ] **2단계: 실패 확인**

실행: `pnpm --filter @agentsmd/cli test -- runner`
기대: FAIL

- [ ] **3단계: `shellRunner` 구현**

`spawn(command, { shell: true, cwd, stdio: "inherit" })`. `close` 이벤트의 `code`를 돌려주고, `code`가 `null`이면(시그널) `1`을 돌려준다. `error` 이벤트도 `1`로 끝낸다.
출력은 `inherit`라 `Io`를 거치지 않는다. 이 파일만 `process`의 표준 출력을 물려받는 예외이고, 그 이유를 주석에 적는다.

- [ ] **4단계: 통과 확인** — 위 명령, 기대: PASS

- [ ] **5단계: 전체 검증, 리뷰, 스테이징** — `git add packages/cli/src/runner.ts packages/cli/test/runner.test.ts`

---

### Task 4 (작업 4): `agentsmd verify` 명령(`--only` 포함)과 문서

**파일:**

- 만듦: `packages/cli/src/commands/verify.ts`
- 고침: `packages/cli/src/run.ts` (`COMMANDS`, `USAGE`)
- 테스트: `packages/cli/test/commands/verify.test.ts`, `packages/cli/test/run.test.ts` (verify 등록 확인 한 건)
- 문서: `docs/commands.md` (`agentsmd verify` 절, 종료 코드 표의 `1` 설명에 "검증 단계 실패" 추가), `README.md` (사용법에 한 줄)

**인터페이스:**

- 사용: `parseVerifyConfig`·`VERIFY_CONFIG` (작업 2), `Runner`·`shellRunner` (작업 3)
- 제공: `export async function runVerify(args: readonly string[], io: Io, runner: Runner): Promise<ExitCode>`, `export const VERIFY_USAGE: string`
- `run.ts` 등록: `verify: (args, io) => runVerify(args, io, shellRunner)`

**동작(설계에서 정한 값):**

- 옵션: `--root <경로>`(기본 `.`), `--only <이름,이름>`, `-h/--help`. 빈 값은 `check`와 같이 종료 코드 2로 거부한다.
- `<root>/.agentsmd/verify.json`을 읽는다. 없으면 `2`와 `".agentsmd/verify.json 이 없습니다. agentsmd init 으로 만드세요"`. 형식 오류면 `2`와 `parseVerifyConfig`의 오류 문구.
- `--only`는 쉼표로 나눈 이름의 단계만 파일 순서대로 실행한다. 없는 이름이면 `2`와 `"없는 단계: x (있는 단계: build, test)"`.
- 단계마다 실행 전에 `io.stdout("[verify 2/3 test] <명령>\n")`을 찍는다(번호는 실행 대상 기준).
- 실패하면 멈추고 `io.stderr("검증 실패: [verify 2/3 test] <명령> (종료 코드 <n>)\n")`을 찍은 뒤 `1`을 돌려준다.
- 모두 통과하면 `io.stdout("검증 통과 (3단계)\n")`을 찍고 `0`을 돌려준다.
- 루트 디렉터리가 없으면 `2`.

- [ ] **1단계: 실패하는 테스트 작성** (가짜 `Runner`가 받은 명령과 cwd를 기록하고, 정해 둔 종료 코드를 돌려준다)

```ts
const config = (...steps: [string, string][]) =>
  JSON.stringify({ steps: steps.map(([name, run]) => ({ name, run })) });

it("단계를 차례로 실행하고 모두 통과하면 0", async () => {
  await write({ ".agentsmd/verify.json": config(["build", "a"], ["test", "b"]) });
  const runner = fakeRunner({});
  await expect(runVerify([], io(), runner)).resolves.toBe(0);
  expect(runner.calls).toEqual([
    ["a", root],
    ["b", root],
  ]);
  expect(out).toContain("[verify 1/2 build] a");
  expect(out).toContain("검증 통과 (2단계)");
});
it("단계가 실패하면 멈추고 1, 실패 단계를 알린다", async () => {
  await write({ ".agentsmd/verify.json": config(["a", "a"], ["b", "b"], ["c", "c"]) });
  const runner = fakeRunner({ b: 127 });
  await expect(runVerify([], io(), runner)).resolves.toBe(1);
  expect(runner.calls.map(([c]) => c)).toEqual(["a", "b"]);
  expect(err).toContain("검증 실패: [verify 2/3 b] b (종료 코드 127)");
});
it("--only로 고른 단계만 파일 순서대로 실행한다", async () => {
  await write({ ".agentsmd/verify.json": config(["a", "a"], ["b", "b"], ["c", "c"]) });
  const runner = fakeRunner({});
  await expect(runVerify(["--only", "c,a"], io(), runner)).resolves.toBe(0);
  expect(runner.calls.map(([c]) => c)).toEqual(["a", "c"]);
  expect(out).toContain("[verify 2/2 c] c");
});
it("--only에 없는 이름이면 2와 있는 단계 목록", async () => {
  await write({ ".agentsmd/verify.json": config(["a", "a"]) });
  await expect(runVerify(["--only", "x"], io(), fakeRunner({}))).resolves.toBe(2);
  expect(err).toContain("없는 단계: x (있는 단계: a)");
});
it("verify.json이 없으면 2와 init 안내", async () => {
  await expect(runVerify([], io(), fakeRunner({}))).resolves.toBe(2);
  expect(err).toContain("agentsmd init");
});
it("verify.json 형식이 틀리면 2", async () => {
  await write({ ".agentsmd/verify.json": "{" });
  await expect(runVerify([], io(), fakeRunner({}))).resolves.toBe(2);
});
it("--root가 없는 디렉터리면 2", async () => {
  await expect(runVerify(["--root", "nope"], io(), fakeRunner({}))).resolves.toBe(2);
});
it("--root 기준으로 읽고 실행한다", async () => {
  await write({ "sub/.agentsmd/verify.json": config(["a", "a"]) });
  const runner = fakeRunner({});
  await expect(runVerify(["--root", "sub"], io(), runner)).resolves.toBe(0);
  expect(runner.calls).toEqual([["a", join(root, "sub")]]);
});
it("--only 값이 비어 있으면 2", async () => {
  await expect(runVerify(["--only", ""], io(), fakeRunner({}))).resolves.toBe(2);
});
```

`run.test.ts`에는 "`verify --help`가 0을 돌려주고 VERIFY_USAGE를 출력한다"를 더한다.

- [ ] **2단계: 실패 확인** — `pnpm --filter @agentsmd/cli test -- verify`, 기대: FAIL

- [ ] **3단계: `runVerify` 구현, `run.ts`에 등록, `USAGE` 명령 목록에 `verify   .agentsmd/verify.json 의 검증 단계를 차례로 실행합니다` 추가**

- [ ] **4단계: 통과 확인** — 위 명령, 기대: PASS

- [ ] **5단계: 문서**

`docs/commands.md`에 `## agentsmd verify` 절을 추가한다. 내용은 사용 예, 옵션 표, `verify.json` 형식(필드, 이름 규칙), `--only` 예(hook에서 구조 검사만), hook·CI에서 이 명령 하나를 부르면 된다는 안내다. 종료 코드 표의 `1` 설명에 "검증 단계 실패"를 더한다. README 사용법 블록에 `npx @agentsmd/cli verify` 한 줄과 설명을 더한다.

- [ ] **6단계: 전체 검증, 리뷰, 스테이징** — 위 6개 파일만 `git add`

---

### Task 5 (작업 5): 프리셋 검증 명령을 `verify.json`으로, AGENTS.md는 안내 한 줄, 옮겨 오기

**파일:**

- 만듦: `packages/core/src/install-verify-config.ts` (파일 읽기·쓰기: `verify.json` 만들기·합치기·옮겨 오기)
- 고침: `packages/core/src/agents-md.ts` (검증 절을 명령 블록 대신 안내 한 줄로. `MergedAgentsMd.added.verify`와 `unplaced.verify` 제거)
- 고침: `packages/core/src/install-entry-files.ts` (`installVerifyConfig` 호출, 결과에 `verify` 추가), `packages/core/src/index.ts`
- 고침: `packages/cli/src/commands/init.ts` (출력: 넣은 단계, 옮겨 온 단계, "AGENTS.md 검증 블록은 안내 한 줄로 바꿔도 됩니다")
- 테스트: `packages/core/test/install-verify-config.test.ts`, `packages/core/test/agents-md.test.ts`(검증 관련 기대값 수정), `packages/cli/test/commands/init.test.ts`(출력)
- 이 저장소: `.agentsmd/verify.json`(새로, 지금 AGENTS.md 검증 블록의 두 명령), `AGENTS.md`(검증 절을 안내 한 줄로)

10개를 넘으면 테스트 수정과 이 저장소 전환(마지막 두 파일)을 별도 커밋으로 나눈다.

**인터페이스:**

- 사용: `verifyCommands` (작업 1), `parseVerifyConfig`·`mergeVerifySteps`·`renderVerifyConfig`·`VERIFY_CONFIG` (작업 2)
- 제공: `export async function installVerifyConfig(presets: readonly Preset[], targetDir: string, agentsMd: string | undefined): Promise<VerifyConfigResult>`
  - `interface VerifyConfigResult { readonly written: boolean; readonly added: readonly VerifyStep[]; readonly migrated: readonly VerifyStep[]; readonly invalid?: string }`
- 프리셋 단계: `{ name: preset.name, run: preset.verify }`

**동작:**

- `verify.json`이 없을 때:
  - AGENTS.md에 `## 검증` 코드 블록 명령이 있으면 그 명령으로 `step-1`, `step-2`…를 만든다. 이것이 `migrated`다.
  - 그 뒤에 프리셋 단계를 합친다(같은 `run`은 건너뜀).
  - 단계가 하나도 없으면 파일을 만들지 않는다.
- `verify.json`이 있으면 프리셋 단계만 합친다. 형식이 틀린 파일은 고치지 않고 `invalid`에 이유를 담아 돌려준다(`init`이 알린다).
- `force`여도 기존 `verify.json`의 사람 단계는 지우지 않는다.
- AGENTS.md 새로 만들기(`renderAgentsMd`): `## 검증` 절은 안내 한 줄 `작업을 마치기 전에 \`agentsmd verify\` 를 실행하고 결과를 그대로 보고한다. 단계 목록은 \`.agentsmd/verify.json\`.`
- 기존 AGENTS.md 합치기(`mergeAgentsMd`): `## 검증` 절이 없으면 위 안내 절을 넣고, 있으면 건드리지 않는다.

- [ ] **1단계: 실패하는 테스트 작성** — `install-verify-config.test.ts`

다음을 테스트한다.

- 빈 저장소 + java 프리셋 → `{ steps: [{ name: "java", run: "./gradlew spotlessCheck build" }] }`
- 0.7식 AGENTS.md(검증 블록 `a`, `b`) + java → `step-1:a, step-2:b, java:...`, `migrated` 2개
- 사람이 고친 `verify.json`(`java` 단계의 run을 바꿈) + java 재설치 → 기존 단계 유지, 새 `run`의 단계는 `java-2`로 추가
- 형식이 틀린 `verify.json` → 파일 그대로, `invalid` 있음
- 검증 명령 없는 프리셋만 → 파일을 만들지 않음

`agents-md.test.ts`: 새 AGENTS.md의 검증 절이 안내 한 줄이고 코드 블록이 없음. 검증 절이 있는 기존 AGENTS.md는 그대로.

- [ ] **2단계: 실패 확인** — `pnpm --filter @agentsmd/core test`, 기대: 새 테스트 FAIL
- [ ] **3단계: 구현** — `agents-md.ts`에서 `addVerify`·검증 블록 합치기 경로를 없애고 안내 절 넣기로 바꾼다. `codeBlockLines`가 더 쓰이지 않으면 지운다.
- [ ] **4단계: `init` 출력과 테스트 수정, 통과 확인** — `pnpm --filter @agentsmd/core test && pnpm --filter @agentsmd/cli test`, 기대: PASS. 프리셋 테스트(설치 후 `check` 통과)도 통과해야 한다.
- [ ] **5단계: 이 저장소 전환**
  - `.agentsmd/verify.json`의 단계: `{ name: "ci", run: "pnpm build && pnpm format:check && pnpm lint && pnpm typecheck && pnpm test" }`, `{ name: "check", run: "node packages/cli/dist/main.js check" }`
  - AGENTS.md 검증 절은 안내 한 줄로 바꾸고, 명령 목록 자리에 `.agentsmd/verify.json`과 "CI도 같은 순서로 검사한다"를 남긴다.
  - 실행: `pnpm build && node packages/cli/dist/main.js verify`, 기대: `검증 통과 (2단계)`. `node packages/cli/dist/main.js check`도 통과.
- [ ] **6단계: 전체 검증, 리뷰, 스테이징** — 이 작업의 파일만 `git add`

---

### Task 6 (작업 6): `java` 프리셋 — 패키지 크기 테스트 템플릿과 문서

**파일:**

- 만듦: `packages/preset-java/files/src/test/java/PackageSizeTest.java`
- 만듦: `packages/preset-java/files/docs/java/package-structure.md`
- 고침: `packages/preset-java/src/index.ts` (`docs`에 문서 추가, `nextSteps`에 의존성 안내 추가. `rules`는 5개라 더하지 않는다)
- 테스트: `packages/preset-java/test/preset.test.ts`
- 문서: `docs/architecture.md` ("언어 프리셋 추가하기" 1번의 "언어 규칙 문서만 둔다"를 "언어 규칙 문서와, 그 문서의 규칙을 검사하는 테스트 템플릿(`src/test/...`)을 둔다"로 고치고, 템플릿은 이 저장소에서 컴파일되지 않으니 실제 프로젝트에서 확인한다고 적는다), `packages/preset-java/README.md` (설치 파일 목록)

**템플릿이 지켜야 할 것 (설계에서 정한 값):**

- 기본 패키지의 JUnit 5 테스트 클래스 `PackageSizeTest`. 패키지를 주지 않고 import 옵션 `DoNotIncludeTests`, `DoNotIncludeArchives`로 프로젝트의 main 클래스만 읽는다.
- 상수 `MAX_CLASSES_PER_PACKAGE = 15`, `Map<String, Integer> KNOWN_LARGE_PACKAGES`(키는 패키지 전체 이름, 기본은 빈 맵).
- 최상위 클래스만 센다. 중첩·익명·합성 클래스와 `package-info`는 세지 않는다.
- 실패 조건은 두 가지다.
  - 목록에 없는 패키지가 15를 넘을 때, 그리고 목록에 있는 패키지가 적힌 수를 넘을 때
  - 목록에 있는 패키지가 15 이하로 줄었거나 더는 없을 때. 메시지는 `KNOWN_LARGE_PACKAGES 에서 지우세요`
- 역할 분류 순서(먼저 맞는 하나)는 다음과 같다. 어노테이션은 단순 이름이 정확히 같은지로 비교한다.
  1. config: `@Configuration`, `@ConfigurationProperties`
  2. controller: `@RestController`, `@Controller`
  3. service: `@Service`, `@Component`
  4. repository: `@Repository`이거나 `org.springframework.data.repository.Repository`를 상속
  5. entity: `@Entity`, `@Embeddable`
  6. record: `record`
  7. 기타
- 크기 초과 메시지 형식:

```text
패키지 com.x.monitoring.service 의 클래스가 29개로 상한 28개를 넘었습니다 (기본 상한 15).
역할 분포: config 3, service 7, record 13, 기타 6
나누는 순서: 1) 역할이 섞여 있으면 역할 단위 하위 패키지로 2) 한 역할 안에서도 크면 기능 단위 하위 패키지로 3) 컨텍스트 경계가 의심되면 사람에게 묻는다
→ docs/java/package-structure.md
```

**`docs/java/package-structure.md`에 쓸 것:**

- 패키지가 커질 때 나누는 순서(위 메시지와 같은 내용), gdsc식 역할 하위 패키지 예(`domain/event/`, `application/listener/`)
- 재구성 작업 방식: 기능 변경과 섞지 않는 이동 전용 커밋, 구조 문서를 같은 커밋에서 수정, `agentsmd verify` 통과 후 원래 작업 재개
- `KNOWN_LARGE_PACKAGES` 규칙: 도입 시점에만 채운다. 상한을 올리지 않는다. 줄면 지운다.
- ArchUnit 의존성 스니펫: Kotlin DSL과 Groovy DSL. 버전은 구현 시점의 최신 안정판(orbit은 1.5.1)
- 검사 한계: 바이트코드 기준이라 컴파일된 main 클래스만 센다.

- [ ] **1단계: 루트 패키지 없이 동작하는지 먼저 확인 (스파이크)**

orbit-server를 읽기 전용으로 두고 사본에서 확인한다.

```bash
rsync -a --exclude build --exclude .gradle ~/develop/orbit/orbit-server/ /tmp/orbit-verify/
cp packages/preset-java/files/src/test/java/PackageSizeTest.java /tmp/orbit-verify/src/test/java/
cd /tmp/orbit-verify && ./gradlew test --tests PackageSizeTest
```

기대: 실패하고, 메시지에 `com.orbit.server.domain.monitoring.service`(28), `com.orbit.server.domain.update.service`(17)만 나온다. 다른 패키지나 테스트·라이브러리 클래스가 나오면 import 범위가 틀린 것이다.
루트 없이 범위를 잡을 수 없으면 `ROOT_PACKAGE` 상수를 두고 `nextSteps`로 채우게 하는 방식으로 바꾸고, 사용자에게 알린다.

- [ ] **2단계: 사본에서 목록·역할 확인**

`KNOWN_LARGE_PACKAGES`에 위 두 패키지를 적고 다시 실행 → PASS. 다음 셋을 차례로 확인한다.

- `monitoring/service`에 빈 클래스 하나 추가 → FAIL, 메시지의 역할 분포 합이 29
- `edge/service`에 하나 추가 → FAIL
- 목록의 `update.service` 수를 100으로 바꾸면 PASS이고, 목록에 없는 패키지 이름을 넣으면 FAIL(지우라는 메시지)

- [ ] **3단계: 프리셋 테스트 작성(실패 확인)**

```ts
it("패키지 크기 테스트 템플릿을 설치한다", async () => {
  const source = await readFile(join(target, "src/test/java/PackageSizeTest.java"), "utf8");
  expect(source).toContain("MAX_CLASSES_PER_PACKAGE = 15");
  expect(source).toContain("docs/java/package-structure.md");
});
it("패키지 구조 문서를 문서 지도에 올린다", () => {
  expect(javaPreset.docs.map((doc) => doc.path)).toContain("docs/java/package-structure.md");
});
```

실행: `pnpm --filter @agentsmd/preset-java test`, 기대: FAIL

- [ ] **4단계: 문서·`index.ts`·README 작성 후 통과 확인**

`docs` 항목: `{ path: "docs/java/package-structure.md", when: "클래스를 추가할 때, 패키지가 커져 PackageSizeTest 가 실패할 때" }`.
`nextSteps`에 "ArchUnit 테스트 의존성을 추가하세요 → docs/java/package-structure.md"를 더한다.
기대: 기존 "check 통과" 테스트를 포함해 PASS

- [ ] **5단계: 전체 검증, 리뷰, 스테이징** — 위 6개 파일만 `git add`

---

### Task 7 (작업 7): `spring-java` 프리셋 — 레이어·위치 테스트 템플릿과 문서

**파일:**

- 만듦: `packages/preset-spring-java/files/src/test/java/LayerArchitectureTest.java`
- 만듦: `packages/preset-spring-java/files/src/test/resources/archunit.properties`
- 고침: `packages/preset-spring-java/src/index.ts` (`rules`에 한 줄, `nextSteps`에 두 줄)
- 고침: `packages/preset-spring-java/files/docs/spring-java/architecture.md`, `.../testing.md` ("검사할 수 있다" → 설치된 테스트가 검사)
- 테스트: `packages/preset-spring-java/test/preset.test.ts`
- 문서: `packages/preset-spring-java/README.md`

**템플릿이 지켜야 할 것 (설계에서 정한 값):**

- 상수 `FEATURES_PACKAGE = "com.example.app"`, `GLOBAL_PACKAGE = "com.example.app.global"`. 설치 후 채우도록 `nextSteps`로 안내한다(orbit은 `com.orbit.server.domain`, `com.orbit.server.global`).
- 레이어는 `FEATURES_PACKAGE.<기능>.<레이어>[.하위...]`에서 `<레이어>` 자리 이름으로 판단한다. 그래서 `domain.vehicle.domain`도, `service.stream` 같은 하위 패키지도 맞게 잡힌다.
- 규칙(모두 `FreezingArchRule.freeze`로 감싼다):
  1. `domain` 레이어는 `controller`·`service`·`repository` 레이어와 `org.springframework..`에 의존하지 않는다.
  2. `controller` 레이어는 `repository` 레이어에 의존하지 않는다.
  3. `GLOBAL_PACKAGE..`는 기능 패키지에 의존하지 않는다. 단 `GLOBAL_PACKAGE.external..`은 기능의 `service`·`domain`·`exception` 레이어를 쓸 수 있다.
  4. 한 기능의 클래스는 다른 기능의 `repository`·`domain` 레이어에 의존하지 않는다.
  5. 위치: `@RestController`·`@Controller` → `controller`, `@Entity`·`@Embeddable` → `domain`, `org.springframework.data.repository.Repository`를 상속한 인터페이스 → `repository`. 어노테이션은 타입 이름으로 정확히 비교한다(`@RestControllerAdvice` 제외).
- `archunit.properties` 내용(orbit과 같은 주석 포함):

```properties
# FreezingArchRule 이 기존 위반을 기록하는 위치. 커밋해서 팀이 같은 기준으로 검사한다
freeze.store.default.path=src/test/resources/archunit_store
# 기록 파일이 없을 때 새로 만들면 모든 위반이 조용히 통과하므로 막는다. 처음 도입할 때만 잠시 true 로 둔다
freeze.store.default.allowStoreCreation=false
```

- `rules`에 더할 한 줄(spring-java는 지금 4개): `"ArchUnit 기준선(archunit_store)과 PackageSizeTest 의 큰 패키지 상한을 고치지 않는다. 넘으면 패키지를 나눈다."`
- `nextSteps`: `LayerArchitectureTest` 의 FEATURES_PACKAGE·GLOBAL_PACKAGE 를 프로젝트 패키지로 바꾸세요.`, `처음 한 번만 archunit.properties 의 allowStoreCreation 을 true 로 두고 테스트를 돌려 기준선을 만든 뒤 false 로 되돌리세요.`

- [ ] **1단계: orbit 사본에서 템플릿 확인**

작업 6의 `/tmp/orbit-verify`에 템플릿을 복사한다. 상수는 `com.orbit.server.domain`/`com.orbit.server.global`로 바꾸고, 사본은 아직 `entity`를 쓰므로 템플릿의 `domain` 레이어 이름을 임시로 `entity`로 바꾼다.
그다음 `allowStoreCreation=true`(사본만)로 `./gradlew test --tests LayerArchitectureTest`를 실행한다.
기대: 규칙 3·4는 orbit 기존 테스트와 같은 결과다. 기준선에 들어간 위반은 하나씩 확인해서, 템플릿 규칙의 오탐이면 고치고 실제 위반이면 목록으로 남겨 사용자에게 보고한다.
이어서 `@RestControllerAdvice` 클래스(`GlobalExceptionHandler`)가 위치 규칙에 걸리지 않는지 확인한다.

- [ ] **2단계: 프리셋 테스트 작성(실패 확인)**

```ts
it("레이어 테스트 템플릿과 archunit.properties를 설치한다", async () => {
  const props = await readFile(join(repo, "src/test/resources/archunit.properties"), "utf8");
  expect(props).toContain("freeze.store.default.allowStoreCreation=false");
  expect(props).toContain("freeze.store.default.path=src/test/resources/archunit_store");
  await expect(
    access(join(repo, "src/test/java/LayerArchitectureTest.java")),
  ).resolves.toBeUndefined();
});
it("핵심 규칙에 기준선을 고치지 않는다는 규칙이 있다", () => {
  expect(springJavaPreset.rules.some((rule) => rule.includes("archunit_store"))).toBe(true);
});
```

실행: `pnpm --filter @agentsmd/preset-spring-java test`, 기대: FAIL

- [ ] **3단계: 템플릿·properties·`index.ts`·문서·README 작성 후 통과 확인**

`architecture.md`의 "의존 방향은 ArchUnit 테스트로 검사할 수 있다" 줄을 이렇게 바꾼다. "의존 방향과 클래스 위치는 설치된 `src/test/java/LayerArchitectureTest.java` 가 검사한다. 패키지 크기는 Java 프리셋의 `PackageSizeTest` 가 검사한다."
`testing.md`의 같은 줄도 맞춘다. 다른 프리셋 문서로는 링크하지 않는다(파일 경로만 적는다).
`architecture.md`의 의존 방향 절 끝에 "기능 간 경계와 순환은 Spring Modulith(`ApplicationModules.verify()`)로도 검사할 수 있다. 다만 기준선 기능이 없으니 기존 순환을 정리한 뒤 도입한다"는 안내 한 줄을 더한다.
실행: `pnpm --filter @agentsmd/preset-spring-java test && pnpm --filter @agentsmd/cli test -- presets`
기대: PASS. 같은 경로 금지 테스트와 규칙 5개 이하 테스트도 통과해야 한다.

- [ ] **4단계: 전체 검증, 리뷰, 스테이징** — 위 7개 파일만 `git add`
