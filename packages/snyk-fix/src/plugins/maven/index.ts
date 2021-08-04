import * as debugLib from 'debug';
import * as ora from 'ora';

const debug = debugLib('snyk-fix:maven');

import { EntityToFix, FixOptions } from '../../types';
import { FixHandlerResultByPlugin } from '../types';
import { updateDependencies } from './update-dependencies';

export async function mavenFix(
  fixable: EntityToFix[],
  options: FixOptions,
): Promise<FixHandlerResultByPlugin> {
  debug(`Preparing to fix ${fixable.length} Java Maven projects`);
  const handlerResult: FixHandlerResultByPlugin = {
    maven: {
      succeeded: [],
      failed: [],
      skipped: [],
    }
  };

  for (const [index, entity] of fixable.entries()) {
    const spinner = ora({ isSilent: options.quiet, stream: process.stdout });
    const spinnerMessage = `Fixing pom.xml ${index + 1}/${fixable.length}`;
    spinner.text = spinnerMessage;
    spinner.start();

    const { failed, succeeded, skipped } = await updateDependencies(
      entity,
      options,
    );
    handlerResult.maven.succeeded.push(...succeeded);
    handlerResult.maven.failed.push(...failed);
    handlerResult.maven.skipped.push(...skipped);
    spinner.stop();
  }

  return handlerResult;
}
