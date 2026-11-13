/**
 * `init`으로 설치할 수 있는 지침 파일 묶음.
 *
 * 프리셋 패키지는 이 형태의 객체 하나를 내보낸다. 파일 내용은 `filesDir` 아래에 설치될 경로 그대로 둔다.
 * 프리셋끼리는 서로 의존하지 않는다. 함께 쓰려면 사용자가 여러 프리셋을 고르고,
 * 여러 프리셋이 함께 쓰는 AGENTS.md·CLAUDE.md·훅 실행기는 `installEntryFiles`가 조합에 맞게 만든다.
 */
export interface Preset {
  /** `--preset` 옵션에 쓰는 이름. 예: `java` */
  readonly name: string;
  /** 도움말에 보여 줄 한 줄 설명. */
  readonly description: string;
  /** 설치할 파일들이 있는 디렉터리의 절대 경로. */
  readonly filesDir: string;
  /** 프리셋에 Git 훅이 있으면 그 디렉터리. 설치 대상 기준 상대 경로. `core.hooksPath`로 연결한다. */
  readonly hooksPath?: string;
  /** 문서 지도(AGENTS.md)에 올릴 이 프리셋의 문서. 여러 프리셋을 고르면 순서대로 합친다. */
  readonly docs?: readonly DocMapEntry[];
  /** 문서를 다 읽지 못해도 지켜야 하는 핵심 규칙. AGENTS.md에 번호를 매겨 싣는다. */
  readonly rules?: readonly string[];
  /** 작업을 마치기 전에 실행할 검증 명령. 예: `pnpm lint && pnpm test` */
  readonly verify?: string;
  /** 파일을 설치한 뒤 사람이 직접 해야 하는 일. 설치 결과 끝에 안내한다. */
  readonly nextSteps?: readonly string[];
}

/** 문서 지도의 한 줄. 어떤 문서를 언제 읽는지 알려 준다. */
export interface DocMapEntry {
  /** 저장소 루트 기준 posix 경로. 프리셋 문서는 `docs/<프리셋 이름>/` 아래에 둔다. 예: `docs/git/workflow.md` */
  readonly path: string;
  /** 이 문서를 읽는 시점. */
  readonly when: string;
}
