import type { DocLink, DocMap } from "./types.js";

// [텍스트](경로) 또는 ![대체 텍스트](경로). 뒤에 "제목"이 올 수 있다.
// 공백이 든 경로는 <...>로 감싸야 하므로 꺾쇠 형식(1번 그룹)과 일반 형식(2번 그룹)을 나눠 받는다.
const INLINE_LINK = /!?\[(?:[^\]\\]|\\.)*\]\(\s*(?:<([^>\n]+)>|([^)\s]+))(?:\s+"[^"]*")?\s*\)/g;
// [이름]: 경로  또는  [이름]: 경로 "제목"  (참조형 링크 정의). 꺾쇠 형식(1번 그룹)과 일반 형식(2번 그룹)을 나눠 받는다.
// `[^1]: 설명`은 각주이고, 경로 뒤에 제목이 아닌 글이 이어지면 문장이므로 둘 다 정의로 보지 않는다.
const REFERENCE_DEFINITION =
  /^\s{0,3}\[(?!\^)[^\]]+\]:\s*(?:<([^>\n]+)>|(\S+))(?:\s+(?:"[^"]*"|'[^']*'|\([^)]*\)))?\s*$/;
// http:, mailto: 처럼 스킴이 붙은 주소는 저장소 안의 파일이 아니다.
const URL_SCHEME = /^[a-z][a-z0-9+.-]*:/i;
const FENCE = /^\s{0,3}(`{3,}|~{3,})/;
const INLINE_CODE = /`+[^`]*`+/g;

/**
 * 문서 지도(AGENTS.md 등)에서 저장소 안의 파일을 가리키는 링크를 모은다.
 *
 * 코드 블록과 인라인 코드 안의 링크는 예시일 수 있으므로 세지 않는다.
 * 경로가 실제로 있는지, 저장소 밖을 가리키는지는 여기서 판단하지 않고 규칙에 맡긴다.
 */
export function parseDocMap(file: string, markdown: string): DocMap {
  const links: DocLink[] = [];
  let openFence: string | undefined;

  markdown.split(/\r?\n/).forEach((rawLine, index) => {
    const fence = FENCE.exec(rawLine)?.[1];
    if (fence !== undefined) {
      openFence = nextFenceState(openFence, fence);
      return;
    }
    if (openFence !== undefined) {
      return;
    }

    const line = index + 1;
    for (const target of extractTargets(rawLine.replace(INLINE_CODE, ""))) {
      const normalized = normalizeTarget(target);
      if (normalized !== undefined) {
        links.push({ target: normalized, line });
      }
    }
  });

  return { file, links };
}

/** 같은 문자로 같은 길이 이상인 펜스가 와야 코드 블록이 닫힌다 (CommonMark 규칙). */
function nextFenceState(openFence: string | undefined, fence: string): string | undefined {
  if (openFence === undefined) {
    return fence;
  }
  const closes = fence.startsWith(openFence.charAt(0)) && fence.length >= openFence.length;
  return closes ? undefined : openFence;
}

function extractTargets(line: string): string[] {
  const definition = REFERENCE_DEFINITION.exec(line);
  if (definition !== null) {
    return [definition[1] ?? definition[2] ?? ""];
  }
  return Array.from(line.matchAll(INLINE_LINK), (match) => match[1] ?? match[2] ?? "");
}

/** 앵커와 쿼리를 떼고, 외부 주소나 같은 문서 안의 앵커면 undefined를 돌려준다. */
function normalizeTarget(target: string): string | undefined {
  if (target === "" || target.startsWith("#") || URL_SCHEME.test(target)) {
    return undefined;
  }
  const path = target.split(/[#?]/, 1)[0] ?? "";
  if (path === "") {
    return undefined;
  }
  return safeDecode(path);
}

/** `%20` 같은 인코딩을 풀되, 잘못된 인코딩이면 적힌 그대로 둔다. */
function safeDecode(path: string): string {
  try {
    return decodeURI(path);
  } catch {
    return path;
  }
}
