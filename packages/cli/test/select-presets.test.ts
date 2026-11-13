import type { Preset } from "@agentsmd/core";
import { describe, expect, it } from "vitest";
import { PRESETS, resolvePresets, selectPresets } from "../src/presets.js";

function preset(name: string, requires?: readonly string[]): Preset {
  return { name, description: "", filesDir: "", ...(requires === undefined ? {} : { requires }) };
}

const available = [
  preset("base"),
  preset("lang"),
  preset("framework", ["lang"]),
  preset("hosting", ["base"]),
  preset("plugin", ["framework"]),
];

/** 고른 결과를 이름으로만 본다. */
function select(value: string): { names: string[]; added: unknown } | { unknown: unknown } {
  const selection = resolvePresets(value === "" ? [] : value.split(","), available);
  return selection.ok
    ? { names: selection.presets.map(({ name }) => name), added: selection.added }
    : { unknown: selection.unknown };
}

describe("selectPresets", () => {
  it("쉼표로 나눈 이름을 적은 순서대로 고르고, 공백과 빈 항목, 겹친 이름은 버린다", () => {
    const selection = selectPresets(" java , git,java,, ");
    expect(selection.ok && selection.presets.map(({ name }) => name)).toEqual(["java", "git"]);
  });

  it("모르는 이름은 모아서 알린다", () => {
    expect(selectPresets("git,kotlin")).toEqual({ ok: false, unknown: ["kotlin"] });
  });
});

describe("resolvePresets", () => {
  it("적은 순서대로 고르고, 겹친 이름은 한 번만 고른다", () => {
    expect(select("lang,base,lang")).toEqual({ names: ["lang", "base"], added: [] });
    expect(select("kotlin,kotlin")).toEqual({ unknown: ["kotlin"] });
  });

  // 프리셋 정의의 실수다. 사용자가 고를 수 있는 이름이 아니므로 모르는 프리셋으로 알리지 않고 바로 드러낸다.
  it("프리셋이 없는 프리셋을 필요로 하면 예외를 던진다", () => {
    expect(() => resolvePresets(["broken"], [preset("broken", ["missing"])])).toThrow(
      "broken 프리셋이 필요로 하는 missing 프리셋이 없습니다",
    );
  });

  // spring만 고르면 검증 명령이 없고, github만 고르면 PR 템플릿이 없는 문서를 가리킨다.
  it("필요한 프리셋을 고르지 않았으면 그 프리셋 앞에 더하고 무엇 때문에 더했는지 알린다", () => {
    expect(select("framework")).toEqual({
      names: ["lang", "framework"],
      added: [{ name: "lang", requiredBy: "framework" }],
    });
  });

  it("필요한 프리셋이 또 다른 프리셋을 필요로 하면 그것까지 더한다", () => {
    expect(select("base,plugin")).toEqual({
      names: ["base", "lang", "framework", "plugin"],
      added: [
        { name: "lang", requiredBy: "framework" },
        { name: "framework", requiredBy: "plugin" },
      ],
    });
  });

  // 문서 지도는 설치 순서대로 쌓인다. 언어 프리셋의 필수 문서가 프레임워크 문서보다 위에 오게 한다.
  it("필요한 프리셋을 뒤에 적어도 앞으로 옮기고, 직접 고른 것이므로 더했다고 알리지 않는다", () => {
    expect(select("framework,lang")).toEqual({ names: ["lang", "framework"], added: [] });
  });

  it("여러 프리셋이 같은 프리셋을 필요로 해도 한 번만 더하고, 먼저 필요로 한 프리셋을 이유로 알린다", () => {
    const shared = [preset("lang"), preset("one", ["lang"]), preset("two", ["lang"])];
    expect(resolvePresets(["one", "two"], shared)).toMatchObject({
      presets: [{ name: "lang" }, { name: "one" }, { name: "two" }],
      added: [{ name: "lang", requiredBy: "one" }],
    });
  });

  it("모르는 이름이 하나라도 있으면 모두 모아 알린다", () => {
    expect(select("lang,kotlin,go")).toEqual({ unknown: ["kotlin", "go"] });
  });

  it("아무것도 고르지 않으면 고른 것이 없다", () => {
    expect(select("")).toEqual({ names: [], added: [] });
  });

  // 서로를 필요로 하게 잘못 적어도 끝없이 돌지 않는다.
  it("필요 관계가 돌고 돌아도 멈춘다", () => {
    const cyclic = [preset("a", ["b"]), preset("b", ["a"])];
    const selection = resolvePresets(["a"], cyclic);
    expect(selection.ok && selection.presets.map(({ name }) => name)).toEqual(["b", "a"]);
  });
});

describe("PRESETS의 requires", () => {
  // 이름만 적으므로 오타가 나도 타입 검사에 걸리지 않는다.
  it.each(PRESETS.map((item) => [item.name, item] as const))(
    "%s 프리셋이 필요로 하는 프리셋은 모두 목록에 있다",
    (_name, item) => {
      const names = PRESETS.map(({ name }) => name);
      for (const required of item.requires ?? []) {
        expect(names).toContain(required);
      }
    },
  );
});
