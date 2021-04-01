import * as snyk from '../index';
import * as config from '../config';
import { isCI } from '../is-ci';
import { makeRequest } from '../request/promise';
import { Options } from '../types';
// import { TestCommandResult } from '../../cli/commands/types';
import * as spinner from '../../lib/spinner';
import { EcosystemPlugin, ScanResult, TestResult } from './types';
import { TestDependenciesResponse } from '../snyk-test/legacy';
import { assembleQueryString } from '../snyk-test/common';

export async function testEcosystem(
  plugin: EcosystemPlugin,
  paths: string[],
  options: Options,
): Promise<Result[]> {
  // TODO: this is an intermediate step before consolidating ecosystem plugins
  // to accept flows that act differently in the testDependencies step
  // if (plugin.test) {
  //   const { readableResult: res } = await plugin.test(paths, options);
  //   return TestCommandResult.createHumanReadableTestCommandResult(res, '');
  // }
  const scanResultsByPath: { [dir: string]: ScanResult[] } = {};
  for (const path of paths) {
    await spinner(`Scanning dependencies in ${path}`);
    options.path = path;
    const pluginResponse = await plugin.scan(options);
    scanResultsByPath[path] = pluginResponse.scanResults;
  }
  spinner.clearAll();
  const allResults = await testDependencies(scanResultsByPath, options);
  // const { errors, testResults } = separateErrorResults(allResults);
  // const stringifiedData = JSON.stringify(testResults, null, 2);
  // if (options.json) {
  //   return TestCommandResult.createJsonTestCommandResult(stringifiedData);
  // }
  // const emptyResults: ScanResult[] = [];
  // const scanResults = emptyResults.concat(...Object.values(scanResultsByPath));
  // const readableResult = await plugin.display(
  //   scanResults,
  //   testResults,
  //   errors,
  //   options,
  // );

  // return TestCommandResult.createHumanReadableTestCommandResult(
  //   readableResult,
  //   stringifiedData,
  // );
  return allResults;
}

// function separateErrorResults(
//   results: Result[],
// ): {
//   errors: string[];
//   testResults: TestResult[];
// } {
//   const errors: string[] = [];
//   const testResults: TestResult[] = [];

//   for (const i of results) {
//     if ('error' in i) {
//       errors.push(i.error.message);
//     } else {
//       testResults.push(i.testResult);
//     }
//   }

//   return { errors, testResults };
// }
interface ResultSuccess {
  path: string;
  scanResult: ScanResult;
  testResult: TestResult;
}

interface ResultError {
  path: string;
  scanResult: ScanResult;
  error: Error;
}

export type Result = ResultError | ResultSuccess;

async function testDependencies(
  scans: {
    [dir: string]: ScanResult[];
  },
  options: Options,
): Promise<Result[]> {
  const results: Result[] = [];
  for (const [path, scanResults] of Object.entries(scans)) {
    await spinner(`Testing dependencies in ${path}`);
    for (const scanResult of scanResults) {
      const payload = {
        method: 'POST',
        url: `${config.API}/test-dependencies`,
        json: true,
        headers: {
          'x-is-ci': isCI(),
          authorization: 'token ' + snyk.api,
        },
        body: {
          scanResult,
        },
        qs: assembleQueryString(options),
      };
      try {
        const response = await makeRequest<TestDependenciesResponse>(payload);
        results.push({
          path,
          scanResult,
          testResult: {
            issues: response.result.issues,
            issuesData: response.result.issuesData,
            depGraphData: response.result.depGraphData,
          },
        });
      } catch (error) {
        if (error.code >= 400 && error.code < 500) {
          throw new Error(error.message);
        }
        results.push({
          path,
          scanResult,
          error: new Error('Could not test dependencies in ' + path),
        });
      }
    }
  }
  spinner.clearAll();
  return results;
}
