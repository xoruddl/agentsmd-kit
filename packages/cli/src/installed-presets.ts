import { existsSync } from "node:fs";
import { join } from "node:path";
import type { Preset } from "@agentsmd/core";

/**
 * 프리셋이 이미 설치돼 있는지 본다. 문서 지도에 올리는 문서가 하나라도 저장소에 있으면 설치한 것으로 본다.
 *
 * 다른 프리셋에 필요해서 함께 설치하려던 프리셋을 다시 건드리지 않으려고 쓴다. 사람이 그 프리셋의 문서 일부를 지웠거나
 * AGENTS.md에서 규칙을 고쳤을 수 있으므로, 전부 있는지가 아니라 하나라도 있는지를 본다.
 * 문서가 없는 프리셋은 설치 여부를 알 수 없어 설치하지 않은 것으로 본다.
 */
export function isPresetInstalled(preset: Preset, root: string): boolean {
  return (preset.docs ?? []).some((doc) => existsSync(join(root, doc.path)));
}
