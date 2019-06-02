import {CustomError} from './custom-error';

export class MissingPolicyError extends CustomError {
    private static ERROR_CODE: number = 422;
    private static ERROR_MESSAGE: string =
    'Missing policy file. Try running `snyk wizard` to define a Snyk policy';

    constructor(innerError) {
        super(MissingPolicyError.ERROR_MESSAGE);
        this.code = MissingPolicyError.ERROR_CODE;
        this.strCode = 'MISSING_DOTFILE';
        this.userMessage = MissingPolicyError.ERROR_MESSAGE;
        this.innerError = innerError;
    }
}
