import { access, mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { checkRepository, installEntryFiles, installPreset } from "@agentsmd/core";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { springJavaPreset } from "../src/index.js";

let repo: string;

beforeEach(async () => {
  repo = await mkdtemp(join(tmpdir(), "agentsmd-preset-spring-java-"));
  await installPreset(springJavaPreset, repo);
  // AGENTS.md는 init이 고른 프리셋에 맞게 만든다.
  await installEntryFiles([springJavaPreset], repo);
});

afterEach(async () => {
  await rm(repo, { recursive: true, force: true });
});

describe("springJavaPreset", () => {
  // 다른 프리셋 문서로 링크하면 이 프리셋만 설치했을 때 링크가 깨진다.
  // check가 문서끼리의 링크까지 보므로, 문서 4개가 서로 거는 링크도 여기서 함께 확인된다.
  it("이 프리셋만 설치해도 agentsmd check 규칙을 모두 통과한다", async () => {
    await expect(checkRepository({ root: repo })).resolves.toEqual([]);
  });

  it("검증 명령은 Java 프리셋에 맡긴다", () => {
    expect(springJavaPreset).not.toHaveProperty("verify");
  });

  // 이 프리셋만 설치하면 AGENTS.md에 검증 절이 없으므로, java 프리셋이 필요하다고 적어 init이 함께 설치하게 한다.
  it("java 프리셋을 필요로 한다", () => {
    expect(springJavaPreset.requires).toEqual(["java"]);
  });

  // 모듈러 모놀리스 규칙이라 일반적인 JPA 프로젝트에 맞지 않는다. 권장으로 남기면 새 코드에만 적용되어 방식이 섞인다.
  it("모듈 경계 규칙을 두지 않는다", async () => {
    expect(springJavaPreset.rules.some((rule) => rule.includes("다른 기능의 repository"))).toBe(
      false,
    );
    for (const doc of ["architecture.md", "data-jpa.md"]) {
      const text = await readFile(join(repo, "docs/spring-java", doc), "utf8");
      expect(text).not.toContain("ID 로 참조");
    }
  });

  // 성공·실패를 같은 모양으로 내린다. ProblemDetail 안내가 남으면 오류 응답 형식이 두 가지가 된다.
  it("API 응답은 공통 응답 형식만 안내한다", async () => {
    expect(springJavaPreset.rules.some((rule) => rule.includes("ApiResponse"))).toBe(true);
    const api = await readFile(join(repo, "docs/spring-java/api.md"), "utf8");
    expect(api).toContain(
      "record ApiResponse<T>(boolean success, String code, String message, T data)",
    );
    expect(api).not.toContain("ProblemDetail.forStatus");
    expect(api).not.toContain("problemdetails.enabled: true");
  });

  it("레이어 테스트 템플릿을 설치한다", async () => {
    await expect(
      access(join(repo, "src/test/java/LayerArchitectureTest.java")),
    ).resolves.toBeUndefined();
  });

  it("Spring 코드 규칙 테스트 템플릿을 기준선 방식으로 설치한다", async () => {
    const source = await readFile(join(repo, "src/test/java/SpringCodingRulesTest.java"), "utf8");
    expect(source).toContain("FreezingArchRule");
    expect(source).toContain("NO_CLASSES_SHOULD_USE_FIELD_INJECTION");
    expect(source).toContain("docs/spring-java/");
  });

  // 핵심 규칙(엔티티를 API 요청·응답으로 쓰지 않는다)과 문서 규칙이 검사로 이어지는지 본다.
  it("Spring 코드 규칙 테스트가 엔티티 노출·private 프록시 메서드·Spring Nullable 을 검사한다", async () => {
    const source = await readFile(join(repo, "src/test/java/SpringCodingRulesTest.java"), "utf8");
    expect(source).toContain("컨트롤러는_엔티티를_요청이나_응답으로_쓰지_않는다");
    expect(source).toContain("private_메서드에_Transactional과_Async를_두지_않는다");
    expect(source).toContain("Spring_Nullable을_쓰지_않는다");
  });

  // archunit.properties 는 java 프리셋이 설치한다. 두 프리셋이 같은 경로의 파일을 둘 수 없다.
  it("archunit.properties 는 설치하지 않는다", async () => {
    await expect(access(join(repo, "src/test/resources/archunit.properties"))).rejects.toThrow();
  });

  it("핵심 규칙에 기준선을 고치지 않는다는 규칙이 있다", () => {
    expect(springJavaPreset.rules.some((rule) => rule.includes("archunit_store"))).toBe(true);
  });

  // 끊는 방법이 이벤트 하나뿐이면 즉시 결과가 필요한 순환을 피하려고 기능을 합치게 된다.
  it("순환을 이벤트만이 아니라 의존 방향 정리와 개념 분리로도 끊게 안내한다", async () => {
    const rule = springJavaPreset.rules.find((text) => text.includes("순환"));
    expect(rule).toContain("의존 방향 정리");
    expect(rule).toContain("별도 기능");
    const architecture = await readFile(join(repo, "docs/spring-java/architecture.md"), "utf8");
    expect(architecture).toContain("### 순환을 끊는 순서");
    expect(architecture).not.toContain("역방향이 필요하면 도메인 이벤트로 끊는다");
  });

  it("Git 훅과 GitHub 설정은 설치하지 않는다", async () => {
    expect(springJavaPreset).not.toHaveProperty("hooksPath");
    await expect(access(join(repo, ".githooks"))).rejects.toThrow();
    await expect(access(join(repo, ".github"))).rejects.toThrow();
  });
});
