import { fileURLToPath } from "node:url";
import type { Preset } from "@agentsmd/core";

/**
 * TypeScript 프로젝트용 프리셋. 프론트엔드·백엔드·라이브러리 어디에나 쓰는 공통 규칙만 담는다.
 *
 * 타입 규칙과 필수 컴파일러 옵션, 폴더·모듈, 테스트, 환경변수·보안, 린트·CI 명령 문서를 담는다.
 * React 화면 규칙은 넣지 않는다. 필요하면 React 프리셋을 함께 고른다.
 * Git 훅·GitHub 설정은 넣지 않는다. 필요하면 Git 프리셋을 함께 고른다.
 *
 * tsconfig나 린트 설정 파일은 설치하지 않는다. 빌드 도구마다 설정이 달라 덮어쓰면 프로젝트가 깨지므로,
 * 필수 옵션을 문서로 안내하고 사람이 적용한다.
 */
export const typescriptPreset = {
  name: "typescript",
  description: "TypeScript 프로젝트용 타입·구조·테스트·보안 규칙, 린트·CI 명령",
  filesDir: fileURLToPath(new URL("../files", import.meta.url)),
  docs: [
    {
      path: "docs/typescript/project-direction.md",
      when: "모든 작업 시작 전 (필수). 범위 밖 작업이면 먼저 질문",
    },
    {
      path: "docs/typescript/rules.md",
      when: "코드 작성·리뷰 (항상). 컴파일러 옵션, 타입 규칙",
    },
    {
      path: "docs/typescript/structure.md",
      when: "파일·폴더를 만들 때. 기능 단위 폴더, 모듈 경계",
    },
    { path: "docs/typescript/testing.md", when: "테스트를 쓸 때" },
    { path: "docs/typescript/env-and-security.md", when: "환경변수·외부 입력·의존성을 다룰 때" },
    { path: "docs/typescript/lint-and-ci.md", when: "스크립트·린트·포맷·CI 설정" },
  ],
  rules: [
    "`any`, `as` 단언, `!` 로 타입 오류를 덮지 않는다.",
    "API 응답·저장소 값·URL 파라미터·환경변수는 들어오는 곳에서 검증한다.",
    "Promise 는 `await` 하거나 처리한다. `catch` 로 받은 값은 `unknown` 으로 좁혀 쓴다.",
    "기능은 테스트와 함께 쓴다. 버그 수정은 재현 테스트부터 쓴다.",
    "새 의존성은 사용자에게 묻고 추가한다.",
  ],
  verify: "pnpm lint && pnpm format:check && pnpm typecheck && pnpm test && pnpm build",
  nextSteps: [
    "docs/typescript/project-direction.md 에 프로젝트 목표와 범위를 채우세요.",
    "tsconfig 에 docs/typescript/rules.md 의 필수 컴파일러 옵션을 켜세요.",
    "package.json 에 lint, format, format:check, typecheck, test, build 스크립트를 두세요. → docs/typescript/lint-and-ci.md",
    ".nvmrc 의 Node 버전을 프로젝트에 맞게 고치세요.",
  ],
} satisfies Preset;
