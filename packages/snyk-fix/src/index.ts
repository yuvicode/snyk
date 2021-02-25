import * as debugLib from 'debug';
import * as pMap from 'p-map';
import * as ora from 'ora';
import chalk from 'chalk';

import { showResultsSummary } from './lib/output-formatters/show-results-summary';
import { loadPlugin } from './plugins/load-plugin';
import { FixHandlerResultByPlugin } from './plugins/types';

import { EntityToFix } from './types';

const debug = debugLib('snyk-fix:main');

export async function fix(
  entities: EntityToFix[],
): Promise<{
  resultsByPlugin: FixHandlerResultByPlugin;
  exceptionsByScanType: { [ecosystem: string]: Error[] };
}> {
  const spinner = ora().start();
  spinner.info(`Attempting to auto fix ${entities.length} projects`);
  let resultsByPlugin: FixHandlerResultByPlugin = {};
  const entitiesPerType = groupEntitiesPerScanType(entities);
  const exceptionsByScanType: { [ecosystem: string]: Error[] } = {};
  await pMap(
    Object.keys(entitiesPerType),
    async (scanType) => {
      try {
        const fixPlugin = loadPlugin(scanType);
        const results = await fixPlugin(entitiesPerType[scanType]);
        resultsByPlugin = { ...resultsByPlugin, ...results };
      } catch (e) {
        debug(`Failed to processes ${scanType}`, e);
        if (!exceptionsByScanType[scanType]) {
          exceptionsByScanType[scanType] = [e.message];
        } else {
          exceptionsByScanType[scanType].push(e.message);
        }
      }
    },
    {
      concurrency: 3,
    },
  );
  const fixSummary = await showResultsSummary(
    resultsByPlugin,
    exceptionsByScanType,
  );
  spinner.stopAndPersist({ text: 'Done', symbol: chalk.green('✔') });
  spinner.stopAndPersist({ text: `\n\n${fixSummary}` });
  return { resultsByPlugin, exceptionsByScanType };
}

export function groupEntitiesPerScanType(
  entities: EntityToFix[],
): {
  [type: string]: EntityToFix[];
} {
  const entitiesPerType: {
    [type: string]: EntityToFix[];
  } = {};
  for (const entity of entities) {
    const type = entity.scanResult?.identity?.type || 'missing-type';
    if (entitiesPerType[type]) {
      entitiesPerType[type].push(entity);
      continue;
    }
    entitiesPerType[type] = [entity];
  }
  return entitiesPerType;
}
