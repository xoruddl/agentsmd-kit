import { chmod, readdir, stat } from "node:fs/promises";
import { join } from "node:path";

/**
 * 훅 디렉터리 아래의 모든 파일에 실행 권한을 준다. 하위 디렉터리(`pre-commit.d/` 등)도 포함한다.
 *
 * npm 패키지로 배포하면 파일의 실행 권한이 사라지고, Git은 실행 권한이 없는 훅을 오류 없이 건너뛴다.
 * 그래서 설치한 뒤 권한을 직접 맞춘다. 훅 디렉터리가 없으면 아무것도 하지 않는다.
 *
 * @returns 권한을 준 파일 수
 */
export async function makeHooksExecutable(root: string, hooksPath: string): Promise<number> {
  const dir = join(root, hooksPath);
  if (!(await isDirectory(dir))) {
    return 0;
  }
  const entries = await readdir(dir, { recursive: true, withFileTypes: true });
  const files = entries.filter((entry) => entry.isFile());
  for (const file of files) {
    await chmod(join(file.parentPath, file.name), 0o755);
  }
  return files.length;
}

async function isDirectory(path: string): Promise<boolean> {
  try {
    return (await stat(path)).isDirectory();
  } catch {
    return false;
  }
}
