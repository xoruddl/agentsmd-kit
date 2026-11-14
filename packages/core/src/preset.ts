/**
 * `init`으로 설치할 수 있는 지침 파일 묶음.
 *
 * 프리셋 패키지는 이 형태의 객체 하나를 내보낸다. 파일 내용은 `filesDir` 아래에 설치될 경로 그대로 둔다.
 * 프리셋 패키지끼리는 서로 의존하지 않는다. 함께 쓰려면 사용자가 여러 프리셋을 고르고,
 * 여러 프리셋이 함께 쓰는 AGENTS.md·CLAUDE.md는 `installEntryFiles`가 조합에 맞게 만든다.
 * 다른 프리셋이 있어야 뜻이 통하는 프리셋은 `requires`에 그 이름만 적고, 찾아서 함께 설치하는 일은 `cli`가 맡는다.
 */
export interface Preset {
  /** `--preset` 옵션에 쓰는 이름. 예: `java` */
  readonly name: string;
  /** 도움말에 보여 줄 한 줄 설명. */
  readonly description: string;
  /** 설치할 파일들이 있는 디렉터리의 절대 경로. */
  readonly filesDir: string;
  /**
   * 이 프리셋과 함께 있어야 하는 프리셋의 이름. 예: `spring-java`는 검증 명령을 `java`에 맡기므로 `["java"]`.
   * 사용자가 고르지 않았으면 `init`이 이 프리셋보다 먼저 설치한다. 패키지를 불러오지 않고 이름만 적는다.
   */
  readonly requires?: readonly string[];
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
  /**
   * 이전 버전에서 다른 경로에 설치하던 문서. 옛 경로에 파일이 남아 있으면 `init`이 새 경로를 알려 준다.
   * 설치는 기존 파일을 지우거나 옮기지 않으므로, 경로를 바꾸면 여기에 적어 두지 않는 한 문서가 조용히 두 벌이 된다.
   */
  readonly moved?: readonly MovedDoc[];
}

/** 설치 경로가 바뀐 문서 하나. 둘 다 저장소 루트 기준 posix 경로다. */
export interface MovedDoc {
  /** 이전 버전이 설치하던 경로. 예: `docs/workflow.md` */
  readonly from: string;
  /** 지금 설치하는 경로. 예: `docs/git/workflow.md` */
  readonly to: string;
}

/** 문서 지도의 한 줄. 어떤 문서를 언제 읽는지 알려 준다. */
export interface DocMapEntry {
  /** 저장소 루트 기준 posix 경로. 프리셋 문서는 `docs/<프리셋 이름>/` 아래에 둔다. 예: `docs/git/workflow.md` */
  readonly path: string;
  /** 이 문서를 읽는 시점. */
  readonly when: string;
}
