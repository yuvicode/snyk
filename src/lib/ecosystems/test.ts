import * as snyk from '../index';
import * as config from '../config';
import { isCI } from '../is-ci';
import { makeRequest } from '../request/promise';
import { Options } from '../types';
import { TestCommandResult } from '../../cli/commands/types';
import * as spinner from '../../lib/spinner';
import { Ecosystem, ScanResult } from './types';
import { getPlugin } from './plugins';
import { TestDependenciesResponse } from '../snyk-test/legacy';
import { assembleQueryString } from '../snyk-test/common';

export async function testEcosystem(
  ecosystem: Ecosystem,
  paths: string[],
  options: Options,
): Promise<TestCommandResult> {
  const plugin = getPlugin(ecosystem);
  // TODO: this is an intermediate step before consolidating ecosystem plugins
  // to accept flows that act differently in the testDependencies step
  if (plugin.test) {
    const { readableResult: res } = await plugin.test(paths, options);
    return TestCommandResult.createHumanReadableTestCommandResult(res, '');
  }
  const scanResultsByPath: { [dir: string]: ScanResult[] } = {};
  for (const path of paths) {
    await spinner(`Scanning dependencies in ${path}`);
    options.path = path;
    const pluginResponse = await plugin.scan(options);
    scanResultsByPath[path] = pluginResponse.scanResults;
  }
  spinner.clearAll();
  const testResults = await testDependencies(scanResultsByPath, options);
  const stringifiedData = JSON.stringify(testResults, null, 2);
  if (options.json) {
    return TestCommandResult.createJsonTestCommandResult(stringifiedData);
  }
  const emptyResults: ScanResult[] = [];
  const scanResults = emptyResults.concat(...Object.values(scanResultsByPath));

  const readableResult = await plugin.display(
    scanResults,
    testResults
      .filter(isGoodTestResponse)
      .map((result) => result.response.result),
    testResults.filter(isErrorTestResponse).map((result) => result.userMessage),
    options,
  );
  // snyk.fix(testResults)
  return TestCommandResult.createHumanReadableTestCommandResult(
    readableResult,
    stringifiedData,
  );
}

function isGoodTestResponse(res: TestResponse): res is TestResponseGood {
  return 'response' in res;
}

function isErrorTestResponse(res: TestResponse): res is TestResponseError {
  return 'error' in res;
}
export interface TestResponseGood {
  scanResult: ScanResult;
  response: TestDependenciesResponse;
}
interface TestResponseError {
  scanResult: ScanResult;
  error: Error;
  userMessage: string;
}

type TestResponse = TestResponseError | TestResponseGood;

async function testDependencies(
  scans: {
    [dir: string]: ScanResult[];
  },
  options: Options,
): Promise<TestResponse[]> {
  // TODO: snyk-fix
  // display() plugin boundary needs to update to couple result & test instead of 2 separate array params
  // we want to convert the new ecosystem flow to be the ideal shape for `snyk-fix` to be easily callable somewhere
  // for this we want to return each scanResult alongside it's TestResult
  // For now it is possible to use the TestResult legacy that comes out of snyk.test() and kind of
  // make scanResult & testResult shape to get started asap for Salesforce
  const results: TestResponse[] = [];
  for (const [path, scanResults] of Object.entries(scans)) {
    await spinner(`Testing dependencies in ${path}`);
    for (const scanResult of scanResults) {
      const payload = {
        method: 'POST',
        url: `${config.API}/test-dependencies`,
        json: true,
        headers: {
          'x-is-ci': isCI(),
          'authorization': 'token ' + snyk.api,
        },
        body: {
          scanResult,
        },
        qs: assembleQueryString(options),
      };
      try {
        const response = await makeRequest<TestDependenciesResponse>(payload);
        results.push({
          scanResult,
          response,
        });
      } catch (error) {
        if (error.code >= 400 && error.code < 500) {
          throw new Error(error.message);
        }
        results.push({
          scanResult,
          userMessage: 'Could not test dependencies in ' + path,
          error,
        });
      }
    }
  }
  spinner.clearAll();
  return results;
}
