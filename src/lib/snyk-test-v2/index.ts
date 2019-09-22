import { runTest } from './run-test';
import chalk from 'chalk';
import { TestOptions } from '../types';
import { LegacyVulnApiResult } from './legacy';

export async function test(root: string, targetFiles: string[], options: TestOptions): Promise<LegacyVulnApiResult[]> {
  try {
    return await runTest(root, targetFiles, options);
  } catch (error) {
    return Promise.reject(chalk.red.bold(error));
  }
}
