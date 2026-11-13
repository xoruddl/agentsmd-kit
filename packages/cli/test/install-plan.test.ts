import type { Preset } from "@agentsmd/core";
import { describe, expect, it } from "vitest";
import { planInstall } from "../src/install-plan.js";
import { resolvePresets } from "../src/presets.js";

function preset(name: string, requires?: readonly string[]): Preset {
  return { name, description: "", filesDir: "", ...(requires === undefined ? {} : { requires }) };
}

const available = [preset("lang"), preset("framework", ["lang"]), preset("plugin", ["framework"])];

/** 이름으로 고르고, 설치돼 있다고 볼 프리셋을 정해 계획을 세운다. 결과는 이름으로만 본다. */
function plan(names: readonly string[], installed: readonly string[]) {
  const selection = resolvePresets(names, available);
  if (!selection.ok) {
    throw new Error("모르는 프리셋");
  }
  const result = planInstall(selection.presets, selection.added, ({ name }) =>
    installed.includes(name),
  );
  return {
    all: result.all.map(({ name }) => name),
    installing: result.installing.map(({ name }) => name),
    added: result.added.map(({ name }) => name),
    kept: result.kept.map(({ name }) => name),
  };
}

describe("planInstall", () => {
  it("필요해서 더한 프리셋이 설치돼 있지 않으면 함께 설치한다", () => {
    expect(plan(["framework"], [])).toEqual({
      all: ["lang", "framework"],
      installing: ["lang", "framework"],
      added: ["lang"],
      kept: [],
    });
  });

  // 사용자가 고르지 않은 프리셋이다. 사람이 다듬은 문서와 AGENTS.md를 다시 건드리지 않는다.
  it("필요해서 더한 프리셋이 이미 설치돼 있으면 그대로 두되, 전체 목록에는 남긴다", () => {
    expect(plan(["framework"], ["lang"])).toEqual({
      all: ["lang", "framework"],
      installing: ["framework"],
      added: [],
      kept: ["lang"],
    });
  });

  // 빠진 파일을 채우려고 같은 프리셋을 다시 설치하는 경우다.
  it("직접 고른 프리셋은 이미 설치돼 있어도 설치한다", () => {
    expect(plan(["lang", "framework"], ["lang", "framework"])).toEqual({
      all: ["lang", "framework"],
      installing: ["lang", "framework"],
      added: [],
      kept: [],
    });
  });

  // framework를 그대로 두는데 "lang (framework에 필요)"라고 더하면, 설치하지 않는 프리셋이 이유가 된다.
  it("그대로 두는 프리셋이 필요로 하는 프리셋도 그대로 둔다", () => {
    expect(plan(["plugin"], ["framework"])).toEqual({
      all: ["lang", "framework", "plugin"],
      installing: ["plugin"],
      added: [],
      kept: ["lang", "framework"],
    });
  });

  it("필요한 프리셋만 설치돼 있으면 그것만 그대로 두고 나머지는 더한다", () => {
    expect(plan(["plugin"], ["lang"])).toEqual({
      all: ["lang", "framework", "plugin"],
      installing: ["framework", "plugin"],
      added: ["framework"],
      kept: ["lang"],
    });
  });
});
