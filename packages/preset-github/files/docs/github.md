# GitHub 사용법

이 저장소는 GitHub에서 이슈·PR을 관리한다. 작업 흐름 자체는 Git 작업 규칙 문서를 따르고, 이 문서는 GitHub에서만 필요한 것을 적는다.

## 템플릿

| 파일 | 용도 |
| --- | --- |
| `.github/ISSUE_TEMPLATE/feature.yml` | 기능 이슈 |
| `.github/ISSUE_TEMPLATE/bug.yml` | 버그 이슈 |
| `.github/ISSUE_TEMPLATE/config.yml` | 빈 이슈를 막는다 |
| `.github/pull_request_template.md` | PR 본문 |

이슈는 템플릿 중 하나를 골라 채운다. PR 본문은 템플릿을 채우고, 이 PR로 이슈가 끝나면 `Closes #<이슈번호>`를 넣어 머지 시 이슈가 닫히게 한다.
이슈·PR 제목은 `[<타입>] <요약>` 형식이다 (예: `[Feat] 주문 취소 사유 필드 추가`). 커밋 메시지(`feat: 요약`)와 다르다.

## gh 명령

```sh
gh issue create --template feature.yml
gh pr create --base main --title "[<타입>] <요약>" --body-file <본문 파일>
gh pr view <PR번호> --json reviews,comments
gh api repos/{owner}/{repo}/pulls/<PR번호>/comments
```

PR 리뷰를 확인할 때는 마지막 두 명령으로 리뷰와 줄 단위 코멘트를 모두 본다.

## 저장소 설정

사람이 GitHub 화면에서 한 번 설정한다.

- **Settings → General → Pull Requests**: `Allow merge commits`만 켠다. squash·rebase 머지는 끈다.
- **Settings → Rules → Rulesets**: `main`에 룰셋을 만든다.
  - 삭제와 force push를 막는다.
  - PR을 거쳐야 머지되게 한다.
  - CI 검사를 필수 체크로 건다. PR 규칙 검사를 CI에 연결했다면 그 검사도 넣는다.

## CI 연결

이 프리셋은 CI 설정 파일을 설치하지 않는다. GitHub를 써도 CI는 GitHub Actions, Jenkins 등 무엇이든 쓸 수 있기 때문이다.
GitHub Actions를 쓴다면 아래 두 워크플로를 만든다.

### 문서 지도 검사

문서를 손으로 더하거나 빼거나 옮겼을 때 `AGENTS.md`가 그대로 맞는지 PR마다 검사한다. 아래 파일을 `.github/workflows/agentsmd.yml`로 만든다.

```yaml
name: agentsmd

on:
  pull_request:

permissions:
  contents: read

jobs:
  agentsmd:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v7
      - uses: xoruddl/agentsmd-kit@v0
```

`agentsmd check`와 같은 것을 검사한다. 문서 지도 파일이나 문서 디렉터리 위치가 기본값과 다르면 `with:`로 넘긴다. 입력 이름은 `agentsmd check`의 옵션과 같다.

```yaml
- uses: xoruddl/agentsmd-kit@v0
  with:
    root: packages/web # 검사할 저장소 루트 (기본 .)
    docs: guides # 문서 디렉터리 (기본 docs)
```

만든 뒤 룰셋의 필수 체크에 `agentsmd`를 추가한다.
이 Action은 Docker 이미지(`ghcr.io/xoruddl/agentsmd`)로 돌므로 Linux 러너(`ubuntu-*`)에서만 쓸 수 있다. 호출한 job의 Node 설정에는 영향을 주지 않는다.
GitLab CI·Jenkins에서 같은 이미지를 쓰는 방법은 Git 작업 규칙 문서의 "문서 지도 검사를 CI에 연결" 절에 있다.

### PR 규칙 검사

Git 프리셋의 PR 규칙 검사(`.githooks/check-pr`)를 함께 설치했다면, 아래 파일을 `.github/workflows/conventions.yml`로 만든다.

```yaml
name: Conventions

on:
  pull_request:
    types: [opened, edited, synchronize, reopened]

permissions: {}

jobs:
  conventions:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v7
      # PR 제목은 작성자가 쓴 값이라 스크립트에 직접 넣지 않고 환경변수로 넘긴다
      - run: .githooks/check-pr
        env:
          BRANCH: ${{ github.head_ref }}
          TITLE: ${{ github.event.pull_request.title }}
```

만든 뒤 룰셋의 필수 체크에 `conventions`를 추가한다.
