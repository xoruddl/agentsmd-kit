import { describe, expect, it } from "vitest";
import { verifyCommands } from "../src/verify-commands.js";

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
