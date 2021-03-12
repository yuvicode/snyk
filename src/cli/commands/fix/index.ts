export = fix;

import * as Debug from 'debug';
import * as snykFix from '@snyk/fix';
import * as ora from 'ora';

import { MethodArgs } from '../../args';
import * as snyk from '../../../lib';
import { TestResult } from '../../../lib/snyk-test/legacy';
import * as analytics from '../../../lib/analytics';

import { convertLegacyTestResultToFixEntities } from './convert-legacy-tests-results-to-fix-entities';
import { formatTestError } from '../test/format-test-error';
import { processCommandArgs } from '../process-command-args';
import { validateCredentials } from '../test/validate-credentials';
import { validateTestOptions } from '../test/validate-test-options';
import { setDefaultTestOptions } from '../test/set-default-test-options';
import { SupportedCliCommands } from '../../../lib/types';
import { CustomError } from '../../../lib/errors';
import { validateFixCommandIsSupported } from './validate-fix-command-is-supported';

const debug = Debug('snyk-fix');
const snykFixFeatureFlag = 'cliSnykFix';

enum FIX_EXIT_CODES {
  NONE_FIXED = 1,
  ERROR = 2,
  SOME_FIXED = 0,
}

async function fix(...args: MethodArgs): Promise<void> {
  const { options: rawOptions, paths } = await processCommandArgs(...args);
  const options = setDefaultTestOptions(rawOptions);
  const stdErrSpinner = ora({ isSilent: options.quiet });

  try {
    await validateFixCommandIsSupported(options);
    validateTestOptions(options);
    validateCredentials(options);
  } catch (e) {
    stdErrSpinner.fail(e.userMessage || e.message);
    setFixAnalyticsError(e);
    exitCommand(FIX_EXIT_CODES.ERROR);
  }
  // fix
  debug(
    `Organization has ${snykFixFeatureFlag} feature flag enabled for experimental Snyk fix functionality`,
  );

  const results: snykFix.EntityToFix[] = [];
  try {
    // TODO: this should be eventually calling testEcosystem(ecosystem, paths, options);
    results.push(...(await runSnykTestLegacy(options, paths)));
  } catch (e) {
    stdErrSpinner.fail(e.userMessage || e.message);
    // TODO: add a test for this flow
    setFixAnalyticsError(e);
    exitCommand(FIX_EXIT_CODES.NONE_FIXED);
  }

  // plugin produces the result output
  const { meta } = await snykFix.fix(results);

  sendFixAnalytics(options, meta);

  if (meta.fixed === 0) {
    exitCommand(FIX_EXIT_CODES.NONE_FIXED);
  }
  exitCommand(FIX_EXIT_CODES.SOME_FIXED);
}

/* @deprecated
 * TODO: once project envelope is default all code below will be deleted
 * we should be calling test via new Ecosystems instead
 */
async function runSnykTestLegacy(
  options,
  paths,
): Promise<snykFix.EntityToFix[]> {
  const results: snykFix.EntityToFix[] = [];
  for (const path of paths) {
    // Create a copy of the options so a specific test can
    // modify them i.e. add `options.file` etc. We'll need
    // these options later.
    const snykTestOptions = {
      ...options,
      path,
      projectName: options['project-name'],
    };

    let testResults: TestResult | TestResult[];

    try {
      testResults = await snyk.test(path, snykTestOptions);
    } catch (error) {
      const testError = formatTestError(error);
      throw testError;
    }
    const resArray = Array.isArray(testResults) ? testResults : [testResults];
    const newRes = convertLegacyTestResultToFixEntities(resArray, path);
    results.push(...newRes);
  }
  return results;
}

async function sendFixAnalytics(
  options,
  meta: {
    failed: number;
    fixed: number;
  },
): Promise<void> {
  analytics.add('fixed', meta.fixed);
  analytics.add('failed', meta.failed);

  analytics.addDataAndSend({
    args: options._,
    command: SupportedCliCommands.fix,
    org: options.org,
  });
}

async function setFixAnalyticsError(error: Error | CustomError) {
  analytics.add('error-message', error.message);
  analytics.add('command', SupportedCliCommands.fix);
  analytics.add('error', error.stack);
  if (error instanceof CustomError) {
    analytics.add('error-user-message', error.userMessage);
    analytics.add('error-code', error.code);
  }
}

function exitCommand(exitCode) {
  debug(`Exiting with code: ${exitCommand}`);
  process.exit(exitCode);
}
