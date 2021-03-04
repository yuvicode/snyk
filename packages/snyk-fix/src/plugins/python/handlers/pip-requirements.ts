import * as debugLib from 'debug';
import * as path from 'path';
import * as _ from 'lodash';

import {
  EntityToFix,
  FixChangesSummary,
  FixOptions,
  WithError,
  WithFixChangesApplied,
  WithUserMessage,
} from '../../../types';
import { PluginFixResponse } from '../../types';
import {
  updateDependencies,
  updateDependenciesMulti,
} from './update-dependencies';
import { MissingRemediationDataError } from '../../../lib/errors/missing-remediation-data';
import { MissingFileNameError } from '../../../lib/errors/missing-file-name';
import {
  parseRequirementsFile,
  Requirement,
} from './update-dependencies/requirements-file-parser';

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

  const { failed, succeeded } = await fixWithVersionProvenance(fixableEntities);

  handlerResult.succeeded.push(...succeeded);
  handlerResult.failed.push(...failed);

  // for all supported entities
  // filter out the ones that contain -r -c
  // also filter out the ones that are referenced
  // then process 1 by 1

  // for (const entity of individual) {
  //   try {
  //     const isSupportedResponse = await isSupported(entity);
  //     if (projectTypeSupported(isSupportedResponse)) {
  //       const fixedEntity = await fixIndividualRequirementsTxt(entity, options);
  //       handlerResult.succeeded.push(fixedEntity);
  //     }
  //   } catch (e) {
  //     handlerResult.failed.push({ original: entity, error: e });
  //   }
  // }
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
  // const fileName = entity.scanResult.identity.targetFile!;
  // const requirementsTxt = await entity.workspace.readFile(fileName);
  // const { containsRequire } = await containsRequireDirective(requirementsTxt);

  const fileName = entity.scanResult.identity.targetFile;
  if (!fileName) {
    return { supported: false, reason: new MissingFileNameError().message };
  }

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

async function fixWithVersionProvenance(
  entities: EntityToFix[],
): Promise<{
  grouped: EntityToFix[];
  individual: EntityToFix[];
  failed: Array<WithError<EntityToFix>>;
  succeeded: Array<WithFixChangesApplied<EntityToFix>>;
}> {
  const failed: Array<WithError<EntityToFix>> = [];
  const succeeded: Array<WithFixChangesApplied<EntityToFix>> = [];
  const sorted: {
    [dir: string]: Array<{
      path: string | undefined;
      base: string;
      dir: string;
      entity: EntityToFix;
    }>;
  } = _(entities)
    .map((e) => ({
      path: e.scanResult.identity.targetFile,
      ...path.parse(e.scanResult.identity.targetFile!),
      entity: e,
    }))
    .sortBy('dir')
    .uniqBy('dir') // important to process each folder only once
    .groupBy('dir')
    .value();
  for (const directory of Object.keys(sorted)) {
    for (const data of sorted[directory]) {
      const entity = data.entity;

      try {
        // const requirementsTxt = await entity.workspace.readFile(
        //   path.join(data.dir, data.base!),
        // );
        // const hasRequireDirective = await containsRequireDirective(
        //   requirementsTxt,
        // );

        const provenance = await getProvenance(
          entity.workspace,
          data.dir,
          data.base,
        );
        const changes: FixChangesSummary[] = [];

        for (const fileName of Object.keys(provenance)) {
          const relativeFilePath = path.join(data.dir, fileName);
          const requirementsTxt = await entity.workspace.readFile(
            relativeFilePath,
          );
          const parsedRequirementsData = parseRequirementsFile(requirementsTxt);
          const remediationData = entity.testResult.remediation;

          const res = updateDependenciesMulti(
            parsedRequirementsData,
            remediationData?.pin!,
          );
          // This is a bit of a hack, but an easy one to follow. If a file ends with a
          // new line, ensure we keep it this way. Don't hijack customers formatting.
          if (requirementsTxt.endsWith('\n')) {
            res.updatedManifest += '\n';
          }
          // if (!options.dryRun) {
          await entity.workspace.writeFile(
            relativeFilePath,
            res.updatedManifest,
          );

          if (res.updatedManifest === requirementsTxt) {
            continue;
            // TODO:
            // throw new NoFixesCouldBeApplied();
          }
          // }
          changes.push(
            ...res.changes.map((c) => ({
              ...c,
              userMessage: c.userMessage + ` (updated in ${fileName})`,
            })),
          );
          console.log(res);
        }
        succeeded.push({
          original: entity,
          changes,
        });
        // if (updatedManifest === requirementsTxt) {
        //   // TODO:
        //   // throw new NoFixesCouldBeApplied();
        // }

        // TODO:
        // attach provenance ot each entity
        // group entities that are referenced in provenance to fix together?

        console.log(JSON.stringify(provenance));
      } catch (e) {
        failed.push({ original: entity, error: e });
      }
    }
  }
  return { grouped: entities, individual: entities, failed, succeeded };
}

interface PythonProvenance {
  [fileName: string]: Requirement[];
}
async function getProvenance(
  workspace,
  dir,
  base,
  provenance: PythonProvenance = {},
): Promise<PythonProvenance> {
  console.log('processing ', base);
  const requirementsTxt = await workspace.readFile(path.join(dir, base));
  provenance = {
    ...provenance,
    [base]: parseRequirementsFile(requirementsTxt),
  };
  const { containsRequire, matches } = await containsRequireDirective(
    requirementsTxt,
  );
  console.log(containsRequire);
  if (containsRequire) {
    for (const match of matches) {
      const filePath = match[2];
      provenance = {
        ...provenance,
        ...(await getProvenance(workspace, dir, filePath, provenance)),
      };
    }
  }
  return provenance;
}
