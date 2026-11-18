export const VERIFY_CONFIG = ".agentsmd/verify.json";

export interface VerifyStep {
  readonly name: string;
  readonly run: string;
}

export type ParsedVerifyConfig =
  | { readonly ok: true; readonly steps: readonly VerifyStep[] }
  | { readonly ok: false; readonly error: string };

const STEP_NAME = /^[a-z0-9][a-z0-9-]*$/;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function fail(error: string): ParsedVerifyConfig {
  return { ok: false, error };
}

/**
 * `.agentsmd/verify.json` 내용을 읽어 단계 목록으로 돌려준다.
 * 형식이 틀리면 몇 번째 단계의 어느 필드가 문제인지 한국어 오류로 알려 준다.
 */
export function parseVerifyConfig(json: string): ParsedVerifyConfig {
  let data: unknown;
  try {
    data = JSON.parse(json);
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    return fail(`${VERIFY_CONFIG}를 JSON으로 읽을 수 없습니다: ${reason}`);
  }
  if (!isRecord(data) || !Array.isArray(data.steps) || data.steps.length === 0) {
    return fail(`${VERIFY_CONFIG}에는 비어 있지 않은 steps 배열이 있어야 합니다.`);
  }
  const steps: VerifyStep[] = [];
  const names = new Set<string>();
  for (const [index, item] of data.steps.entries()) {
    const label = `steps의 ${String(index + 1)}번째 단계`;
    if (!isRecord(item)) {
      return fail(`${label}가 객체가 아닙니다.`);
    }
    const { name, run } = item;
    if (typeof name !== "string" || !STEP_NAME.test(name)) {
      return fail(
        `${label}의 name은 소문자·숫자·하이픈으로 된 문자열이어야 합니다 (${STEP_NAME.source}).`,
      );
    }
    if (typeof run !== "string" || run.trim() === "") {
      return fail(`${label}(${name})의 run은 비어 있지 않은 문자열이어야 합니다.`);
    }
    if (names.has(name)) {
      return fail(`${label}의 name "${name}"이 중복되었습니다.`);
    }
    names.add(name);
    steps.push({ name, run });
  }
  return { ok: true, steps };
}

/**
 * 기존 단계 뒤에 새 단계를 덧붙인다. `run`(앞뒤 공백 제외)이 이미 있는 단계는 넣지 않고,
 * 이름이 겹치면 `<이름>-2`, `-3`… 을 붙인다. 기존 단계는 순서와 내용을 그대로 둔다.
 */
export function mergeVerifySteps(
  existing: readonly VerifyStep[],
  added: readonly VerifyStep[],
): { steps: VerifyStep[]; added: VerifyStep[] } {
  const steps = [...existing];
  const runs = new Set(existing.map((step) => step.run.trim()));
  const names = new Set(existing.map((step) => step.name));
  const accepted: VerifyStep[] = [];
  for (const step of added) {
    const run = step.run.trim();
    if (runs.has(run)) {
      continue;
    }
    let name = step.name;
    for (let n = 2; names.has(name); n += 1) {
      name = `${step.name}-${String(n)}`;
    }
    const next: VerifyStep = { name, run: step.run };
    runs.add(run);
    names.add(name);
    steps.push(next);
    accepted.push(next);
  }
  return { steps, added: accepted };
}

export function renderVerifyConfig(steps: readonly VerifyStep[]): string {
  return `${JSON.stringify({ steps }, null, 2)}\n`;
}
