import * as _ from 'lodash';
import * as path from 'path';
import * as fs from 'fs';
import * as debugModule from 'debug';

import * as modulesParser from './npm-modules-parser';
import * as lockParser from './npm-lock-parser';
import * as types from '../types';
import { MissingTargetFileError } from '../../errors/missing-targetfile-error';
import { MultiProjectResult } from '@snyk/cli-interface/legacy/plugin';
import { TestOptions, Options, MonitorOptions } from '../../types';
import { DepTree } from '@snyk/cli-interface/legacy/common';
import { ScannedProjectCustom } from '../get-multi-plugin-result';
import { getYarnWorkspaces } from 'snyk-nodejs-lockfile-parser';

export const supportedTargetFiles = [
  'package.json',
  'yarn.lock',
  'package-lock.json',
];

const debug = debugModule('snyk');

export async function inspect(
  root: string,
  targetFile: string,
  options: types.Options = {},
): Promise<MultiProjectResult> {
  if (!targetFile) {
    throw MissingTargetFileError(root);
  }
  const isLockFileBased =
    targetFile.endsWith('package-lock.json') ||
    targetFile.endsWith('yarn.lock');

  const getLockFileDeps = isLockFileBased && !options.traverseNodeModules;
  const depTree: any = getLockFileDeps
    ? await lockParser.parse(root, targetFile, options)
    : await modulesParser.parse(root, targetFile, options);

  return {
    plugin: {
      name: 'snyk-nodejs-lockfile-parser',
      runtime: process.version,
    },
    scannedProjects: [{ depTree }],
  };
}

export async function discover(
  root: string,
  targetFiles: string[],
  options: types.Options & Options & (TestOptions | MonitorOptions),
): Promise<ScannedProjectCustom[]> {
  debug(targetFiles);

  const nodeTargetFiles: {
    [folderName: string]: path.ParsedPath[];
  } = _(targetFiles)
    .map((p) => ({ path: p, ...path.parse(p) }))
    .filter((p) => supportedTargetFiles.includes(p.base))
    .groupBy('dir')
    .value();

  const scannedProjects: ScannedProjectCustom[] = [];
  if (_.isEmpty(nodeTargetFiles)) {
    return scannedProjects;
  }

  for (const directory of Object.keys(nodeTargetFiles)) {
    const yarnLockFilePath = path.join(directory, 'yarn.lock');
    const packageJsonFilePath = path.join(directory, 'package.json');
    const packageLockFilePath = path.join(directory, 'package-lock.json');

    try {
      const [
        packageJsonFileExists,
        yarnLockFileExists,
        packageLockFileExists,
      ] = await Promise.all([
        fs.existsSync(packageJsonFilePath),
        fs.existsSync(yarnLockFilePath),
        fs.existsSync(packageLockFilePath),
      ]);

      let yarnWorkspace: false | string[] = false;
      if (yarnLockFileExists) {
        yarnWorkspace = getYarnWorkspaces(
          fs.readFileSync(yarnLockFilePath, 'utf-8'),
          );
      }

      if (packageJsonFileExists && packageLockFileExists) {
        // npm lockfile project
        const depTree = (await lockParser.parse(
          root,
          packageLockFilePath,
          options,
        )) as DepTree;
        scannedProjects.push({
          plugin: {
            name: 'snyk-nodejs-lockfile-parser',
            runtime: process.version,
          },
          packageManager: 'npm',
          depTree,
        });
      } else if (yarnWorkspace) {
        //TODO: add YWS flag?
        console.log('FOUND WS');
        console.log({yarnWorkspace});
        // First iteration should match the root of the WS;
        //
        // Now we handle WS
      } else if (packageJsonFileExists && yarnLockFileExists) {
        // yarn lockfile project
        const depTree = (await lockParser.parse(
          root,
          yarnLockFilePath,
          options,
        )) as DepTree;
        scannedProjects.push({
          plugin: {
            name: 'snyk-nodejs-lockfile-parser',
            runtime: process.version,
          },
          packageManager: 'yarn',
          depTree,
        });
      } else {
        const depTree = (await modulesParser.parse(
          root,
          packageJsonFilePath,
          options,
        )) as DepTree;
        scannedProjects.push({
          plugin: {
            name: 'snyk-nodejs-lockfile-parser',
            runtime: process.version,
          },
          packageManager: 'npm',
          depTree,
        });
      }
    } catch (error) {
      debug(
        `Failed processing folder: ${directory} while looking for node projects. Error: ${error}`,
      );
    }
  }
  return scannedProjects;
}
