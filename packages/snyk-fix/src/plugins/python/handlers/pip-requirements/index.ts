import * as debugLib from 'debug';
import * as pathLib from 'path';
import * as _ from 'lodash'; // TODO: remove

import {
  EntityToFix,
  FixOptions,
  RemediationChanges,
  WithError,
  Workspace,
  WithFixChangesApplied,
  FixChangesSummary,
} from '../../../../types';
import { PluginFixResponse } from '../../../types';
import { updateDependencies } from './update-dependencies';
import { partitionByFixable } from './is-supported';
import { NoFixesCouldBeAppliedError } from '../../../../lib/errors/no-fixes-applied';
import { parseRequirementsFile } from './update-dependencies/requirements-file-parser';
import { extractProvenance } from './extract-version-provenance';

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
  workspace: Workspace,
  dir: string,
  base: string,
  remediationData: RemediationChanges,
  options: FixOptions,
): Promise<{ changes: FixChangesSummary[] }> {
  const fileName = pathLib.join(dir, base);
  // const fileName = entity.scanResult.identity.targetFile;
  // const remediationData = entity.testResult.remediation;
  // if (!remediationData) {
  //   throw new MissingRemediationDataError();
  // }
  // if (!fileName) {
  //   throw new MissingFileNameError();
  // }
  // const requirementsTxt = await entity.workspace.readFile(fileName);
  const requirementsTxt = await workspace.readFile(fileName);
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
    await workspace.writeFile(fileName, updatedManifest);
  } else {
    debug('Skipping writing changes to file in --dry-run mode');
  }

  return { changes };
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
      const { dir, base } = pathLib.parse(
        entity.scanResult.identity.targetFile!,
      );
      const remediationData = entity.testResult.remediation;
      const { changes } = await fixWithVersionProvenance(
        entity.workspace,
        dir,
        base,
        remediationData!,
        options,
      );
      succeeded.push({ original: entity, changes });
    } catch (e) {
      failed.push({ original: entity, error: e });
    }
  }
  return { failed, succeeded };
}

async function fixWithVersionProvenance(
  workspace: Workspace,
  dir: string,
  base: string,
  remediationData: RemediationChanges,
  options: FixOptions,
): Promise<{ changes: FixChangesSummary[] }> {
  const provenance = await extractProvenance(workspace, dir, base);
  const allChanges: FixChangesSummary[] = [];
  for (const fileName of Object.keys(provenance)) {
    const { changes } = await fixIndividualRequirementsTxt(
      workspace,
      dir,
      fileName,
      remediationData,
      options,
    );
    allChanges.push(...changes);
  }

  return { changes: allChanges };
}
