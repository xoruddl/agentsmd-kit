import { describe, expect, it } from "vitest";
import {
  VERIFY_CONFIG,
  mergeVerifySteps,
  parseVerifyConfig,
  renderVerifyConfig,
} from "../src/verify-config.js";

describe("VERIFY_CONFIG", () => {
  it("설정 파일 경로를 가리킨다", () => {
    expect(VERIFY_CONFIG).toBe(".agentsmd/verify.json");
  });
});

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
    ["[]", "steps"],
    ['{"steps":[{"name":"a"}]}', "run"],
    ['{"steps":[{"name":"A b","run":"x"}]}', "name"],
    ['{"steps":[{"name":"a","run":"x"},{"name":"a","run":"y"}]}', "중복"],
    ['{"steps":[{"name":"a","run":"  "}]}', "run"],
    ['{"steps":["a"]}', "1번째"],
  ])("형식이 틀리면 ok:false와 원인을 돌려준다: %s", (json, word) => {
    const result = parseVerifyConfig(json);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain(word);
  });
  it("오류 문구에 몇 번째 단계인지 적는다", () => {
    const result = parseVerifyConfig('{"steps":[{"name":"a","run":"x"},{"name":"b"}]}');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("2번째");
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
  it("번호를 붙인 이름도 겹치면 다음 번호를 쓴다", () => {
    const merged = mergeVerifySteps(
      [
        { name: "java", run: "a" },
        { name: "java-2", run: "b" },
      ],
      [{ name: "java", run: "c" }],
    );
    expect(merged.added).toEqual([{ name: "java-3", run: "c" }]);
  });
  it("기존 단계 뒤에 새 단계를 덧붙이고 added에도 담는다", () => {
    const merged = mergeVerifySteps([{ name: "a", run: "x" }], [{ name: "b", run: "y" }]);
    expect(merged.steps).toEqual([
      { name: "a", run: "x" },
      { name: "b", run: "y" },
    ]);
    expect(merged.added).toEqual([{ name: "b", run: "y" }]);
  });
  it("추가 목록 안의 같은 run도 한 번만 넣는다", () => {
    const merged = mergeVerifySteps(
      [],
      [
        { name: "a", run: "x" },
        { name: "b", run: "x" },
      ],
    );
    expect(merged.added).toEqual([{ name: "a", run: "x" }]);
  });
});

describe("renderVerifyConfig", () => {
  it("들여쓰기 2칸 JSON에 줄바꿈을 붙인다", () => {
    expect(renderVerifyConfig([{ name: "a", run: "x" }])).toBe(
      '{\n  "steps": [\n    {\n      "name": "a",\n      "run": "x"\n    }\n  ]\n}\n',
    );
  });
});
