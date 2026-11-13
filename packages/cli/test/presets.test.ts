import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { checkRepository, installEntryFiles, installPreset } from "@agentsmd/core";
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

  // 폴더가 프리셋을 알려 주고, docs/ 바로 아래는 프로젝트 고유 문서의 자리로 남긴다. 기준: docs/architecture.md
  it.each(PRESETS.map((preset) => [preset.name, preset] as const))(
    "%s 프리셋의 문서는 docs/<프리셋 이름>/ 아래에 있다",
    (name, preset) => {
      for (const doc of preset.docs ?? []) {
        expect(doc.path).toMatch(new RegExp(`^docs/${name}/[^/]+\\.md$`));
      }
    },
  );

  // 설치는 이미 있는 파일을 덮어쓰지 않는다. 두 프리셋이 같은 경로를 쓰면 나중 것이 조용히 빠진다.
  // (java와 typescript가 둘 다 docs/lint-and-ci.md를 설치하던 때 실제로 그랬다)
  it("모든 프리셋을 함께 설치해도 경로가 겹쳐 건너뛰는 파일이 없고 check를 통과한다", async () => {
    const root = await mkdtemp(join(tmpdir(), "agentsmd-presets-"));
    try {
      for (const preset of PRESETS) {
        const { skipped } = await installPreset(preset, root);
        expect(skipped, `${preset.name} 프리셋`).toEqual([]);
      }
      await installEntryFiles(PRESETS, root);

      await expect(checkRepository({ root })).resolves.toEqual([]);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
