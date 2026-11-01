import type { Preset } from "./preset.js";

/**
 * 프리셋과 그 프리셋이 요구하는 프리셋을 설치 순서대로 펼친다.
 *
 * 요구되는 프리셋이 먼저 오고, 여러 경로로 요구돼도 한 번만 들어간다 (이름 기준).
 * 순환 요구는 설치 순서를 정할 수 없으므로 오류로 알린다.
 */
export function resolvePresets(preset: Preset): Preset[] {
  const ordered: Preset[] = [];
  const done = new Set<string>();

  const visit = (current: Preset, path: readonly string[]): void => {
    if (path.includes(current.name)) {
      throw new Error(`프리셋 요구 관계가 순환합니다: ${[...path, current.name].join(" → ")}`);
    }
    if (done.has(current.name)) {
      return;
    }
    for (const required of current.requires ?? []) {
      visit(required, [...path, current.name]);
    }
    done.add(current.name);
    ordered.push(current);
  };

  visit(preset, []);
  return ordered;
}
