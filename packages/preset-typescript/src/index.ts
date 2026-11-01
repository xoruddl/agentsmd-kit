import { fileURLToPath } from "node:url";
import type { Preset } from "@agentsmd/core";
import { gitPreset } from "@agentsmd/preset-git";

/**
 * TypeScript·React 프론트엔드용 프리셋.
 *
 * 타입 규칙과 필수 컴파일러 옵션, 폴더·컴포넌트·접근성, 테스트, 환경변수·보안 문서와
 * Prettier 커밋 검사, pnpm CI를 담는다. Git 작업 규칙은 공통 Git 프리셋을 요구해서 함께 설치한다.
 *
 * tsconfig나 린트 설정 파일은 설치하지 않는다. 빌드 도구마다 설정이 달라 덮어쓰면 프로젝트가 깨지므로,
 * 필수 옵션을 문서로 안내하고 사람이 적용한다.
 */
export const typescriptPreset = {
  name: "typescript",
  requires: [gitPreset],
  description: "TypeScript·React 프론트엔드용 타입·구조·테스트·보안 규칙, Prettier 훅, pnpm CI",
  filesDir: fileURLToPath(new URL("../files", import.meta.url)),
  nextSteps: [
    "docs/project-direction.md 에 프로젝트 목표와 범위를 채우세요.",
    "tsconfig 에 docs/typescript.md 의 필수 컴파일러 옵션을 켜세요.",
    "package.json 에 lint, format:check, typecheck, test, build 스크립트를 두세요. → docs/lint-and-ci.md",
    ".nvmrc 의 Node 버전을 프로젝트에 맞게 고치세요.",
  ],
} satisfies Preset;
