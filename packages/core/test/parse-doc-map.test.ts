import { describe, expect, it } from "vitest";
import { parseDocMap } from "../src/parse-doc-map.js";

function targets(markdown: string): string[] {
  return parseDocMap("AGENTS.md", markdown).links.map((link) => link.target);
}

describe("parseDocMap", () => {
  it("표 안의 링크를 줄 번호와 함께 모은다", () => {
    const markdown = [
      "# AGENTS.md",
      "",
      "| 문서 | 언제 읽나 |",
      "| --- | --- |",
      "| [README.md](README.md) | 실행 방법 |",
      "| [docs/git-conventions.md](docs/git-conventions.md) | 코드를 바꾸기 전 |",
    ].join("\n");

    expect(parseDocMap("AGENTS.md", markdown)).toEqual({
      file: "AGENTS.md",
      links: [
        { target: "README.md", line: 5 },
        { target: "docs/git-conventions.md", line: 6 },
      ],
    });
  });

  it("한 줄에 있는 여러 링크를 모두 모은다", () => {
    expect(targets("[a](docs/a.md), [b](docs/b.md)")).toEqual(["docs/a.md", "docs/b.md"]);
  });

  it("앵커와 쿼리는 떼고 경로만 남긴다", () => {
    expect(targets("[알림](docs/monitoring-targets.md#알림-규칙) [q](docs/a.md?raw)")).toEqual([
      "docs/monitoring-targets.md",
      "docs/a.md",
    ]);
  });

  it("외부 주소와 같은 문서 안의 앵커는 건너뛴다", () => {
    const markdown =
      "[guide](https://github.com/uber-go/guide) [mail](mailto:a@b.c) [위로](#문서-지도)";
    expect(targets(markdown)).toEqual([]);
  });

  it("코드 블록 안의 링크는 예시로 보고 세지 않는다", () => {
    const markdown = [
      "```md",
      "[예시](docs/example.md)",
      "```",
      "~~~",
      "[예시](docs/tilde.md)",
      "~~~",
      "[실제](docs/real.md)",
    ].join("\n");
    expect(targets(markdown)).toEqual(["docs/real.md"]);
  });

  it("더 짧은 펜스나 다른 문자의 펜스로는 코드 블록이 닫히지 않는다", () => {
    const markdown = ["````", "```", "[예시](docs/inner.md)", "````", "[실제](docs/real.md)"].join(
      "\n",
    );
    expect(targets(markdown)).toEqual(["docs/real.md"]);
  });

  it("인라인 코드 안의 링크 문법은 세지 않는다", () => {
    expect(targets("`[예시](docs/example.md)` 형식으로 적는다")).toEqual([]);
  });

  it("참조형 링크 정의와 꺾쇠로 감싼 경로를 읽는다", () => {
    const markdown = ["[문서]: docs/ref.md", "[공백](<docs/with space.md>)"].join("\n");
    expect(targets(markdown)).toEqual(["docs/ref.md", "docs/with space.md"]);
  });

  it("참조형 링크 정의는 제목이 붙거나 꺾쇠로 감싸도 읽는다", () => {
    const markdown = [
      '[제목]: docs/titled.md "문서 제목"',
      "[작은따옴표]: docs/single.md '문서 제목'",
      "[꺾쇠]: <docs/with space.md>",
    ].join("\n");
    expect(targets(markdown)).toEqual(["docs/titled.md", "docs/single.md", "docs/with space.md"]);
  });

  // 본문 문서에는 각주가 흔하다. 각주 내용의 첫 단어를 경로로 읽으면 없는 파일이라고 알리게 된다.
  it("각주 정의는 링크로 보지 않는다", () => {
    expect(targets(["본문[^1]", "", "[^1]: 각주 설명", "[^note]: docs/a.md"].join("\n"))).toEqual(
      [],
    );
  });

  // 참조형 정의는 경로 뒤에 따옴표로 감싼 제목만 올 수 있다. 다른 글이 이어지면 그냥 문장이다.
  it("대괄호와 콜론으로 시작해도 경로 뒤에 글이 이어지면 링크로 보지 않는다", () => {
    expect(
      targets(["[TODO]: 나중에 채움", "[주의]: 배포 전에 [문서](docs/a.md) 확인"].join("\n")),
    ).toEqual(["docs/a.md"]);
  });

  // 주석을 가려내려면 여러 줄 주석까지 따라가야 한다. 지금은 가리지 않고 docs/rules.md에 그렇게 적어 둔다.
  it("HTML 주석 안의 링크는 링크로 보고, HTML 태그의 href는 보지 않는다", () => {
    expect(targets('<!-- [옛 문서](docs/old.md) --> <a href="docs/html.md">문서</a>')).toEqual([
      "docs/old.md",
    ]);
  });

  it("퍼센트 인코딩을 풀어서 실제 파일 이름과 비교할 수 있게 한다", () => {
    expect(targets("[발표](docs/%EB%B0%9C%ED%91%9C.md)")).toEqual(["docs/발표.md"]);
  });

  it("디렉터리와 상위 경로 링크도 그대로 모은다", () => {
    expect(targets("[템플릿](.github/ISSUE_TEMPLATE/) [프론트](../menu-pick-frontend)")).toEqual([
      ".github/ISSUE_TEMPLATE/",
      "../menu-pick-frontend",
    ]);
  });
});
