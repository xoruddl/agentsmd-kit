import { fileURLToPath } from "node:url";
import type { Preset } from "@agentsmd/core";

/**
 * React 프론트엔드용 프리셋.
 *
 * 컴포넌트·훅·접근성, 화면 테스트, 브라우저 보안 문서를 담는다.
 * 타입 규칙과 검증 명령, `.nvmrc`는 넣지 않는다. TypeScript 프리셋을 함께 고르면 더해진다.
 * 프리셋끼리 의존하지 않으므로, 이 프리셋만 설치해도 문서의 링크가 깨지지 않게 다른 프리셋 문서로 링크하지 않는다.
 * `files/`는 빌드 결과(dist/)와 소스(src/) 어디서 실행해도 패키지 루트 기준으로 같은 위치다.
 */
export const reactPreset = {
  name: "react",
  description: "React 프론트엔드용 컴포넌트·접근성·화면 테스트·브라우저 보안 규칙",
  filesDir: fileURLToPath(new URL("../files", import.meta.url)),
} satisfies Preset;
