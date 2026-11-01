import { describe, expect, it } from "vitest";
import type { Preset } from "../src/preset.js";
import { resolvePresets } from "../src/resolve-presets.js";

function preset(name: string, requires: readonly Preset[] = []): Preset {
  return { name, description: name, filesDir: `/presets/${name}`, requires };
}

const names = (presets: readonly Preset[]) => presets.map((p) => p.name);

describe("resolvePresets", () => {
  it("요구하는 프리셋이 없으면 자기 자신만 돌려준다", () => {
    expect(names(resolvePresets(preset("git")))).toEqual(["git"]);
  });

  it("요구되는 프리셋을 먼저 둔다", () => {
    const git = preset("git");
    expect(names(resolvePresets(preset("java", [git])))).toEqual(["git", "java"]);
  });

  it("여러 경로로 요구된 프리셋은 한 번만 넣는다", () => {
    const git = preset("git");
    const node = preset("node", [git]);
    expect(names(resolvePresets(preset("typescript", [git, node])))).toEqual([
      "git",
      "node",
      "typescript",
    ]);
  });

  it("순환 요구는 경로와 함께 오류로 알린다", () => {
    const a: { -readonly [K in keyof Preset]: Preset[K] } = preset("a");
    const b = preset("b", [a]);
    a.requires = [b];
    expect(() => resolvePresets(a)).toThrow("프리셋 요구 관계가 순환합니다: a → b → a");
  });
});
