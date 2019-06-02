
import * as snykPolicy from 'snyk-policy';
import * as display from './display-policy';

export async function displayPolicy(path) {
  try {
    await snykPolicy.load(path || process.cwd());
    display();
  } catch (error) {
    if (error.code === 'ENOENT') {
      error.code = 'MISSING_DOTFILE';
    }
    throw error;
  }
}
