import * as modulesParser from './npm-modules-parser';
import * as lockParser from './npm-lock-parser';
import * as types from '../types';
import { MissingTargetFileError } from '../../errors/missing-targetfile-error';

export async function inspect(root: string, targetFiles: string[], options: types.Options = {}):
Promise<types.InspectResult> {
  if (!targetFiles ) {
    throw MissingTargetFileError(root);
  }
  const isLockFileBased = ((targetFiles.filter(file => 'package-lock.json') || targetFiles.filter(file => 'yarn.lock')));

  const getLockFileDeps = isLockFileBased && !options.traverseNodeModules;
  return {
    plugin: {
      name: 'snyk-nodejs-lockfile-parser',
      runtime: process.version,
    },
    package: getLockFileDeps ?
      await lockParser.parse(root, targetFiles, options) :
      await modulesParser.parse(root, targetFiles, options),
  };
}
