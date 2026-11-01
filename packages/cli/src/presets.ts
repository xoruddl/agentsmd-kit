import type { Preset } from "@agentsmd/core";
import { javaPreset } from "@agentsmd/preset-java";
import { typescriptPreset } from "@agentsmd/preset-typescript";

/**
 * `init --preset`으로 고를 수 있는 프리셋. 새 프리셋 패키지를 만들면 여기에 추가한다.
 *
 * 공통 Git 프리셋은 문서 지도가 없어 단독으로 고르지 않고, 언어 프리셋이 요구해서 함께 설치된다.
 */
export const PRESETS: readonly Preset[] = [javaPreset, typescriptPreset];

export function findPreset(name: string): Preset | undefined {
  return PRESETS.find((preset) => preset.name === name);
}
