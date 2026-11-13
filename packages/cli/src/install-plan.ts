import type { Preset } from "@agentsmd/core";
import type { AddedPreset } from "./presets.js";

/** 고른 프리셋과 그에 필요한 프리셋을 이번 실행에서 어떻게 다룰지 정한 결과. */
export interface InstallPlan {
  /**
   * 고른 프리셋과 그에 필요한 프리셋 전부. 설치 순서다.
   * AGENTS.md를 새로 쓸 때와 훅을 연결할 때는 이번에 설치하지 않는 프리셋까지 필요하므로 이 목록을 쓴다.
   */
  readonly all: readonly Preset[];
  /** 이번에 파일을 설치하는 프리셋. */
  readonly installing: readonly Preset[];
  /** 고르지 않았지만 이번에 함께 설치하는 프리셋. */
  readonly added: readonly AddedPreset[];
  /** 고르지 않았고 이미 설치돼 있어 건드리지 않는 프리셋. */
  readonly kept: readonly AddedPreset[];
}

/**
 * 필요해서 더한 프리셋 가운데 이미 설치된 것은 다시 설치하지 않도록 나눈다.
 *
 * 더한 프리셋은 사용자가 고른 것이 아니다. 이미 있으면 사람이 다듬은 문서를 건너뛴 파일로 알리거나,
 * AGENTS.md에서 지운 규칙을 되살리지 않도록 그대로 둔다. 직접 고른 프리셋은 이미 있어도 설치한다(빠진 파일을 채운다).
 * 그대로 두는 프리셋이 다시 필요로 하는 프리셋도 그대로 둔다. 설치하지 않는 프리셋을 이유로 다른 프리셋을 더하지 않기 위해서다.
 *
 * @param isInstalled 프리셋이 저장소에 이미 설치돼 있는지 알려 주는 함수. 파일 시스템 접근은 호출하는 쪽이 맡는다.
 */
export function planInstall(
  presets: readonly Preset[],
  added: readonly AddedPreset[],
  isInstalled: (preset: Preset) => boolean,
): InstallPlan {
  const byName = new Map(presets.map((preset) => [preset.name, preset]));
  const keptNames = new Set(
    added
      .filter(({ name }) => {
        const preset = byName.get(name);
        return preset !== undefined && isInstalled(preset);
      })
      .map(({ name }) => name),
  );
  // 필요 관계가 여러 단계일 수 있으므로 더 늘지 않을 때까지 따라간다.
  let grew = true;
  while (grew) {
    grew = false;
    for (const { name, requiredBy } of added) {
      if (!keptNames.has(name) && keptNames.has(requiredBy)) {
        keptNames.add(name);
        grew = true;
      }
    }
  }

  return {
    all: presets,
    installing: presets.filter((preset) => !keptNames.has(preset.name)),
    added: added.filter(({ name }) => !keptNames.has(name)),
    kept: added.filter(({ name }) => keptNames.has(name)),
  };
}
