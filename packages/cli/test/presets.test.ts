import { mkdtemp, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, relative, sep } from "node:path";
import { checkRepository, installEntryFiles, installPreset } from "@agentsmd/core";
import { describe, expect, it } from "vitest";
import { PRESETS } from "../src/presets.js";

/** 프리셋이 설치할 파일을 저장소 루트 기준 posix 경로로 모은다. */
async function presetFiles(filesDir: string): Promise<string[]> {
  const entries = await readdir(filesDir, { recursive: true, withFileTypes: true });
  return entries
    .filter((entry) => entry.isFile())
    .map((entry) => relative(filesDir, join(entry.parentPath, entry.name)).split(sep).join("/"))
    .sort();
}

const byName = PRESETS.map((preset) => [preset.name, preset] as const);

describe("PRESETS", () => {
  // 핵심 규칙은 고른 프리셋들의 규칙을 모두 합친 목록이다. 프리셋마다 조금씩 늘면 함께 설치할 때
  // 목록이 길어져 "문서를 다 읽지 못해도 반드시 지킬 것"이라는 의미가 흐려진다. 기준: docs/architecture.md
  it.each(byName)("%s 프리셋의 핵심 규칙은 5개 이하다", (_name, preset) => {
    expect(preset.rules?.length ?? 0).toBeLessThanOrEqual(5);
  });

  // 폴더가 프리셋을 알려 주고, docs/ 바로 아래는 프로젝트 고유 문서의 자리로 남긴다. 기준: docs/architecture.md
  // 문서 목록(preset.docs)만 보면 목록에 올리지 않은 파일을 놓치므로, 실제로 설치할 파일도 함께 본다.
  it.each(byName)(
    "%s 프리셋이 docs/에 두는 것은 모두 docs/<프리셋 이름>/ 아래에 있다",
    async (name, preset) => {
      const folder = `docs/${name}/`;
      const installed = (await presetFiles(preset.filesDir)).filter((file) =>
        file.startsWith("docs/"),
      );
      const listed = (preset.docs ?? []).map((doc) => doc.path);

      for (const path of [...installed, ...listed]) {
        expect(path.startsWith(folder), `${path}는 ${folder} 아래에 있어야 한다`).toBe(true);
      }
    },
  );

  // 설치는 이미 있는 파일을 덮어쓰지 않는다. 두 프리셋이 같은 경로를 쓰면 나중 것이 조용히 빠진다.
  // (java와 typescript가 둘 다 docs/lint-and-ci.md를 설치하던 때 실제로 그랬다)
  // 내용이 같으면 설치기가 건너뛴 목록에 넣지 않으므로, 설치 결과가 아니라 프리셋이 가진 경로를 직접 비교한다.
  it("두 프리셋이 같은 경로의 파일을 두지 않는다", async () => {
    const owners = new Map<string, string[]>();
    for (const preset of PRESETS) {
      for (const file of await presetFiles(preset.filesDir)) {
        owners.set(file, [...(owners.get(file) ?? []), preset.name]);
      }
    }

    const shared = [...owners].filter(([, names]) => names.length > 1);
    expect(shared).toEqual([]);
  });

  it("모든 프리셋을 함께 설치하면 check를 통과한다", async () => {
    const root = await mkdtemp(join(tmpdir(), "agentsmd-presets-"));
    try {
      for (const preset of PRESETS) {
        await installPreset(preset, root);
      }
      await installEntryFiles(PRESETS, root);

      await expect(checkRepository({ root })).resolves.toEqual([]);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
