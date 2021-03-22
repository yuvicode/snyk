import * as debugLib from 'debug';
import * as pathLib from 'path';
import * as _ from 'lodash'; // TODO: remove

import {
  EntityToFix,
  FixOptions,
  WithError,
  WithFixChangesApplied,
} from '../../../../types';
import { PluginFixResponse } from '../../../types';
import { updateDependencies } from './update-dependencies';
import { MissingRemediationDataError } from '../../../../lib/errors/missing-remediation-data';
import { MissingFileNameError } from '../../../../lib/errors/missing-file-name';
import { partitionByFixable } from './is-supported';
import { NoFixesCouldBeAppliedError } from '../../../../lib/errors/no-fixes-applied';
import { parseRequirementsFile } from './update-dependencies/requirements-file-parser';

const debug = debugLib('snyk-fix:python:requirements.txt');

export async function pipRequirementsTxt(
  entities: EntityToFix[],
  options: FixOptions,
): Promise<PluginFixResponse> {
  debug(`Preparing to fix ${entities.length} Python requirements.txt projects`);
  const handlerResult: PluginFixResponse = {
    succeeded: [],
    failed: [],
    skipped: [],
  };

  const { fixable, skipped } = await partitionByFixable(entities);
  handlerResult.skipped.push(...skipped);

  const { failed, succeeded } = await fixAll(fixable, options);

  handlerResult.failed.push(...failed);
  handlerResult.succeeded.push(...succeeded);

  return handlerResult;
}

// TODO: optionally verify the deps install
export async function fixIndividualRequirementsTxt(
  entity: EntityToFix,
  options: FixOptions,
): Promise<WithFixChangesApplied<EntityToFix>> {
  const fileName = entity.scanResult.identity.targetFile;
  const remediationData = entity.testResult.remediation;
  if (!remediationData) {
    throw new MissingRemediationDataError();
  }
  if (!fileName) {
    throw new MissingFileNameError();
  }
  const requirementsTxt = await entity.workspace.readFile(fileName);
  const requirementsData = parseRequirementsFile(requirementsTxt);

  // TODO: allow handlers per fix type (later also strategies or combine with strategies)
  const { updatedManifest, changes } = updateDependencies(
    requirementsData,
    remediationData.pin,
  );

  // TODO: do this with the changes now that we only return new
  if (updatedManifest === requirementsTxt) {
    debug('Manifest has not changed!');
    throw new NoFixesCouldBeAppliedError();
  }
  if (!options.dryRun) {
    debug('Writing changes to file');
    await entity.workspace.writeFile(fileName, updatedManifest);
  } else {
    debug('Skipping writing changes to file in --dry-run mode');
  }

  return {
    original: entity,
    changes,
  };
}

export async function fixAll(
  entities: EntityToFix[],
  options: FixOptions,
): Promise<{
  failed: Array<WithError<EntityToFix>>;
  succeeded: Array<WithFixChangesApplied<EntityToFix>>;
}> {
  const failed: Array<WithError<EntityToFix>> = [];
  const succeeded: Array<WithFixChangesApplied<EntityToFix>> = [];
  for (const entity of entities) {
    try {
      const fixedEntity = await fixIndividualRequirementsTxt(entity, options);
      succeeded.push(fixedEntity);
    } catch (e) {
      failed.push({ original: entity, error: e });
    }
  }
  return { failed, succeeded };
}
