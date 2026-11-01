import type { Finding } from "@agentsmd/core";

/**
 * 검사 결과를 사람이 읽는 텍스트로 만든다.
 *
 * 한 줄에 문제 하나를 `파일:줄  [규칙]  메시지` 형식으로 적는다.
 * 편집기와 터미널이 `파일:줄`을 링크로 인식하므로 바로 그 위치로 이동할 수 있다.
 */
export function formatFindings(findings: readonly Finding[]): string {
  if (findings.length === 0) {
    return "문제 없음\n";
  }
  const lines = findings.map(
    (finding) => `${location(finding)}  [${finding.ruleId}]  ${finding.message}`,
  );
  return `${lines.join("\n")}\n\n문제 ${String(findings.length)}건\n`;
}

function location(finding: Finding): string {
  return finding.line === undefined ? finding.file : `${finding.file}:${String(finding.line)}`;
}
