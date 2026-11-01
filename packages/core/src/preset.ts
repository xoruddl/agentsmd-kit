/**
 * `init`으로 설치할 수 있는 지침 파일 묶음.
 *
 * 프리셋 패키지는 이 형태의 객체 하나를 내보낸다. 파일 내용은 `filesDir` 아래에 설치될 경로 그대로 둔다.
 */
export interface Preset {
  /** `--preset` 옵션에 쓰는 이름. 예: `java` */
  readonly name: string;
  /** 도움말에 보여 줄 한 줄 설명. */
  readonly description: string;
  /** 설치할 파일들이 있는 디렉터리의 절대 경로. */
  readonly filesDir: string;
}
