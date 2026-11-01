/** AGENTS.md 안에서 찾은 상대 경로 링크 하나. */
export interface DocLink {
  /** 링크에 적힌 경로. `#` 뒤의 앵커는 뺀 값이다. */
  readonly target: string;
  /** 링크가 있는 줄 번호 (1부터 시작). */
  readonly line: number;
}

/** 검사 대상이 되는 문서 지도 파일 하나. */
export interface DocMap {
  /** 저장소 루트 기준 상대 경로. 예: `AGENTS.md` */
  readonly file: string;
  readonly links: readonly DocLink[];
}

/** 규칙 식별자. 출력과 문서에서 이 이름으로 규칙을 가리킨다. */
export type RuleId = "broken-link" | "unlisted-doc" | "claude-import";

/** 규칙 하나가 찾은 문제. */
export interface Finding {
  readonly ruleId: RuleId;
  /** 문제가 있는 파일. 저장소 루트 기준 상대 경로. */
  readonly file: string;
  /** 줄을 특정할 수 있을 때만 있다. */
  readonly line?: number;
  readonly message: string;
}
