# Git 작업 규칙

모든 작업은 **이슈 → 브랜치 → 커밋 → PR → merge 커밋** 순서로 `main`에 붙인다.
`main`에 직접 커밋·push하지 않는다.

## 1. 이슈

- 작업 전에 이슈를 만든다. 이슈 템플릿이 있으면 채운다. 빈 이슈는 만들지 않는다.
- 제목 형식: `[<타입>] <한국어 요약>` (예: `[Feat] 주문 취소 사유 입력`). 타입은 [PR 제목](#4-pr)과 같다.
- 이슈 하나는 브랜치 하나, PR 하나로 끝낼 크기로 잡는다. 크면 이슈를 나눈다.

## 2. 브랜치

형식: `<타입>/<이슈번호>-<짧은-설명>` (영어 소문자, 단어는 `-`로 연결)

```sh
git switch main
git pull
git switch -c feat/12-order-cancel
```

| 타입       | 용도                              |
| ---------- | --------------------------------- |
| `feat`     | 기능 추가·변경                    |
| `fix`      | 버그 수정                         |
| `refactor` | 동작 변화 없는 구조 개선          |
| `test`     | 테스트만 추가·수정                |
| `docs`     | 문서                              |
| `chore`    | 설정, 의존성 등 기타              |
| `ci`       | CI 워크플로                       |
| `build`    | 빌드 설정 (Gradle, Dockerfile 등) |

## 3. 커밋

형식: `<타입>: <한국어 요약>`. 타입은 브랜치 타입과 같은 목록을 쓴다.

- 제목은 50자 이내, 마침표로 끝내지 않는다.
- 무엇을 왜 바꿨는지 드러나게 쓴다. "~ 추가", "~ 수정", "~ 제거"로 끝낸다.
- 커밋 하나는 책임 하나만 담는다. 크기는 [workflow.md](workflow.md).
- 본문은 제목만으로 이유가 안 보일 때만 1~3줄 쓴다. 어떻게 했는지는 diff가 보여 준다.
- AI 서명, 이모지, 과장 수식어를 쓰지 않는다. → [writing-style.md](writing-style.md)

```
좋음
feat: 주문 취소 사유 필드 추가
fix: 토큰 만료 시 무한 리다이렉트 수정

결제 페이지에서 만료 토큰으로 재진입하면 /login 과 /pay 를 반복함.

나쁨
feat: 주문 기능 개선 및 코드 품질 향상          ← 모호함
fix: 인증 로직의 안정성을 강화했습니다.         ← 서술형, 마침표
feat(order): 주문 취소 사유 필드 추가          ← scope 를 쓰지 않는다
```

## 4. PR

```sh
git push -u origin <브랜치>
```

push 후 쓰는 호스팅(GitHub, GitLab 등)에서 `main` 대상 PR을 만든다. GitLab의 MR(Merge Request)도 이 문서에서는 PR이라 부른다.

- 제목 형식: `[<타입>] <한국어 요약>`. 이슈·PR 목록에서 종류가 눈에 띄게 커밋 메시지와 달리 타입을 대괄호로 감싼다.
  요약은 커밋 제목과 같은 기준으로 쓴다.

  | 브랜치·커밋 타입 | 이슈·PR 제목 타입 |
  | ---------------- | ----------------- |
  | `feat`           | `[Feat]`          |
  | `fix`            | `[Fix]`           |
  | `refactor`       | `[Refactor]`      |
  | `test`           | `[Test]`          |
  | `docs`           | `[Docs]`          |
  | `chore`          | `[Chore]`         |
  | `ci`             | `[CI]`            |
  | `build`          | `[Build]`         |

  ```
  좋음  [Feat] 주문 취소 사유 필드 추가
  나쁨  feat: 주문 취소 사유 필드 추가      ← 커밋 형식
  나쁨  [feat] 주문 취소 사유 필드 추가     ← 소문자 타입
  ```

- 본문은 PR 템플릿이 있으면 채운다. `Closes #<이슈번호>`를 넣어 머지 시 이슈가 자동으로 닫히게 한다.
- 변경 내용은 3줄 이내 불릿. 변경 파일을 나열하지 않는다. 빈 섹션은 지운다.
- 커밋 10개, 변경 300줄 이하를 권장한다. 넘으면 PR을 나눈다.
- CI와 PR 규칙 검사(`.githooks/check-pr`)가 통과해야 머지한다. 리뷰 반영 기준은 [code-review.md](code-review.md).

## 5. 머지

- merge 커밋을 만드는 방식으로 머지한다. squash·rebase 머지는 쓰지 않는다.
  브랜치의 커밋 이력을 그대로 남기고, 기능 단위로 되돌릴 때 `git revert -m 1 <merge 커밋>`을 쓰기 위해서다.
- 머지 후 브랜치는 삭제한다.
- `main`이 앞서 나가면 브랜치에 `main`을 merge해서 충돌을 미리 해결한다. push한 이력은 rebase하지 않는다.

```sh
git switch feat/12-order-cancel
git merge main
```

- `--force` push와 훅 우회(`--no-verify`)는 하지 않는다. 에이전트 설정(`.claude/settings.json`)에서도 막는다.

## 자동 검사

| 위치                               | 검사                                                            |
| ---------------------------------- | --------------------------------------------------------------- |
| `.githooks/commit-msg`             | 커밋 형식, 제목 50자, 마침표, AI 서명                           |
| `.githooks/pre-commit.d/max-files` | 커밋당 파일 수. `.githooks/pre-commit`이 다른 검사와 함께 실행  |
| `.githooks/check-pr`               | 브랜치 이름, PR 제목, `Closes #N`. 훅이 아니라 CI가 PR마다 실행 |

훅은 `agentsmd init`이 연결한다. 직접 연결하려면 `git config core.hooksPath .githooks`.

### PR 규칙 검사를 CI에 연결

로컬 훅은 각자 PC에서만 돌기 때문에, PR 규칙은 CI에서 한 번 더 검사하고 그 결과가 통과해야 머지되게 한다.
`.githooks/check-pr`는 어느 CI에서든 환경변수 세 개만 넘겨 부른다.

```sh
BRANCH=feat/12-order-cancel TITLE="[Feat] 주문 취소 사유 필드 추가" BODY="Closes #12" .githooks/check-pr
```

| CI                    | BRANCH                                 | TITLE                                    | BODY                                    |
| --------------------- | -------------------------------------- | ---------------------------------------- | --------------------------------------- |
| GitHub Actions        | `${{ github.head_ref }}`               | `${{ github.event.pull_request.title }}` | `${{ github.event.pull_request.body }}` |
| GitLab CI             | `$CI_MERGE_REQUEST_SOURCE_BRANCH_NAME` | `$CI_MERGE_REQUEST_TITLE`                | `$CI_MERGE_REQUEST_DESCRIPTION`         |
| Jenkins (Multibranch) | `$CHANGE_BRANCH`                       | `$CHANGE_TITLE`                          | 넘기지 않음 (Closes 검사 건너뜀)        |

- 제목·본문은 PR 작성자가 쓴 값이다. CI 스크립트 본문에 직접 끼워 넣지 말고 환경변수로 넘긴다.
- `BODY`를 넘기지 않으면 `Closes #N` 검사만 건너뛴다. 빈 문자열을 넘기면 검사해서 실패한다.
- 검사가 실패하면 종료 코드 1, `BRANCH`·`TITLE`이 없으면 2를 돌려준다.
