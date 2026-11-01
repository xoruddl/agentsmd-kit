/**
 * 명령이 바깥 세계와 주고받는 통로.
 *
 * 명령이 process를 직접 쓰지 않게 해서, 테스트에서는 출력을 모으고 실행 위치를 바꿔 끼울 수 있게 한다.
 */
export interface Io {
  /** 상대 경로 옵션을 풀 때 기준이 되는 디렉터리. */
  readonly cwd: string;
  /** 결과 출력. 줄바꿈은 호출하는 쪽이 붙인다. */
  readonly stdout: (text: string) => void;
  /** 오류·안내 출력. 줄바꿈은 호출하는 쪽이 붙인다. */
  readonly stderr: (text: string) => void;
}

/** 프로세스 종료 코드. 0: 문제 없음, 1: 규칙 위반, 2: 사용법 오류나 검사를 시작할 수 없음. */
export type ExitCode = 0 | 1 | 2;
