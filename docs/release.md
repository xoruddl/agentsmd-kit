# 릴리스 절차

npm 패키지, Docker 이미지, GitHub Action 태그 세 가지를 같은 버전으로 맞춰 내보낸다.
순서가 어긋나면 사용자가 받는 cli와 Action이 서로 다른 버전이 되므로 아래 순서대로 한다.

## 세 가지 산출물

| 산출물        | 위치                            | 버전을 정하는 곳                                |
| ------------- | ------------------------------- | ----------------------------------------------- |
| npm 패키지    | `@agentsmd/cli` 외 8개          | `packages/*/package.json`                       |
| Docker 이미지 | `ghcr.io/xoruddl/agentsmd`      | Git 태그 `vX.Y.Z` (release-image 워크플로)      |
| GitHub Action | `uses: xoruddl/agentsmd-kit@v0` | 루트 `action.yml`의 `image:` 핀과 Git 태그 `v0` |

이미지는 npm 배포본이 아니라 이 저장소 소스에서 빌드한다. 그래서 CI는 브랜치 코드로 이미지를 만들어 검사하고, npm 배포와 이미지 푸시 사이에 순서 제약이 없다.

## 순서

1. 릴리스 이슈를 만들고 `build/<이슈>-release-X-Y-Z` 브랜치에서 아래 둘을 함께 올린다. `develop`으로 PR. 브랜치 이름 규칙이 점을 허용하지 않아 버전은 `-`로 잇는다.
   - `packages/*/package.json`의 `version`을 `X.Y.Z`로 올린다.
   - `action.yml`의 `image: docker://ghcr.io/xoruddl/agentsmd:X.Y.Z`를 새 버전으로 바꾼다.
     아직 없는 이미지를 가리키지만, CI는 배포된 이미지를 당기지 않으므로 괜찮다. 사용자는 아래 6번에서 태그를 옮기기 전까지 이전 이미지를 받는다.
2. `develop` → `main` PR을 만들어 머지한다. 제목은 `[Build] X.Y.Z 릴리스`.
3. `main`에서 npm에 배포한다. 2FA 때문에 터미널에서 직접 실행한다.
   ```sh
   git switch main && git pull
   pnpm build && pnpm -r publish --access public --no-git-checks
   ```
4. `main`에 `vX.Y.Z` 태그를 만들어 push한다. release-image 워크플로가 이미지를 `X.Y.Z`, `X.Y`, `0`, `latest`로 푸시한다.
   ```sh
   git tag vX.Y.Z main && git push origin vX.Y.Z
   ```
   처음 올린 뒤에는 패키지가 **Public**인지 확인한다. 이 저장소의 워크플로가 올리면 public으로 연결되지만, private이면 다른 저장소의 Action과 `docker run`이 인증 없이 `denied`로 실패한다.
   익명으로 `docker pull ghcr.io/xoruddl/agentsmd:X.Y.Z`가 되면 public이다. 아니면 GitHub의 Packages → `agentsmd` → Package settings → Danger Zone에서 바꾼다.
   이미지는 amd64·arm64 두 플랫폼으로 올라간다. ARM 러너나 Apple Silicon에서 당겨 확인해도 된다.
5. GitHub 릴리스를 `vX.Y.Z` 태그로 만들고 릴리스 노트를 쓴다.
6. Action 태그 `v0`를 `main`으로 옮긴다. 이미지가 올라간 뒤에 한다. 패치든 마이너든 같은 태그를 옮긴다.
   ```sh
   git tag -f v0 main && git push -f origin v0
   ```
   저장소 규칙은 force push를 금하지만, Action 태그는 GitHub Actions 관례대로 최신 릴리스를 가리키도록 옮긴다. 브랜치에는 적용하지 않는다.
7. 다른 저장소에서 `uses: xoruddl/agentsmd-kit@v0`와 `docker run ghcr.io/xoruddl/agentsmd:0`이 새 버전으로 도는지 확인하고 릴리스 이슈를 닫는다.

## 패키지 이름을 바꿨을 때

`pnpm -r publish`는 새 이름을 새 패키지로 올릴 뿐이고, 옛 이름의 패키지는 npm에 그대로 남는다. 옛 패키지를 직접 설치한 사용자는 갱신이 끊긴 것을 알 수 없다.
배포(3번)가 끝난 뒤 옛 패키지를 deprecate 한다. 설치할 때 이 문구가 경고로 나온다. 패키지를 지우지는 않는다.

```sh
npm deprecate @agentsmd/preset-spring "이름이 @agentsmd/preset-spring-java 로 바뀌었습니다"
```

- 0.7.0: `@agentsmd/preset-spring` → `@agentsmd/preset-spring-java`
- 프리셋 이름(`--preset`)도 함께 바뀌었으면 릴리스 노트에 적는다. → [architecture.md](architecture.md)

## 이미지만 다시 올릴 때

Dockerfile만 고쳤거나 처음 올릴 때처럼 npm 버전은 그대로인데 이미지를 다시 밀어야 하면, Actions 화면에서 **Release image** 워크플로를 `workflow_dispatch`로 돌리고 `version`에 현재 버전을 넣는다. 돌린 브랜치의 코드로 빌드한다.
이미지 태그 `0`도 함께 옮겨지므로 옛 버전을 넣어 돌리면 `0`이 옛 이미지로 되돌아간다. 그랬다면 최신 버전으로 한 번 더 돌린다.

## 태그 이름

- `vX.Y.Z`: npm·이미지 릴리스 시점. 옮기지 않는다.
- `v0`: Action 사용자가 참조하는 메이저 태그. 릴리스마다 옮긴다. 1.0부터는 `v1`을 쓴다.
- `v0.5`: 메이저 태그로 바꾸기 전에 안내하던 태그. 0.5.0에 남겨 두고 더 옮기지 않는다.
- 사용자가 `@vX.Y.Z`로 Action을 참조하면 그 시점의 `action.yml`과 이미지로 고정된다. 새 릴리스를 받지 않으려는 경우에 쓴다. 문서에서는 `@v0`만 안내한다.
- 이미지 태그도 같은 방식이다. 문서에서는 `ghcr.io/xoruddl/agentsmd:0`만 안내하고, 고정하려면 `:X.Y.Z`를 쓴다. `:X.Y`는 그 마이너의 최신 패치를 가리킨다.
- 메이저 태그는 마이너 릴리스도 곧바로 사용자에게 닿는다. 기존 저장소의 검사가 새로 실패할 수 있는 변경은 릴리스 노트에 적는다.
