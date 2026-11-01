/** 검사의 출발점인 문서 지도 파일이 없을 때. 규칙 위반이 아니라 검사를 시작할 수 없는 상황이다. */
export class DocMapNotFoundError extends Error {
  override readonly name = "DocMapNotFoundError";

  constructor(readonly path: string) {
    super(`문서 지도를 찾을 수 없습니다: ${path}`);
  }
}
