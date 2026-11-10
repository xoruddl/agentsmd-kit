import { describe, expect, it } from "vitest";
import { PRESETS } from "../src/presets.js";

describe("PRESETS", () => {
  // 핵심 규칙은 고른 프리셋들의 규칙을 모두 합친 목록이다. 프리셋마다 조금씩 늘면 함께 설치할 때
  // 목록이 길어져 "문서를 다 읽지 못해도 반드시 지킬 것"이라는 의미가 흐려진다. 기준: docs/architecture.md
  it.each(PRESETS.map((preset) => [preset.name, preset] as const))(
    "%s 프리셋의 핵심 규칙은 5개 이하다",
    (_name, preset) => {
      expect(preset.rules?.length ?? 0).toBeLessThanOrEqual(5);
    },
  );
});
