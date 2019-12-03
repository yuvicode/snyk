import chalk from 'chalk';
import { CustomError } from './custom-error';

export class NoSupportedManifestsFoundError extends CustomError {
  private static ERROR_CODE = 404;
  private static ERROR_MESSAGE =
  '\nPlease see our documentation for supported languages and ' +
  'target files: ' +
  chalk.underline(
    'https://support.snyk.io/hc/en-us/articles/360000911957-Language-support',
  ) +
  ' and make sure you are in the right directory.';

  constructor(atLocations) {
    const locationsStr = atLocations.join(', ');
    const message = 'Could not detect supported target files in ' +
    locationsStr + '.' + NoSupportedManifestsFoundError.ERROR_MESSAGE;
    super('Could not detect supported target files in ' +
    locationsStr + NoSupportedManifestsFoundError.ERROR_MESSAGE);
    this.code = NoSupportedManifestsFoundError.ERROR_CODE;
    this.userMessage = message;
  }
}
