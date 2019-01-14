import fs = require('fs');
import subProcess = require('./sub-process');

interface GitInfo {
  originUrl: string;
  branch: string;
  commitSha: string;
  localRoot: string;
}

export async function getGitInfo(): Promise<GitInfo> {
  const originUrl = (await subProcess.execute('git', ['remote', 'get-url', 'origin'])).trim();
  const branch = (await subProcess.execute('git', ['rev-parse', '--abbrev-ref', 'HEAD'])).trim();
  const commitSha = (await subProcess.execute('git', ['rev-parse', 'HEAD'])).trim();
  const localRoot = findGitRoot();

  return {
    originUrl,
    branch,
    commitSha,
    localRoot,
  };
}

function findGitRoot(): string {
  let path = process.cwd();

  do {
    if (fs.existsSync(path + '/.git')) {
      return path;
    }

    path = fs.realpathSync(path + '/..');
  } while (fs.existsSync(path) && path !== '/');

  return '';
}
