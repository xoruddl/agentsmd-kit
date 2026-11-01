import { resolveLink } from "../resolve-link.js";
import type { DocMap, Finding } from "../types.js";

/**
 * 문서 지도가 가리키는 파일·디렉터리가 실제로 있는지 검사한다.
 *
 * 문서를 옮기거나 지운 뒤 지도를 고치지 않으면, 에이전트는 없는 문서를 찾다가 추측으로 작업하게 된다.
 * 저장소 밖을 가리키는 링크는 확인할 수 없으므로 건너뛴다.
 *
 * @param exists 저장소 루트 기준 경로가 있는지 알려 주는 함수. 파일 시스템 접근은 호출하는 쪽이 맡는다.
 */
export function findBrokenLinks(map: DocMap, exists: (repoPath: string) => boolean): Finding[] {
  return map.links.flatMap((link) => {
    const repoPath = resolveLink(map.file, link.target);
    if (repoPath === undefined || exists(repoPath)) {
      return [];
    }
    return [
      {
        ruleId: "broken-link",
        file: map.file,
        line: link.line,
        message: `링크 대상이 없습니다: ${link.target}`,
      },
    ];
  });
}
