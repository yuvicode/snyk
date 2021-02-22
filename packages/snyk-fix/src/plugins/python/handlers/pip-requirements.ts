import * as debugLib from 'debug';
import { EntityToFix, WithUserMessage } from '../../../types';
import { PluginFixResponse } from '../../types';
import { updateDependencies } from './update-dependencies';

const debug = debugLib('snyk-fix:python:requirements.txt');

export async function pipRequirementsTxt(
  entities: EntityToFix[],
): Promise<PluginFixResponse> {
  debug(`Preparing to fix ${entities.length} Python requirements.txt projects`);
  const handlerResult: PluginFixResponse = {
    succeeded: [],
    failed: [],
    skipped: [],
  };
  for (const entity of entities) {
    try {
      const isSupportedResponse = await isSupported(entity);
      if (projectTypeSupported(isSupportedResponse)) {
        const fixedEntity = await fixIndividualRequirementsTxt(entity);
        handlerResult.succeeded.push(fixedEntity);
      } else {
        handlerResult.skipped.push({
          original: entity,
          userMessage: isSupportedResponse.reason,
        });
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

  if (await containsRequireDirective(entity)) {
    return {
      supported: false,
      reason: 'Requirements with -r or -c directive are not yet supported',
    };
  }
  // TODO: test when pins are empty
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
async function containsRequireDirective(entity: EntityToFix): Promise<boolean> {
  const REQUIRE_PATTERN = /^[^\S\n]*-(r|c)\s+.+/;
  // TODO: fix the non null assertion here
  const fileName = entity.scanResult.identity.targetFile!;
  const requirementsTxt = await entity.workspace.readFile(fileName);
  const match = REQUIRE_PATTERN.exec(requirementsTxt);
  if (match && match.length > 1) {
    return true;
  }
  return false;
}

// TODO: optionally verify the deps install
export async function fixIndividualRequirementsTxt(
  entity: EntityToFix,
): Promise<WithUserMessage<EntityToFix>> {
  const fileName = entity.scanResult.identity.targetFile;
  const remediationData = entity.testResult.remediation;
  if (!remediationData) {
    throw new Error('Fixing is not available without remediation data');
  }
  if (!fileName) {
    // TODO: is this possible?
    throw new Error('Requirements file name required');
  }
  const requirementsTxt = await entity.workspace.readFile(fileName);
  // TODO: allow handlers per fix type (later also strategies or combine with strategies)
  const { updatedManifest, appliedChangesSummary } = updateDependencies(
    requirementsTxt,
    remediationData.pin,
  );
  await entity.workspace.writeFile(fileName, updatedManifest);
  // TODO: generate fixes per file + failed per file to generate clear output later
  return { original: entity, userMessage: appliedChangesSummary };
}
