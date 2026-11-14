import type { Preset } from "@agentsmd/core";

/** 이름이 바뀐 프리셋 하나. */
export interface RenamedPreset {
  /** 사용자가 적은 옛 이름. */
  readonly from: string;
  /** 지금 이름. */
  readonly to: string;
}

/**
 * 모르는 이름 가운데 프리셋의 옛 이름(`formerNames`)인 것을 찾아 지금 이름과 짝짓는다.
 *
 * 옛 이름으로 설치하지 않고 알리기만 한다. 이름을 바꾼 이유(예: `spring`이 Java 전용임을 드러내려고)를
 * 사용자가 알고 명령을 고쳐 쓰게 하기 위해서다.
 *
 * @param unknown 고를 수 없는 이름. 적은 순서를 지킨다.
 * @param presets 고를 수 있는 프리셋.
 */
export function findRenamedPresets(
  unknown: readonly string[],
  presets: readonly Preset[],
): RenamedPreset[] {
  return unknown.flatMap((from) => {
    const renamed = presets.find((preset) => preset.formerNames?.includes(from) === true);
    return renamed === undefined ? [] : [{ from, to: renamed.name }];
  });
}
