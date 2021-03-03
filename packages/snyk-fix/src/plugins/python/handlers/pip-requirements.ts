import * as debugLib from 'debug';
import * as path from 'path';

import {
  EntityToFix,
  FixOptions,
  WithError,
  WithFixChangesApplied,
} from '../../../types';
import { PluginFixResponse } from '../../types';
import { updateDependencies } from './update-dependencies';
import { MissingRemediationDataError } from '../../../lib/errors/missing-remediation-data';
import { MissingFileNameError } from '../../../lib/errors/missing-file-name';

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
  // TODO:
  // find related files
  // process related first
  // process the rest 1 by 1

  const fixableEntities = entities.filter(async (entity) => {
    const isSupportedResponse = await isSupported(entity);
    if (!projectTypeSupported(isSupportedResponse)) {
      handlerResult.skipped.push({
        original: entity,
        userMessage: isSupportedResponse.reason,
      });
      return false;
    }
    return true;
  });

  const { individual, failed } = await detectRelatedEntities(fixableEntities);
  handlerResult.failed.push(...failed);

  // for all supported entities
  // filter out the ones that contain -r -c
  // also filter out the ones that are referenced
  // then process 1 by 1

  for (const entity of individual) {
    try {
      const isSupportedResponse = await isSupported(entity);
      if (projectTypeSupported(isSupportedResponse)) {
        const fixedEntity = await fixIndividualRequirementsTxt(entity, options);
        handlerResult.succeeded.push(fixedEntity);
      }
    } catch (e) {
      handlerResult.failed.push({ original: entity, error: e });
    }
  }
  return handlerResult;
}

function projectTypeSupported(res: Supported | NotSupported): res is Supported {
  return !('reason' in res);
}

interface Supported {
  supported: true;
}

interface NotSupported {
  supported: false;
  reason: string;
}
export async function isSupported(
  entity: EntityToFix,
): Promise<Supported | NotSupported> {
  const remediationData = entity.testResult.remediation;
  if (!remediationData) {
    return { supported: false, reason: 'No remediation data available' };
  }
  // TODO: recursive inclusions?
  // TODO: fix the non null assertion here
  const fileName = entity.scanResult.identity.targetFile!;
  const requirementsTxt = await entity.workspace.readFile(fileName);
  // const { containsRequire } = await containsRequireDirective(requirementsTxt);

  // if (await containsRequireDirective(entity)) {
  //   return {
  //     supported: false,
  //     reason: `Requirements with ${chalk.bold('-r')} or ${chalk.bold(
  //       '-c',
  //     )} directive are not yet supported`,
  //   };
  // }

  if (!remediationData.pin || Object.keys(remediationData.pin).length === 0) {
    return {
      supported: false,
      reason: 'There is no actionable remediation to apply',
    };
  }
  return { supported: true };
}

/* Requires like -r, -c are not supported at the moment, as multiple files
 * would have to be identified and fixed together
 * https://pip.pypa.io/en/stable/reference/pip_install/#options
 */
export async function containsRequireDirective(
  requirementsTxt: string,
): Promise<{ containsRequire: boolean; matches: RegExpMatchArray[] }> {
  const allMatches: RegExpMatchArray[] = [];
  const REQUIRE_PATTERN = new RegExp(/^[^\S\n]*-(r|c)\s+(.+)/, 'gm');
  const matches = requirementsTxt.matchAll(REQUIRE_PATTERN);
  for (const match of matches) {
    if (match && match.length > 1) {
      allMatches.push(match);
    }
  }
  return { containsRequire: allMatches.length > 0, matches: allMatches };
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
  // TODO: allow handlers per fix type (later also strategies or combine with strategies)
  const { updatedManifest, changes } = updateDependencies(
    requirementsTxt,
    remediationData.pin,
  );
  if (!options.dryRun) {
    await entity.workspace.writeFile(fileName, updatedManifest);
  }

  return {
    original: entity,
    changes,
  };
}

async function detectRelatedEntities(
  entities: EntityToFix[],
): Promise<{
  grouped: EntityToFix[];
  individual: EntityToFix[];
  failed: Array<WithError<EntityToFix>>;
}> {
  const failed: Array<WithError<EntityToFix>> = [];
  for (const entity of entities) {
    try {
      const fileName = entity.scanResult.identity.targetFile!;
      const requirementsTxt = await entity.workspace.readFile(fileName);
      const { containsRequire, matches } = await containsRequireDirective(
        requirementsTxt,
      );

      if (containsRequire) {
        for (const match of matches) {
          const requiredFilePath = match[2];
          const { dir } = path.parse(fileName);
          const requiredFileContent = await entity.workspace.readFile(
            path.join(dir, requiredFilePath),
          );
          console.log(requiredFileContent);
        }
      }
    } catch (e) {
      failed.push({ original: entity, error: e });
    }
  }
  return { grouped: entities, individual: entities, failed };
}

async function extractVersionProvenance(entity) {
  const hasRequireDirective = await containsRequireDirective(entity);
  if (hasRequireDirective) {
    const requiredFilePath = hasRequireDirective[2];
    const { dir } = path.parse(entity.scanResult.identity.targetFile!);
    const requiredFileContent = await entity.workspace.readFile(
      path.join(dir, requiredFilePath),
    );
  }
}
