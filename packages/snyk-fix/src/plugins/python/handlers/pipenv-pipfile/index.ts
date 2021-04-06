import * as debugLib from 'debug';
import { EntityToFix, FixOptions } from '../../../../types';
import { PluginFixResponse } from '../../../types';
import { execute, ExecuteResponse } from '../sub-process';
import { updateDependencies } from './update-dependencies';

const debug = debugLib('snyk-fix:python:Pipfile');

export async function pipenvPipfile(
  fixable: EntityToFix[],
  options: FixOptions,
): Promise<PluginFixResponse> {
  debug(`Preparing to fix ${fixable.length} Python Pipfile projects`);
  const handlerResult: PluginFixResponse = {
    succeeded: [],
    failed: [],
    skipped: [],
  };
  await checkPipenvInstalled();

  for (const entity of fixable) {
    const { failed, succeeded, skipped } = await updateDependencies(
      entity,
      options,
    );
    handlerResult.succeeded.push(...succeeded);
    handlerResult.failed.push(...failed);
    handlerResult.skipped.push(...skipped);
  }

  return handlerResult;
}

async function checkPipenvInstalled(): Promise<{ version: string }> {
  let res: ExecuteResponse;
  try {
    res = await execute('pipenv', ['--version'], {});
  } catch (e) {
    debug('Execute failed with', e);
    res = e;
  }
  if (res.exitCode !== 0) {
    throw res.error;
  }
  console.log(res);
  extractPipenvVersion(res.stdout);

  return { version:  ''};
}

function extractPipenvVersion(stdout: string) {
  // stdout example: pipenv, version 2018.11.26\n
  const match = stdout.match(/^pipenv,\sversion\s([0-9.]+)/g);
  console.log(match);
}
