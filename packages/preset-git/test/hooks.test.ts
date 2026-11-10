import { execFile } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { installEntryFiles, installPreset } from "@agentsmd/core";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { gitPreset } from "../src/index.js";

const exec = promisify(execFile);
let repo: string;

/** 훅을 실행하고 종료 코드와 오류 출력을 돌려준다. 실패해도 예외를 던지지 않는다. */
async function runHook(
  hook: string,
  args: readonly string[] = [],
  env: Record<string, string> = {},
): Promise<{ code: number; stderr: string }> {
  try {
    const { stderr } = await exec(join(repo, ".githooks", hook), [...args], {
      cwd: repo,
      env: { ...process.env, ...env },
    });
    return { code: 0, stderr };
  } catch (error) {
    return failureOf(error);
  }
}

/** execFile이 던진 오류에서 종료 코드와 stderr를 꺼낸다. 형태가 다르면 실패로 본다. */
function failureOf(error: unknown): { code: number; stderr: string } {
  if (typeof error !== "object" || error === null) {
    return { code: -1, stderr: String(error) };
  }
  const code = "code" in error && typeof error.code === "number" ? error.code : -1;
  const stderr = "stderr" in error && typeof error.stderr === "string" ? error.stderr : "";
  return { code, stderr };
}

async function commitMsg(message: string) {
  const file = join(repo, "COMMIT_EDITMSG");
  await writeFile(file, message);
  return runHook("commit-msg", [file]);
}

async function stageFiles(count: number): Promise<void> {
  for (let index = 0; index < count; index++) {
    await writeFile(join(repo, `file-${String(index)}.txt`), String(index));
  }
  await exec("git", ["add", "."], { cwd: repo });
}

beforeEach(async () => {
  repo = await mkdtemp(join(tmpdir(), "agentsmd-hooks-"));
  await exec("git", ["init", "-q"], { cwd: repo });
  await installPreset(gitPreset, repo);
  // pre-commit 실행기는 init이 만들어 넣으므로, 실제 설치와 같게 함께 만든다.
  await installEntryFiles([gitPreset], repo);
  // 훅 파일 자체는 스테이징 대상에서 빼서 파일 수 검사에 섞이지 않게 한다.
  await writeFile(
    join(repo, ".git", "info", "exclude"),
    ".githooks/\n.github/\n.claude/\ndocs/\nAGENTS.md\nCLAUDE.md\n",
  );
});

afterEach(async () => {
  await rm(repo, { recursive: true, force: true });
});

describe("commit-msg", () => {
  it("'<타입>: <요약>' 형식은 통과한다", async () => {
    await expect(commitMsg("feat: 주문 취소 사유 필드 추가\n")).resolves.toMatchObject({ code: 0 });
  });

  it("본문과 git 주석 줄이 있어도 제목만 검사한다", async () => {
    const message = "fix: 토큰 만료 시 리다이렉트 수정\n\n결제 페이지에서 반복함.\n# 주석\n";
    await expect(commitMsg(message)).resolves.toMatchObject({ code: 0 });
  });

  it("scope를 쓰면 막는다", async () => {
    const result = await commitMsg("feat(order): 주문 취소 사유 필드 추가\n");
    expect(result.code).toBe(1);
    expect(result.stderr).toContain("'<타입>: <요약>'");
  });

  it("모르는 타입은 막는다", async () => {
    await expect(commitMsg("style: 공백 정리\n")).resolves.toMatchObject({ code: 1 });
  });

  it("한글 제목도 글자 수로 50자를 넘으면 막는다", async () => {
    const result = await commitMsg(`feat: ${"가".repeat(45)}\n`);
    expect(result.code).toBe(1);
    expect(result.stderr).toContain("50자를 넘습니다");
  });

  it("한글 50자 이내는 바이트 수가 많아도 통과한다", async () => {
    await expect(commitMsg(`feat: ${"가".repeat(40)}\n`)).resolves.toMatchObject({ code: 0 });
  });

  it("마침표로 끝나면 막는다", async () => {
    await expect(commitMsg("fix: 로그인 오류 수정.\n")).resolves.toMatchObject({ code: 1 });
  });

  it("AI 서명이 있으면 막는다", async () => {
    const result = await commitMsg(
      "feat: 기능 추가\n\nCo-Authored-By: Claude <noreply@anthropic.com>\n",
    );
    expect(result.code).toBe(1);
    expect(result.stderr).toContain("AI 서명");
  });

  it("git이 만든 Merge 커밋 메시지는 검사하지 않는다", async () => {
    await expect(commitMsg("Merge branch 'main' into feat/12-order\n")).resolves.toMatchObject({
      code: 0,
    });
  });
});

describe("pre-commit", () => {
  it("스테이징 파일이 기본 한도 5개 이하면 통과한다", async () => {
    await stageFiles(5);
    await expect(runHook("pre-commit")).resolves.toMatchObject({ code: 0 });
  });

  it("기본 한도 5개를 넘으면 막고 파일 목록을 보여 준다", async () => {
    await stageFiles(6);
    const result = await runHook("pre-commit");
    expect(result.code).toBe(1);
    expect(result.stderr).toContain("스테이징된 파일 6개 (한도 5개)");
  });

  it("HARNESS_MAX_FILES로 한도를 바꿀 수 있다", async () => {
    await stageFiles(6);
    await expect(runHook("pre-commit", [], { HARNESS_MAX_FILES: "6" })).resolves.toMatchObject({
      code: 0,
    });
  });
});

describe("check-pr", () => {
  const valid = { BRANCH: "feat/12-order-cancel", TITLE: "[Feat] 주문 취소" };

  it("브랜치·제목이 규칙에 맞으면 통과한다", async () => {
    await expect(runHook("check-pr", [], valid)).resolves.toMatchObject({ code: 0 });
  });

  it("브랜치 이름 형식이 틀리면 막는다", async () => {
    const result = await runHook("check-pr", [], { ...valid, BRANCH: "order-cancel" });
    expect(result.code).toBe(1);
    expect(result.stderr).toContain("브랜치 이름");
  });

  // 커밋은 `feat: 요약`, PR 제목은 목록에서 종류가 눈에 띄게 `[Feat] 요약`을 쓴다.
  it.each([
    "주문 취소",
    "feat: 주문 취소",
    "[feat] 주문 취소",
    "[Feat]주문 취소",
    "[Feature] 주문 취소",
  ])("제목 '%s'는 '[타입] 요약' 형식이 아니어서 막는다", async (title) => {
    const result = await runHook("check-pr", [], { ...valid, TITLE: title });
    expect(result.code).toBe(1);
    expect(result.stderr).toContain("'[타입] 요약'");
  });

  it.each(["[Fix] 토큰 만료 수정", "[CI] 워크플로 추가", "[Build] Gradle 설정 변경"])(
    "제목 '%s'는 통과한다",
    async (title) => {
      await expect(runHook("check-pr", [], { ...valid, TITLE: title })).resolves.toMatchObject({
        code: 0,
      });
    },
  );

  // 이슈 번호는 브랜치 이름으로 이미 강제한다. 이슈를 여러 PR로 나누면 Closes를 못 쓰는 PR이 생기므로 본문은 검사하지 않는다.
  it("본문에 이슈 연결이 없어도 통과한다", async () => {
    const result = await runHook("check-pr", [], { ...valid, BODY: "주문 취소 기능" });
    expect(result.code).toBe(0);
    expect(result.stderr).toBe("");
  });

  it("BRANCH나 TITLE이 없으면 2를 돌려준다", async () => {
    await expect(runHook("check-pr", [], { BRANCH: valid.BRANCH })).resolves.toMatchObject({
      code: 2,
    });
  });
});
