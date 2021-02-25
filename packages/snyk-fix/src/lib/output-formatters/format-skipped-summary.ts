import chalk from 'chalk';
import { EntityToFix } from '../../types';
import { PADDING_SPACE } from './show-results-summary';

export function formatSkipped(
  entity: EntityToFix,
  userMessage: string,
): string {
  return `${entity.scanResult.identity.targetFile}:\n${PADDING_SPACE.repeat(
    2,
  )}${chalk.red('✖')} ${userMessage}`;
}
