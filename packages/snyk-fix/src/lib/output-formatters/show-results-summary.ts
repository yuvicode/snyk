import chalk from 'chalk';

import { FixHandlerResultByPlugin } from '../../plugins/types';
import { formatChangesSummary } from './format-processed-summary';
import { formatSkipped } from './format-skipped-summary';
export const PADDING_SPACE = '  '; // 2 spaces

export async function showResultsSummary(
  resultsByPlugin: FixHandlerResultByPlugin,
  exceptionsByScanType: { [ecosystem: string]: Error[] },
): Promise<string> {
  let summarySuccessMessage = `${chalk.bold(
    'Following files had fixes applied',
  )}\n`;
  let summaryErrorsMessage = '';
  let summarySkippedMessage = `${chalk.bold(
    'These did not have any fixes applied as they are not currently supported by',
  )} ${chalk.bold(chalk.cyanBright('`snyk fix`'))}\n`;
  let containsFixed = false;
  let containsSkipped = false;

  for (const plugin of Object.keys(resultsByPlugin)) {
    const fixedSuccessfully = resultsByPlugin[plugin].succeeded;
    const skipped = resultsByPlugin[plugin].skipped;

    if (fixedSuccessfully.length > 0) {
      containsFixed = true;
      summarySuccessMessage += fixedSuccessfully
        .map(
          (s, index) =>
            `${PADDING_SPACE}${index + 1}. ${formatChangesSummary(
              s.original,
              s.changes,
            )}`,
        )
        .join('\n');
    }
    if (skipped.length > 0) {
      containsSkipped = true;
      summarySkippedMessage += `${resultsByPlugin[plugin].skipped
        .map(
          (s, index) =>
            `${PADDING_SPACE}${index + 1}. ${formatSkipped(
              s.original,
              s.userMessage,
            )}`,
        )
        .join('\n')}`;
    }
  }

  if (Object.keys(exceptionsByScanType).length) {
    for (const ecosystem of Object.keys(exceptionsByScanType)) {
      summaryErrorsMessage += `These ${ecosystem} files were not updated as there was an error:\n ${exceptionsByScanType[
        ecosystem
      ]
        .map((s, index) => `${PADDING_SPACE}${index + 1}. ${s.message}`)
        .join('\n')}\n`;
    }
  }
  const result = `${containsFixed ? `${summarySuccessMessage}\n\n` : ''}${
    containsSkipped ? `${summarySkippedMessage}\n\n` : ''
  }${summaryErrorsMessage}`;
  return result;
}
