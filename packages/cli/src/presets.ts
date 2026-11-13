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

/** 사용자가 고르지 않았지만 다른 프리셋에 필요해서 함께 설치하는 프리셋. */
export interface AddedPreset {
  readonly name: string;
  /** 이 프리셋을 필요로 한 프리셋의 이름. */
  readonly requiredBy: string;
}

export type PresetSelection =
  | {
      readonly ok: true;
      readonly presets: readonly Preset[];
      readonly added: readonly AddedPreset[];
    }
  | { readonly ok: false; readonly unknown: readonly string[] };

/**
 * 쉼표로 구분한 프리셋 이름을 찾고, 그 프리셋에 필요한 프리셋까지 함께 고른다.
 *
 * 같은 이름을 여러 번 적으면 한 번만 고른다. 순서와 필요한 프리셋을 더하는 규칙은 `resolvePresets`가 정한다.
 */
export function selectPresets(value: string): PresetSelection {
  const names = value
    .split(",")
    .map((name) => name.trim())
    .filter((name) => name !== "");
  return resolvePresets(names, PRESETS);
}

/**
 * 이름으로 프리셋을 찾고, 그 프리셋에 필요한 프리셋(`requires`)을 함께 고른다.
 *
 * 문서 지도는 이 순서로 합쳐진다. 적은 순서를 따르되, 필요한 프리셋은 그것을 필요로 하는 프리셋 앞에 둔다.
 * 그래야 언어 프리셋의 필수 문서가 프레임워크 문서보다 위에 온다.
 * 모르는 이름이 하나라도 있으면 아무것도 설치하지 않도록 모두 모아 알린다.
 *
 * 프리셋의 `requires`에 없는 이름이 적혀 있으면 프리셋 정의가 잘못된 것이므로 예외를 던진다.
 * 사용자가 고칠 수 있는 입력 오류가 아니어서 `unknown`으로 돌려주지 않는다.
 *
 * @param chosen 사용자가 고른 이름. 겹친 이름은 한 번만 고른다.
 * @param available 고를 수 있는 프리셋.
 */
export function resolvePresets(
  chosen: readonly string[],
  available: readonly Preset[],
): PresetSelection {
  const names = new Set(chosen);
  const byName = new Map(available.map((preset) => [preset.name, preset]));
  const unknown = [...names].filter((name) => !byName.has(name));
  if (unknown.length > 0) {
    return { ok: false, unknown };
  }

  const presets: Preset[] = [];
  const added: AddedPreset[] = [];
  // 필요 관계가 서로를 가리키게 잘못 적혀 있어도 끝없이 돌지 않도록, 들어선 프리셋을 기억한다.
  const entered = new Set<string>();
  const add = (preset: Preset, requiredBy?: string): void => {
    if (entered.has(preset.name)) {
      return;
    }
    entered.add(preset.name);
    for (const required of preset.requires ?? []) {
      const found = byName.get(required);
      if (found === undefined) {
        throw new Error(`${preset.name} 프리셋이 필요로 하는 ${required} 프리셋이 없습니다`);
      }
      add(found, preset.name);
    }
    presets.push(preset);
    if (requiredBy !== undefined && !names.has(preset.name)) {
      added.push({ name: preset.name, requiredBy });
    }
  };
  // 위에서 모르는 이름을 걸렀으므로 여기서는 모두 찾는다.
  for (const preset of [...names].flatMap((name) => byName.get(name) ?? [])) {
    add(preset);
  }
  return { ok: true, presets, added };
}
