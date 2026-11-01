import type { Preset } from "@agentsmd/core";
import { javaPreset } from "@agentsmd/preset-java";

/** `init --preset`으로 고를 수 있는 프리셋. 새 프리셋 패키지를 만들면 여기에 추가한다. */
export const PRESETS: readonly Preset[] = [javaPreset];

export function findPreset(name: string): Preset | undefined {
  return PRESETS.find((preset) => preset.name === name);
}
