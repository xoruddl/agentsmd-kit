# agentsmd cli를 담은 이미지. 저장소를 마운트해 `agentsmd check`를 돌린다.
#   docker run --rm -v "$PWD:/repo" -w /repo ghcr.io/xoruddl/agentsmd:0.5 check
# npm 배포본이 아니라 이 저장소 소스에서 빌드한다. CI가 브랜치 코드로 이미지를 만들어 검사하기 위해서다.
# 루트 action.yml이 이 이미지를 쓴다. 빌드·푸시 절차는 docs/release.md.

FROM node:22-alpine AS builder
WORKDIR /app
# pnpm 버전은 package.json의 packageManager를 따른다.
ENV COREPACK_ENABLE_DOWNLOAD_PROMPT=0
RUN corepack enable
COPY . .
RUN pnpm install --frozen-lockfile
RUN pnpm build
# 런타임에는 workspace 패키지끼리의 링크만 필요하다. 개발 의존성을 빼고 다시 설치한 뒤,
# 외부 의존성이 하나도 없으므로 남은 가상 저장소를 지운다.
# (`pnpm prune --prod`는 workspace 링크까지 지운다. TTY가 없으면 CI=true가 필요하다)
RUN CI=true pnpm install --prod --frozen-lockfile --offline && rm -rf node_modules/.pnpm

FROM node:22-alpine
LABEL org.opencontainers.image.source="https://github.com/xoruddl/agentsmd-kit"
LABEL org.opencontainers.image.description="AGENTS.md 문서 지도를 설치하고 검사하는 agentsmd cli"
COPY --from=builder /app /app
RUN printf '#!/bin/sh\nexec node /app/packages/cli/dist/main.js "$@"\n' > /usr/local/bin/agentsmd \
  && chmod +x /usr/local/bin/agentsmd
# 검사할 저장소를 여기에 마운트한다. GitHub Actions는 /github/workspace로 바꿔 넘긴다.
WORKDIR /repo
ENTRYPOINT ["agentsmd"]
CMD ["check"]
