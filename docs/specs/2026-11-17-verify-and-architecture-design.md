# 설계: 검증 통합(`agentsmd verify`)과 Java 패키지 구조 검사

## 왜

AI 에이전트가 코드를 늘릴 때는 기존 패키지에 파일을 계속 추가하는 쪽이 가장 쉽다. 그래서 코드가 커져도 패키지가 다시 나뉘지 않는다.
orbit-server의 `domain/monitoring/service`에는 파일이 28개 있다. 서비스, 조회 결과 `record`, 일급 컬렉션, 설정·스케줄 클래스가 섞여 있다.
규칙을 어겨서 생긴 일은 아니다. 다시 나눌 계기가 작업 흐름에 없어서 생긴 일이다.

원하는 상태는 두 가지다.

- AI가 패키지 구조와 코드 작성 규칙을 실무 관례에 맞게 쓴다.
- 구조가 코드와 함께 자라면서 계속 읽기 좋게 바뀐다. AI가 재구성할 때를 스스로 알아채고, 스스로 판단해 나누고, 도구로 결과를 검증한다.

참고할 모습은 gdsc-server다. 파일이 434개이고 가장 큰 패키지가 21개다. 레이어 안이 커지면 `domain/event/`, `application/listener/`처럼 역할 단위 하위 패키지로 나눈다.

검사는 새로 만들지 않고 검증된 도구(ArchUnit, Spring Modulith, ESLint 등)에 맡긴다.
agentsmd는 그 도구들을 **설치·연결·실행 입구**로 엮는다. AI, hook, CI가 같은 명령 하나로 같은 검증을 돌리게 하는 것이 목표다.

## 목표

1. `agentsmd verify`: `.agentsmd/verify.json`에 적힌 단계를 순서대로 실행하는 단일 입구. 이름으로 일부 단계만 고를 수 있다.
2. `java` 프리셋: 패키지 크기 신호를 주는 ArchUnit 테스트 템플릿과, 패키지가 커질 때 나누는 법을 담은 문서
3. `spring-java` 프리셋: 레이어 의존·클래스 위치 규칙을 담은 ArchUnit 테스트 템플릿
4. 이미 커진 코드베이스에도 넣을 수 있도록 ArchUnit `FreezingArchRule`로 기준선을 둔다.
5. orbit-server에 설치해 실제로 동작하는지 확인한다(수용 기준).

## 하지 않는 것 (이번 단계)

- 검사 엔진을 직접 만드는 일. 예전 설계(`agentsmd lint`)는 폐기했다.
- 도구 출력을 읽어 한 형식으로 바꾸는 일(SARIF·JUnit XML 해석, 통합 기준선). 써 보고 부족하면 다음 단계에서 한다.
- Claude Code hook, pre-commit 연결. 이번에는 `verify`를 hook이 부를 수 있는 형태로만 만든다.
- Spring Modulith 도입. 문서에 "컨텍스트 경계 검사는 순환을 정리한 뒤 Modulith로" 안내만 둔다.
- TypeScript·React 쪽 구조 검사
- orbit-server의 코드 변경. `entity` → `domain` 이름 변경과 프리셋 적용은 orbit-server 저장소에서 따로 한다.

## 실패로 보는 것 (안티 목표)

- 구조를 지금 모양으로 얼려, 의도한 재구성까지 막는 것
- 오탐이 많아 AI가 메시지를 무시하게 되는 것
- AI가 기준선을 고쳐 경고를 숨기는 것
- 재구성(파일 이동)과 기능 변경이 한 커밋에 섞이는 것
- `verify`가 도구 출력을 가려서, AI가 원래 도구의 오류를 못 보는 것

## 제약

- `core`의 규칙은 순수 함수이고, 파일 읽기는 한 곳에서만 한다. 명령은 `Io`를 쓴다. `cli`는 외부 의존성을 두지 않는다.
- 설치는 이미 있는 파일을 덮어쓰지 않는다. 그래서 `build.gradle.kts`에 ArchUnit 의존성을 자동으로 넣을 수 없고, 문서와 `nextSteps`로 안내한다.
- 프리셋은 CI 설정 파일을 두지 않는다.
- 이 저장소에는 Java 빌드가 없다. 템플릿 Java 코드가 컴파일되고 동작하는지는 이 저장소의 CI로 확인할 수 없다.
- 지금까지 언어 프리셋의 `files/`에는 문서만 있었다. 테스트 템플릿(코드)을 두는 것은 새 종류의 설치 파일이므로 `docs/architecture.md`의 프리셋 규칙을 함께 고친다.

## 검토한 방식

검사를 누가 하나:

| 방식                                   | 판단                                                                                                                                           |
| -------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| agentsmd가 직접 검사 (`agentsmd lint`) | 폐기. 의존 방향·기준선은 Packwerk, Structural, ArchUnit, dependency-cruiser가 이미 잘 한다. import 문만 읽는 방식이라 ArchUnit보다 덜 정확하다 |
| **기존 도구 + agentsmd가 엮기**        | **선택.** 정확한 검사는 검증된 도구에 맡기고, agentsmd는 설치·연결·실행을 맡는다                                                               |

agentsmd가 어디까지 엮나:

| 수준                 | 판단                                                                                           |
| -------------------- | ---------------------------------------------------------------------------------------------- |
| A. 설치·연결만       | 스택마다 명령이 달라 "하나로 엮인" 느낌이 약하다                                               |
| **B. 실행까지 통합** | **선택.** `agentsmd verify` 하나로 AI·hook·CI가 같은 검증을 돈다. 도구 출력은 그대로 보여 준다 |
| C. 결과까지 통합     | 도구마다 결과 해석기를 만들고 유지해야 한다. 다음 단계 후보                                    |

Java 구조 검사 도구:

| 도구                         | 판단                                                                                                                                                                          |
| ---------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **ArchUnit**                 | **선택.** 바이트코드를 분석해 정확하고, 레이어·위치·사용자 정의 규칙(패키지 크기)과 기준선(`FreezingArchRule`)이 모두 된다. 테스트 하나라 `./gradlew build`에 저절로 포함된다 |
| Spring Modulith              | 컨텍스트 경계·순환 검사에 좋다. 하지만 기준선이 없고, orbit에는 `vehicle` ↔ `update`, `global` ↔ `domain` 순환이 있어 지금 켜면 바로 실패한다. 순환을 정리한 뒤의 단계로 둔다 |
| Structural (Gradle 플러그인) | 설정 방식은 비슷하지만 위치·크기 규칙이 없고 사용자층이 작다                                                                                                                  |

## 결정한 것

### 1. `agentsmd verify`

```bash
agentsmd verify                         # .agentsmd/verify.json 의 단계를 위에서부터 차례로 실행
agentsmd verify --only architecture     # 이름을 고른 단계만 (쉼표로 여러 개)
agentsmd verify --root ../other-repo
```

- 실행할 명령의 출처는 **`.agentsmd/verify.json` 하나**다. AGENTS.md는 사람과 AI가 자주 고치는 문서라, 절 이름이나 블록 모양이 바뀌면 실행되는 명령이 조용히 바뀐다. 그래서 문서와 실행 설정을 나눈다.

```json
{
  "steps": [
    { "name": "build", "run": "pnpm build" },
    { "name": "architecture", "run": "./gradlew test --tests PackageSizeTest" }
  ]
}
```

- `name`은 영문 소문자·숫자·`-`이고 파일 안에서 겹치지 않는다. `run`은 셸로 그대로 실행한다(`&&`가 들어 있어도 된다). 작업 디렉터리는 `--root`다.
  형식이 틀리면(필드 없음, 이름 중복, 빈 `steps`) 종료 코드 2로 끝나고 무엇이 틀렸는지 알린다.
- `--only`는 고른 단계만 파일 순서대로 실행한다. 언어별·용도별로 일부만 돌릴 때 쓴다(예: hook에서 구조 검사만). 없는 이름이면 종료 코드 2.
- 앞 단계가 실패하면 멈추고, 그 단계의 종료 코드와 상관없이 `verify`는 1을 돌려준다.
  각 도구의 출력은 가리지 않고 그대로 흘려보낸다(stdout·stderr).
- 각 단계 앞에는 `[verify 2/4 architecture] ./gradlew test ...`처럼 진행 줄을 찍는다. 실패하면 마지막에 어느 단계가 실패했는지 한 줄로 요약한다.
- 파일이 없으면 종료 코드 2로 끝나고 "`agentsmd init`으로 만드세요"라고 안내한다. 실행 경로에서 AGENTS.md를 읽지 않는다.
- 파일을 읽고 형식을 확인하는 일은 `core`의 순수 함수로 둔다. 파일 읽기는 `cli`가 한다.
- `agentsmd check`는 자동으로 끼워 넣지 않는다. 필요하면 단계로 적는다.

#### 프리셋 검증 명령과 AGENTS.md

- 프리셋의 `verify` 명령은 AGENTS.md가 아니라 `verify.json`에 합친다. 단계 이름은 프리셋 이름이고, 같은 `run`이 이미 있으면 넣지 않는다. 사람이 고친 단계는 건드리지 않는다.
- AGENTS.md의 `## 검증` 절에는 명령 목록 대신 안내 한 줄을 둔다: "작업을 마치기 전에 `agentsmd verify`를 실행하고 결과를 그대로 보고한다. 단계 목록은 `.agentsmd/verify.json`."
- **옮겨 오기:** 0.7 이하로 설치해 AGENTS.md `## 검증` 코드 블록에 명령이 있는 저장소에서 `verify.json`이 없으면, `init`이 그 블록의 명령으로 `verify.json`을 처음 한 번 만든다(`verifyCommands` 사용, 이름은 `step-1`, `step-2`…). AGENTS.md의 블록은 지우지 않고 그대로 둔다. 사람이 쓴 문서일 수 있어서다. 대신 `init`이 안내 한 줄로 바꿔도 된다고 알린다.
- 프로세스 실행은 `Io`와 별도로 주입하는 실행기(`Runner`)로 둔다. 테스트에서 실제 명령을 띄우지 않고 단계 순서와 종료 코드를 확인하기 위해서다.
  실제 실행기는 `node:child_process`로 셸을 거쳐 실행하고 출력은 그대로 넘긴다(`stdio: "inherit"`). 시그널로 끝난 단계도 실패로 본다. 진행 줄과 요약만 `Io`로 찍는다.

### 2. `java` 프리셋: 패키지 크기 신호

- 설치 파일: `src/test/java/ArchitectureSizeTest.java`(이름은 짓는 사람이 정한다). 패키지당 클래스 수 상한을 검사하는 ArchUnit 테스트다.
  - 상한의 기본값은 15다. 테스트 안의 상수 하나로 둬서 프로젝트가 바꿀 수 있게 한다.
  - 실패 메시지에는 패키지 이름, 클래스 수, **역할 분포**를 넣는다(예: `config 3, service 7, record 13, 기타 5`). 역할은 어노테이션 이름과 `record` 여부, 상속 대상으로 판단한다.
  - 나누는 순서와 근거 문서(`docs/java/package-structure.md`)를 메시지에 넣는다.
    1. 역할이 섞여 있으면 역할 단위 하위 패키지로 나눈다.
    2. 한 역할 안에서도 크면 기능 단위 하위 패키지로 나눈다.
    3. 컨텍스트 경계 자체가 의심되면 사람에게 묻는다.
  - 중첩 클래스와 익명 클래스는 세지 않는다. 파일 수에 가깝게 세기 위해서다.
- 루트 패키지를 모르므로, 템플릿은 기본 패키지에 두고 `@AnalyzeClasses`에 패키지를 주지 않는다.
  대신 `importOptions`로 테스트 클래스와 jar·jrt를 빼서 **프로젝트의 main 클래스만** 읽는다(`DoNotIncludeTests`, `DoNotIncludeArchives`).
  이 방식이 실제로 동작하지 않으면 설치 후 루트 패키지를 채우도록 `nextSteps`로 안내하는 방식으로 바꾼다. 둘 중 무엇이 되는지는 구현 첫 단계에서 orbit-server로 확인한다.
- **기준선: `FreezingArchRule`을 쓰지 않는다.** 이 기준선은 위반 문장을 그대로 기억한다. 그래서 문장에 든 클래스 수가 28에서 27로 줄어도 새 위반으로 실패한다.
  대신 **이미 큰 패키지와 그 상한을 테스트 코드에 직접 적는다**(예: `"monitoring.service" → 28`).
  - 적힌 패키지는 적힌 수를 넘을 때만 실패하고, 줄어들면 통과한다.
  - 상한을 올리려면 코드를 고쳐야 하므로 PR diff에 드러난다. orbit의 순환 규칙이 알려진 예외를 코드에 적는 방식과 같다.
  - 적힌 패키지가 15개 이하로 줄면 테스트가 "목록에서 지워도 된다"고 실패로 알린다. 목록이 저절로 줄어들게 하려는 것이다.
- 문서 `docs/java/package-structure.md`(새로 만듦): 패키지가 커질 때 나누는 법, 재구성 작업 방식, 큰 패키지 목록을 다루는 규칙, ArchUnit 의존성 추가 스니펫. 프리셋 `docs`에 올려 문서 지도에 들어가게 한다.
- `nextSteps`: ArchUnit 테스트 의존성을 추가하라는 안내. 스니펫은 Kotlin DSL(`build.gradle.kts`)과 Groovy DSL(`build.gradle`) 둘 다 적는다(orbit은 Groovy를 쓴다).
  버전은 구현할 때 최신 안정판을 확인해 문서와 함께 고정한다. 이미 ArchUnit이 있는 저장소는 이 단계를 건너뛴다.

### 3. `spring-java` 프리셋: 레이어 의존·위치

- 설치 파일: `src/test/java/ArchitectureLayerTest.java`. 프리셋 문서 `docs/spring-java/architecture.md`의 규칙을 그대로 옮긴다.
  - `domain`은 `controller`·`service`·`repository`를 모르고, Spring에 의존하지 않는다(JPA 매핑 어노테이션은 예외).
  - `controller → service → repository` 방향. `controller`가 `repository`를 직접 쓰지 않는다.
  - `global`은 기능 패키지에 의존하지 않는다. 다만 `global/external`은 서비스가 정한 포트를 구현하므로 기능의 `service`·`domain`·`exception`을 쓸 수 있다.
    프리셋 문서는 "포트와 포트가 쓰는 타입"까지 허용하지만, 규칙은 이 세 패키지 전체를 허용하는 것으로 근사한다.
  - 다른 기능의 `repository`·`domain`을 직접 쓰지 않는다.
  - 위치: `@RestController`·`@Controller`는 `controller`에, `@Entity`·`@Embeddable`은 `domain`에 둔다. `Repository`·`CrudRepository`·`JpaRepository`를 상속한 인터페이스는 `repository`에 둔다.
  - 어노테이션은 정확한 타입으로 비교한다. `@RestControllerAdvice`는 `@RestController`가 아니다.
- **레이어는 "기능 바로 아래 패키지 이름"으로 판단한다.** `..domain..` 같은 단순 패턴은 쓰지 않는다.
  orbit(`com.orbit.server.domain.vehicle.domain`)과 gdsc(`...gdsc.domain.study.domain`)처럼 최상위 `domain` 아래에 다시 `domain` 레이어가 있으면, 단순 패턴이 모든 클래스에 걸리기 때문이다.
  템플릿 맨 위에 기능 루트 상수 하나를 두고(프리셋 문서 구조는 루트 바로 아래가 기능, orbit·gdsc는 `domain` 아래가 기능), 레이어는 기능 바로 아래 이름으로 잡는다.
  기능 단위 하위 패키지(`service/stream/`)도 그 레이어에 속한다.
- 규칙 템플릿은 orbit-server의 `ArchitectureTest`(#94, #99)를 일반화해서 만든다. 다음 판단을 이어받는다.
  - `global/external`은 허용 목록 방식으로 검사한다.
  - 순환은 기준선에 넣지 않고, 알려진 역방향 의존만 클래스 단위로 허용한다.
  - 기준선 자동 생성은 막는다.
- 이 테스트의 기존 위반은 `FreezingArchRule`로 기준선에 둔다. 의존·위치 위반은 문장이 바뀌지 않아 이 방식이 맞는다.
  `archunit.properties`는 orbit과 같이 저장 위치를 `src/test/resources/archunit_store`로 고정하고 `freeze.store.default.allowStoreCreation=false`로 둔다.
  처음 도입할 때만 이 값을 잠시 켜서 기준선을 만들라고 `nextSteps`와 문서로 안내한다. AI가 기준선 폴더를 지워 모든 위반을 통과시키는 일을 막기 위해서다.
  이 파일은 `spring-java` 프리셋만 설치한다(두 프리셋이 같은 경로의 파일을 두지 않는다).
- `docs/spring-java/architecture.md`와 `testing.md`의 "ArchUnit 테스트로 검사할 수 있다"는 문장을 "설치된 테스트가 검사한다"로 바꾸고, 테스트 파일과 패키지 구조 문서를 가리킨다.

### 4. 기준선을 숨기지 못하게 하기

- 프리셋 문서와 AGENTS.md 핵심 규칙에 둘을 적는다. "ArchUnit 기준선(`archunit_store`)을 직접 고치거나 지우지 않는다", "큰 패키지 목록의 상한을 올리지 않는다. 넘으면 패키지를 나눈다".
- `git` 프리셋의 `.claude/settings.json` 권한 차단(`permissions.deny`)에 기준선 디렉터리 수정·삭제를 더할지는 구현 때 정한다.
  `git` 프리셋은 언어를 모르므로, 넣는다면 `java` 프리셋이 따로 설정을 설치해야 한다. 이번 단계에서는 문서 규칙까지만 한다.
- CI에서 기준선이 늘었는지 비교하는 일은 다음 단계다.

### 5. 재구성 작업 방식

`docs/java/package-structure.md`에 적는다. 크기 신호가 오면 AI가 스스로 판단해 재구성한다.

1. 진행 중인 기능 변경과 섞지 않고, 파일 이동만 하는 별도 커밋으로 재구성한다.
2. 같은 커밋에서 구조 문서(패키지 구조 설명)를 고친다.
3. `agentsmd verify`가 통과한 뒤 원래 작업을 이어 간다.

## 짓는 사람에게 맡기는 것

- 테스트 클래스 이름, 역할 판단 기준의 세부 구현
- `verify`의 진행 줄과 요약 문구, 셸 실행 방식(`sh -c` 등)의 세부. 단, Windows는 이번 범위가 아니다.
- 문서 문구. `docs/commands.md`(`verify` 추가), `docs/architecture.md`(프리셋이 테스트 템플릿을 둘 수 있다는 규칙), README, 도움말을 함께 고친다.

## 수용 기준

- 이 저장소: 이 저장소도 `.agentsmd/verify.json`으로 옮기고, `agentsmd verify`가 그 단계를 돌려 통과한다. 단계 하나가 실패하면 종료 코드 1을 돌려주고 실패 단계를 알린다.
- 0.7 방식의 AGENTS.md(검증 블록 있음)에 `init`을 다시 실행하면 `verify.json`이 블록의 명령으로 만들어진다.
- 프리셋 테스트: `java`, `spring-java`를 설치한 결과가 지금처럼 `check`를 통과한다.
- orbit-server(이 저장소 밖에서 따로 수행). orbit에는 이미 ArchUnit 1.5.1, `ArchitectureTest`, `archunit.properties`, `archunit_store`가 있다.
  - `entity` → `domain` 이름을 먼저 바꾼다. 파일 이동만 하는 커밋이고 기존 `ArchitectureTest`의 패키지 문자열도 함께 고친다.
  - 크기 테스트는 템플릿을 그대로 새 파일로 추가한다. 큰 패키지 목록에는 `monitoring.service`(28)와 `update.service`(17)를 적는다.
  - 레이어·위치 규칙은 템플릿 파일을 설치하지 않고 **기존 `ArchitectureTest`에 직접 더한다**. 같은 위반을 두 번 보고하지 않기 위해서다.
  - 새 규칙의 위반이 나오면 하나씩 확인해, 템플릿 규칙의 문제인지 orbit 코드의 실제 위반인지 보고한다. 실제 위반만 기준선에 넣는다.
  - `monitoring/service`에 클래스를 하나 더하면 테스트가 실패하고, 메시지에 역할 분포와 나누는 순서가 나온다. `edge/service`(15)에 하나를 더해도 실패한다.

## 결정 기록

1. 검사는 새로 만들지 않고 기존 도구(ArchUnit)에 맡긴다. agentsmd는 설치·연결·실행을 엮는다(B 수준).
2. 실행할 명령의 출처는 `.agentsmd/verify.json` 하나다. AGENTS.md를 고쳐도 실행되는 명령이 바뀌지 않게 하려는 것이다. 기존 AGENTS.md 검증 블록은 `init`이 한 번 옮겨 온다. `--only`로 단계를 골라 실행할 수 있다.
3. 패키지당 클래스 상한은 15다. Qualimetrix의 경고 기준(15)과 gdsc-server의 실제 분포를 따랐다.
4. 크기 기준선은 `FreezingArchRule`이 아니라 큰 패키지 목록을 코드에 적는 방식이다.
5. orbit에서는 레이어 규칙을 기존 `ArchitectureTest`에 더하고, 크기 테스트만 새 파일로 둔다.
6. 기준선 자동 생성은 막는다(`allowStoreCreation=false`). orbit의 기존 판단을 따른다.
7. Spring Modulith는 컨텍스트 간 순환(`vehicle` ↔ `update`, `global` ↔ `domain`)을 정리한 뒤의 단계로 둔다.
