import * as debugLib from 'debug';
import * as pMap from 'p-map';
import * as micromatch from 'micromatch';
import * as ora from 'ora';

import { EntityToFix, FixOptions, WithUserMessage } from '../../types';
import { FixHandlerResultByPlugin } from '../types';
import { loadHandler } from './load-handler';
import { SUPPORTED_HANDLER_TYPES } from './supported-handler-types';

const debug = debugLib('snyk-fix:python');

export async function pythonFix(
  entities: EntityToFix[],
  options: FixOptions,
): Promise<FixHandlerResultByPlugin> {
  const spinner = ora({ isSilent: options.quiet, stream: process.stdout });
  spinner.text = 'Looking for supported Python items';
  spinner.start();

  const handlerResult: FixHandlerResultByPlugin = {
    python: {
      succeeded: [],
      failed: [],
      skipped: [],
    },
  };
  const results = handlerResult.python;
  const entitiesPerType = mapEntitiesPerHandlerType(entities);
  await pMap(
    Object.keys(entitiesPerType),
    async (projectType) => {
      const projectsToFix: EntityToFix[] = entitiesPerType[projectType];

      spinner.text = `Processing ${projectsToFix.length} ${projectType} items.`;
      spinner.render();

      try {
        const handler = loadHandler(projectType as SUPPORTED_HANDLER_TYPES);
        const { failed, skipped, succeeded } = await handler(
          projectsToFix,
          options,
        );
        results.failed.push(...failed);
        results.skipped.push(...skipped);
        results.succeeded.push(...succeeded);
      } catch (e) {
        debug(
          `Failed to fix ${projectsToFix.length} ${projectType} projects.\nError: ${e.message}`,
        );
        results.failed.push(
          ...projectsToFix.map((p) => ({ original: p, error: e })),
        );
      }
    },
    {
      concurrency: 5,
    },
  );
  spinner.succeed();
  return handlerResult;
}

export function isRequirementsTxtManifest(targetFile: string): boolean {
  return micromatch.isMatch(
    targetFile,
    // micromatch needs **/* to match filenames that may include folders
    ['*.txt'].map(
      (f) => '**/' + f,
    ),
  );
}

export function getHandlerType(
  entity: EntityToFix,
): SUPPORTED_HANDLER_TYPES | null {
  const targetFile = entity.scanResult.identity.targetFile;
  if (!targetFile) {
    return null;
  }
  const isRequirementsTxt = isRequirementsTxtManifest(targetFile);
  if (isRequirementsTxt) {
    return SUPPORTED_HANDLER_TYPES.REQUIREMENTS;
  }
  return null;
}

function mapEntitiesPerHandlerType(
  entities: EntityToFix[],
): {
  skipped: Array<WithUserMessage<EntityToFix>>;
  entitiesPerHandlerType: {
    [projectType in SUPPORTED_HANDLER_TYPES]: EntityToFix[];
  };
} {
  const entitiesPerHandlerType: {
    [projectType in SUPPORTED_HANDLER_TYPES]: EntityToFix[];
  } = {
    [SUPPORTED_HANDLER_TYPES.REQUIREMENTS]: [],
  };
  const skipped: Array<WithUserMessage<EntityToFix>> = [];
  for (const entity of entities) {
    const type = getHandlerType(entity);
    if (type) {
      entitiesPerHandlerType[type].push(entity);
      continue;
    }
    const userMessage = `${entity.scanResult.identity.targetFile} is not supported`;
    debug(userMessage);
    skipped.push({ original: entity, userMessage });
  }
  return { entitiesPerHandlerType, skipped };
}
