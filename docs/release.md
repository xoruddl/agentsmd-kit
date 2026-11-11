# 릴리스 절차

npm 패키지, Docker 이미지, GitHub Action 태그 세 가지를 같은 버전으로 맞춰 내보낸다.
순서가 어긋나면 사용자가 받는 cli와 Action이 서로 다른 버전이 되므로 아래 순서대로 한다.

## 세 가지 산출물

| 산출물        | 위치                              | 버전을 정하는 곳                                  |
| ------------- | --------------------------------- | ------------------------------------------------- |
| npm 패키지    | `@agentsmd/cli` 외 7개            | `packages/*/package.json`                         |
| Docker 이미지 | `ghcr.io/xoruddl/agentsmd`        | Git 태그 `vX.Y.Z` (release-image 워크플로)        |
| GitHub Action | `uses: xoruddl/agentsmd-kit@vX.Y` | 루트 `action.yml`의 `image:` 핀과 Git 태그 `vX.Y` |

이미지는 npm 배포본이 아니라 이 저장소 소스에서 빌드한다. 그래서 CI는 브랜치 코드로 이미지를 만들어 검사하고, npm 배포와 이미지 푸시 사이에 순서 제약이 없다.

## 순서

1. 릴리스 이슈를 만들고 `build/<이슈>-release-X.Y.Z` 브랜치에서 아래 둘을 함께 올린다. `develop`으로 PR.
   - `packages/*/package.json`의 `version`을 `X.Y.Z`로 올린다.
   - `action.yml`의 `image: docker://ghcr.io/xoruddl/agentsmd:X.Y.Z`를 새 버전으로 바꾼다.
     아직 없는 이미지를 가리키지만, CI는 배포된 이미지를 당기지 않으므로 괜찮다. 사용자는 아래 6번에서 태그를 옮기기 전까지 이전 이미지를 받는다.
2. `develop` → `main` PR을 만들어 머지한다. 제목은 `[Build] X.Y.Z 릴리스`.
3. `main`에서 npm에 배포한다. 2FA 때문에 터미널에서 직접 실행한다.
   ```sh
   git switch main && git pull
   pnpm build && pnpm -r publish --access public --no-git-checks
   ```
4. `main`에 `vX.Y.Z` 태그를 만들어 push한다. release-image 워크플로가 이미지를 `X.Y.Z`, `X.Y`, `latest`로 푸시한다.
   ```sh
   git tag vX.Y.Z main && git push origin vX.Y.Z
   ```
   처음 올리는 패키지는 GHCR이 private으로 만든다. 그 상태로는 다른 저장소의 Action과 `docker run`이 인증 없이 `denied`로 실패하므로,
   첫 푸시 뒤 한 번 GitHub의 Packages → `agentsmd` → Package settings → Danger Zone에서 visibility를 **Public**으로 바꾼다.
5. GitHub 릴리스를 `vX.Y.Z` 태그로 만들고 릴리스 노트를 쓴다.
6. Action 태그 `vX.Y`를 `main`으로 옮긴다. 이미지가 올라간 뒤에 한다. 마이너가 바뀌었으면 새로 만든다.
   ```sh
   git tag -f vX.Y main && git push -f origin vX.Y
   ```
   저장소 규칙은 force push를 금하지만, Action 태그는 GitHub Actions 관례대로 최신 패치를 가리키도록 옮긴다. 브랜치에는 적용하지 않는다.
7. 다른 저장소에서 `uses: xoruddl/agentsmd-kit@vX.Y`와 `docker run ghcr.io/xoruddl/agentsmd:X.Y`가 새 버전으로 도는지 확인하고 릴리스 이슈를 닫는다.

## 이미지만 다시 올릴 때

Dockerfile만 고쳤거나 처음 올릴 때처럼 npm 버전은 그대로인데 이미지를 다시 밀어야 하면, Actions 화면에서 **Release image** 워크플로를 `workflow_dispatch`로 돌리고 `version`에 현재 버전을 넣는다. 돌린 브랜치의 코드로 빌드한다.

## 태그 이름

- `vX.Y.Z`: npm·이미지 릴리스 시점. 옮기지 않는다.
- `vX.Y`: Action 사용자가 참조하는 태그. 패치 릴리스마다 옮긴다.
- 사용자가 `@vX.Y.Z`로 Action을 참조하면 그 시점의 `action.yml`을 쓰므로 동작은 하지만, 패치 수정을 받지 못한다. 문서에서는 `@vX.Y`만 안내한다.
