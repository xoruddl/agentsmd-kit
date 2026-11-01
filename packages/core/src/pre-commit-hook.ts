/**
 * `.githooks/pre-commit`에 설치할 실행기.
 *
 * 검사 내용은 프리셋마다 `.githooks/pre-commit.d/`에 스크립트로 넣고, 이 실행기는 그것들을 이름 순서로 돌린다.
 * 실행기를 한 프리셋이 가지면 그 프리셋 없이 설치한 다른 프리셋의 검사가 돌지 않으므로, 설치할 때 따로 만든다.
 */
export const PRE_COMMIT_HOOK = `#!/usr/bin/env bash
#
# .githooks/pre-commit.d/ 의 검사를 이름 순서로 실행한다. 하나라도 실패하면 커밋을 막는다.
# 실행 권한이 있는 파일만 검사로 본다. agentsmd init 이 설치한 파일이다.

set -euo pipefail

checks_dir="$(dirname "$0")/pre-commit.d"
if [ -d "$checks_dir" ]; then
  for check in "$checks_dir"/*; do
    if [ -f "$check" ] && [ -x "$check" ]; then
      "$check"
    fi
  done
fi

exit 0
`;
