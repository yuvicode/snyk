import chalk from 'chalk';

import { EntityToFix, FixChangesSummary } from '../../types';
import { PADDING_SPACE } from './show-results-summary';

/*
 * Generate formatted output that describes what changes were applied, which failed.
 */
export function formatChangesSummary(
  entity: EntityToFix,
  changes: FixChangesSummary[],
): string {
  return `${entity.scanResult.identity.targetFile}:\n${changes.map((c) =>
    formatAppliedChange(c),
  )}`;
}

// TODO:
// write test for these
// Update existing tests once it looks nice
// Post screenshot for feedback
// chase up the initial PR
// write tests for CLI converter to new flavour
function formatAppliedChange(change: FixChangesSummary): string | null {
  if (change.success === true) {
    return `${PADDING_SPACE.repeat(2)}${chalk.green('✔')} ${change.userMessage}`;
  }
  if (change.success === false) {
    return `${PADDING_SPACE.repeat(2)}${chalk.red('x')} ${change.userMessage}${
      change.retryInstructions
        ? `.\nYou can manually re-try:\`${change.retryInstructions}\``
        : undefined
    }`;
  }
  // not supported
  return null;
}
