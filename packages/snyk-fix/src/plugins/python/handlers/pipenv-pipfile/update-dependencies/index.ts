import * as debugLib from 'debug';
import { EntityToFix, FixOptions } from '../../../../../types';
import { PluginFixResponse } from '../../../../types';

const debug = debugLib('snyk-fix:python:Pipfile');

export async function updateDependencies(
  entity: EntityToFix,
  options: FixOptions,
): Promise<PluginFixResponse> {
  const handlerResult: PluginFixResponse = {
    succeeded: [],
    failed: [],
    skipped: [],
  };
  debug(`Fixing ${entity.scanResult.identity.targetFile}.`, options);
  try {
    throw new Error('Not implemented');
  } catch (error) {
    debug(
      `Failed to fix ${entity.scanResult.identity.targetFile}.\nERROR: ${error}`,
    );
    handlerResult.failed.push({
      original: entity,
      error,
    });
  }
  return handlerResult;
}
