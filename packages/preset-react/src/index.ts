import { fileURLToPath } from "node:url";
import type { Preset } from "@agentsmd/core";

/**
 * React 프론트엔드용 프리셋.
 *
 * 컴포넌트·훅·접근성, 화면 테스트, 브라우저 보안 문서를 담는다.
 * 타입 규칙과 검증 명령, `.nvmrc`는 넣지 않고 TypeScript 프리셋에 맡긴다. `requires`로 적어 두면 `init`이 함께 설치한다.
 * 패키지끼리는 의존하지 않는다. 이 프리셋만 따로 설치해도 문서의 링크가 깨지지 않게 다른 프리셋 문서로 링크하지 않는다.
 * `files/`는 빌드 결과(dist/)와 소스(src/) 어디서 실행해도 패키지 루트 기준으로 같은 위치다.
 */
export const reactPreset = {
  name: "react",
  description: "React 프론트엔드용 컴포넌트·접근성·화면 테스트·브라우저 보안 규칙",
  filesDir: fileURLToPath(new URL("../files", import.meta.url)),
  requires: ["typescript"],
  docs: [
    {
      path: "docs/react/components.md",
      when: "컴포넌트·훅을 만들 때. 폴더, 화면 상태, 접근성, React 린트 규칙",
    },
    { path: "docs/react/testing.md", when: "컴포넌트·훅·화면 테스트를 쓸 때" },
    {
      path: "docs/react/browser-security.md",
      when: "공개 환경변수, 사용자 입력을 화면에 그릴 때, 인증 토큰을 다룰 때",
    },
  ],
  rules: [
    "클릭할 수 있는 요소는 `<button>`·`<a>` 로 만든다. 이미지에는 `alt`, 입력에는 `label`.",
    "서버 데이터를 그리는 화면은 로딩·오류·빈 결과·성공 상태를 모두 그린다.",
  ],
  nextSteps: ["린트 설정에 docs/react/components.md 의 React·jsx-a11y 규칙을 켜세요."],
  // 0.6 이하는 문서를 docs/ 한 층에 설치했다.
  moved: [
    { from: "docs/react-components.md", to: "docs/react/components.md" },
    { from: "docs/react-testing.md", to: "docs/react/testing.md" },
    { from: "docs/browser-security.md", to: "docs/react/browser-security.md" },
  ],
} satisfies Preset;
