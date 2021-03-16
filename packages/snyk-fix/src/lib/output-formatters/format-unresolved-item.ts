import * as chalk from 'chalk';
import { EntityToFix } from '../../types';
import { generateEntityDisplayName } from './generate-entity-display-name';
import { PADDING_SPACE } from './show-results-summary';

export function formatUnresolved(
  entity: EntityToFix,
  userMessage: string,
): string {
  const displayName = generateEntityDisplayName(entity);
  return `${PADDING_SPACE}${displayName}\n${PADDING_SPACE}${chalk.red(
    '✖',
  )} ${chalk.red(userMessage)}`;
}
