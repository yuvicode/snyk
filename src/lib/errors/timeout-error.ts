import { CustomError } from './custom-error';

export class TimeoutServerError extends CustomError {
  private static ERROR_CODE = 504;
  private static ERROR_STRING_CODE = 'TIMEOUT';
  private static ERROR_MESSAGE = 'Request exceeds max duration';

  constructor(userMessage) {
    super(TimeoutServerError.ERROR_MESSAGE);
    this.code = TimeoutServerError.ERROR_CODE;
    this.strCode = TimeoutServerError.ERROR_STRING_CODE;
    this.userMessage = userMessage || TimeoutServerError.ERROR_MESSAGE;
  }
}
