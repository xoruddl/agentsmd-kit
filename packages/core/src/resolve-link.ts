import { posix } from "node:path";

/**
 * 문서 안의 링크를 저장소 루트 기준 경로로 바꾼다.
 *
 * 링크는 그 링크가 적힌 문서의 위치를 기준으로 풀린다. `/`로 시작하면 GitHub처럼 저장소 루트 기준으로 본다.
 * 저장소 밖을 가리키면(예: `../menu-pick-frontend`) 이 저장소만으로는 확인할 수 없으므로 undefined를 돌려준다.
 *
 * @param fromFile 링크가 적힌 문서. 저장소 루트 기준 상대 경로.
 * @param target 링크에 적힌 경로.
 */
export function resolveLink(fromFile: string, target: string): string | undefined {
  const joined = target.startsWith("/")
    ? target.slice(1)
    : posix.join(posix.dirname(fromFile), target);
  const normalized = posix.normalize(joined).replace(/\/+$/, "");

  if (normalized === ".." || normalized.startsWith("../")) {
    return undefined;
  }
  return normalized === "" ? "." : normalized;
}
