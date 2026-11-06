import type { Preset } from "@agentsmd/core";
import { gitPreset } from "@agentsmd/preset-git";
import { githubPreset } from "@agentsmd/preset-github";
import { javaPreset } from "@agentsmd/preset-java";
import { reactPreset } from "@agentsmd/preset-react";
import { springPreset } from "@agentsmd/preset-spring";
import { typescriptPreset } from "@agentsmd/preset-typescript";

/**
 * `init --preset`으로 고를 수 있는 프리셋. 새 프리셋 패키지를 만들면 여기에 추가한다.
 *
 * Git 작업 규칙, 호스팅(GitHub), 언어 규칙, 프레임워크(React·Spring) 규칙은 따로 고른다.
 * 함께 쓰려면 `--preset git,github,typescript,react`처럼 쉼표로 잇는다.
 */
export const PRESETS: readonly Preset[] = [
  gitPreset,
  githubPreset,
  javaPreset,
  springPreset,
  typescriptPreset,
  reactPreset,
];

export type PresetSelection =
  | { readonly ok: true; readonly presets: readonly Preset[] }
  | { readonly ok: false; readonly unknown: readonly string[] };

/**
 * 쉼표로 구분한 프리셋 이름을 적은 순서대로 찾는다.
 *
 * 문서 지도도 이 순서로 합쳐지므로 순서를 바꾸지 않는다. 같은 이름을 여러 번 적으면 한 번만 고른다.
 * 모르는 이름이 하나라도 있으면 아무것도 설치하지 않도록 모두 모아 알린다.
 */
export function selectPresets(value: string): PresetSelection {
  const names = [
    ...new Set(
      value
        .split(",")
        .map((name) => name.trim())
        .filter((name) => name !== ""),
    ),
  ];
  const unknown = names.filter((name) => findPreset(name) === undefined);
  if (unknown.length > 0) {
    return { ok: false, unknown };
  }
  return { ok: true, presets: names.flatMap((name) => findPreset(name) ?? []) };
}

function findPreset(name: string): Preset | undefined {
  return PRESETS.find((preset) => preset.name === name);
}
