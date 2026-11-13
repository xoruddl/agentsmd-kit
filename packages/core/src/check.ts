import { existsSync } from "node:fs";
import { readFile, readdir } from "node:fs/promises";
import { join, posix, sep } from "node:path";
import { DocMapNotFoundError } from "./errors.js";
import { parseDocMap } from "./parse-doc-map.js";
import { findBrokenLinks } from "./rules/broken-link.js";
import { findMissingClaudeImport } from "./rules/claude-import.js";
import { findUnlistedDocs } from "./rules/unlisted-doc.js";
import type { Finding } from "./types.js";

export interface CheckOptions {
  /** 검사할 저장소의 루트 디렉터리. */
  readonly root: string;
  /** 문서 지도 파일. 루트 기준 상대 경로. 기본값 `AGENTS.md` */
  readonly agentsFile?: string;
  /** 지도에 모두 올라 있어야 하는 문서 디렉터리. 루트 기준 상대 경로. 기본값 `docs` */
  readonly docsDir?: string;
  /** Claude Code용 지침 파일. 루트 기준 상대 경로. 기본값 `CLAUDE.md` */
  readonly claudeFile?: string;
}

/**
 * 저장소의 AI 작업 지침을 검사하고, 찾은 문제를 파일·줄 순서로 돌려준다.
 *
 * 규칙들은 파일 시스템을 모르는 순수 함수이고, 파일을 읽는 일은 이 함수가 모두 맡는다.
 *
 * @throws {DocMapNotFoundError} 문서 지도 파일이 없을 때
 */
export async function checkRepository(options: CheckOptions): Promise<Finding[]> {
  const { root, agentsFile = "AGENTS.md", docsDir = "docs", claudeFile = "CLAUDE.md" } = options;

  const agentsContent = await readOptional(join(root, agentsFile));
  if (agentsContent === undefined) {
    throw new DocMapNotFoundError(agentsFile);
  }
  const map = parseDocMap(agentsFile, agentsContent);
  const exists = (repoPath: string) => existsSync(join(root, repoPath));

  const docFiles = await listMarkdownFiles(root, docsDir);
  // 문서끼리 거는 링크도 검사한다. 지도가 문서 디렉터리 안에 있으면 위에서 이미 읽었으므로 뺀다.
  const agentsRepoPath = toRepoPath(root, join(root, agentsFile));
  const docMaps = await Promise.all(
    docFiles
      .filter((docFile) => docFile !== agentsRepoPath)
      .map(async (docFile) => parseDocMap(docFile, await readFile(join(root, docFile), "utf8"))),
  );

  const findings = [
    ...[map, ...docMaps].flatMap((linkSource) => findBrokenLinks(linkSource, exists)),
    // 문서가 안내됐는지는 지도만 보고 판단한다. 다른 문서에서 링크했다고 에이전트가 읽게 되지는 않는다.
    ...findUnlistedDocs([map], docFiles),
    ...findMissingClaudeImport(claudeFile, await readOptional(join(root, claudeFile)), agentsFile),
  ];
  return findings.sort(byLocation);
}

async function readOptional(path: string): Promise<string | undefined> {
  try {
    return await readFile(path, "utf8");
  } catch (error) {
    if (isNotFound(error)) {
      return undefined;
    }
    throw error;
  }
}

/** 문서 디렉터리 아래의 .md 파일을 루트 기준 posix 경로로 모은다. 디렉터리가 없으면 빈 목록이다. */
async function listMarkdownFiles(root: string, docsDir: string): Promise<string[]> {
  try {
    const entries = await readdir(join(root, docsDir), { recursive: true, withFileTypes: true });
    return entries
      .filter((entry) => entry.isFile() && entry.name.endsWith(".md"))
      .map((entry) => toRepoPath(root, join(entry.parentPath, entry.name)))
      .sort();
  } catch (error) {
    if (isNotFound(error)) {
      return [];
    }
    throw error;
  }
}

function toRepoPath(root: string, absolutePath: string): string {
  return posix.normalize(absolutePath.slice(join(root, sep).length).split(sep).join("/"));
}

function isNotFound(error: unknown): boolean {
  return error instanceof Error && "code" in error && error.code === "ENOENT";
}

function byLocation(a: Finding, b: Finding): number {
  return a.file.localeCompare(b.file) || (a.line ?? 0) - (b.line ?? 0);
}
