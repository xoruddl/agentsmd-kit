import type { Preset } from "@agentsmd/core";
import { describe, expect, it } from "vitest";
import { findRenamedPresets } from "../src/renamed-presets.js";

function preset(name: string, formerNames?: readonly string[]): Preset {
  return {
    name,
    description: name,
    filesDir: "/unused",
    ...(formerNames === undefined ? {} : { formerNames }),
  };
}

const presets = [preset("lang"), preset("framework-lang", ["framework", "fw"])];

describe("findRenamedPresets", () => {
  it("옛 이름을 지금 이름과 짝짓는다", () => {
    expect(findRenamedPresets(["framework"], presets)).toEqual([
      { from: "framework", to: "framework-lang" },
    ]);
  });

  it("옛 이름이 여러 개면 어느 것이든 찾는다", () => {
    expect(findRenamedPresets(["fw"], presets)).toEqual([{ from: "fw", to: "framework-lang" }]);
  });

  // 오타와 옛 이름을 구분한다. 오타에는 새 이름을 추측해 알리지 않는다.
  it("옛 이름이 아닌 모르는 이름은 돌려주지 않는다", () => {
    expect(findRenamedPresets(["typo", "framework"], presets)).toEqual([
      { from: "framework", to: "framework-lang" },
    ]);
  });

  it("옛 이름이 없으면 빈 목록을 돌려준다", () => {
    expect(findRenamedPresets(["typo"], presets)).toEqual([]);
    expect(findRenamedPresets([], presets)).toEqual([]);
  });
});
