import { resolveLink } from "../resolve-link.js";
import type { DocMap, Finding } from "../types.js";

/**
 * 문서 디렉터리에 있지만 어떤 문서 지도에서도 안내하지 않는 문서를 찾는다.
 *
 * 에이전트는 지도에 없는 문서를 읽을 이유가 없으므로, 새 문서를 만들고 지도를 고치지 않으면
 * 그 문서의 규칙은 없는 것과 같다. 지도가 디렉터리를 가리키면 그 아래 문서는 모두 안내된 것으로 본다.
 *
 * @param maps 문서 지도들. 하나라도 가리키면 안내된 것으로 본다.
 * @param docFiles 검사할 문서 목록. 저장소 루트 기준 상대 경로.
 */
export function findUnlistedDocs(maps: readonly DocMap[], docFiles: readonly string[]): Finding[] {
  const listed = new Set(
    maps.flatMap((map) => map.links.flatMap((link) => resolveLink(map.file, link.target) ?? [])),
  );
  const mapNames = maps.map((map) => map.file).join(", ");

  return docFiles
    .filter((docFile) => !isListed(docFile, listed))
    .map((docFile) => ({
      ruleId: "unlisted-doc",
      file: docFile,
      message: `문서 지도(${mapNames})에서 안내하지 않는 문서입니다`,
    }));
}

/** 파일 자체나 그 파일을 담은 상위 디렉터리 중 하나가 지도에 있으면 안내된 것이다. */
function isListed(docFile: string, listed: ReadonlySet<string>): boolean {
  const parts = docFile.split("/");
  return parts.some((_, index) => listed.has(parts.slice(0, index + 1).join("/")));
}
