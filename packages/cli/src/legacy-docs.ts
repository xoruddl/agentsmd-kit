import type { MovedDoc, Preset } from "@agentsmd/core";

/**
 * 프리셋이 예전에 다른 경로에 설치하던 문서 가운데, 옛 경로에 아직 남아 있는 것을 찾는다.
 *
 * 0.6 이하는 문서를 `docs/` 한 층에 설치했다. 그 저장소에서 `init`을 다시 돌리면 옛 문서는 남고 새 경로에 같은 문서가
 * 또 생기는데, 둘 다 문서 지도에 올라 `check`도 통과한다. 사용자가 알아채고 옮길 수 있게 알려 주기 위해 찾는다.
 * 파일을 옮기거나 지우지는 않는다. 사람이 고쳐 쓴 문서일 수 있다.
 *
 * 같은 옛 경로를 두 프리셋이 적었으면(예: java와 typescript의 `docs/lint-and-ci.md`) 둘 다 돌려준다.
 * 어느 프리셋의 문서였는지는 내용을 봐야 알 수 있어 사람에게 맡긴다.
 *
 * @param exists 저장소 루트 기준 경로가 있는지 알려 주는 함수. 파일 시스템 접근은 호출하는 쪽이 맡는다.
 */
export function findLegacyDocs(
  presets: readonly Preset[],
  exists: (repoPath: string) => boolean,
): MovedDoc[] {
  return presets.flatMap((preset) => (preset.moved ?? []).filter(({ from }) => exists(from)));
}
