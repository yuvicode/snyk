import * as debugLib from 'debug';
import * as pathLib from 'path';

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
  directUpgradesOnly: boolean,
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
    directUpgradesOnly,
  );

  if (!updatedManifest) {
    return {
      changes: [],
    };
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
      const remediationData = entity.testResult.remediation;
      const { changes } = await fixWithVersionProvenance(
        entity,
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
  entity: EntityToFix,
  remediationData: RemediationChanges,
  options: FixOptions,
): Promise<{ changes: FixChangesSummary[] }> {
  const entryTargetFile = entity.scanResult.identity.targetFile!;
  const { workspace } = entity;
  const { dir, base } = pathLib.parse(entryTargetFile);
  const provenance = await extractProvenance(workspace, dir, base);
  const allChanges: FixChangesSummary[] = [];
  for (const fileName of Object.keys(provenance)) {
    const directUpgradesOnly = true;
    // const { changes } = await fixIndividualRequirementsTxt(
    //   workspace,
    //   dir,
    //   fileName,
    //   remediationData,
    //   options,
    //   directUpgradesOnly,
    // );
    const requirementsTxt = provenance[fileName];
    // TODO: allow handlers per fix type (later also strategies or combine with strategies)
    const { updatedManifest, changes } = updateDependencies(
      requirementsTxt,
      remediationData.pin,
      directUpgradesOnly,
    );

    if (!updatedManifest) {
      return {
        changes: [],
      };
    }

    if (!options.dryRun) {
      debug('Writing changes to file');
      await workspace.writeFile(fileName, updatedManifest);
    } else {
      debug('Skipping writing changes to file in --dry-run mode');
    }
    allChanges.push(...changes);
  }

  // find the leftover pins and pin to root or constraints.
  if (allChanges.length === 0) {
    debug('Manifests have not changed!');
    throw new NoFixesCouldBeAppliedError();
  }

  return { changes: allChanges };
}
