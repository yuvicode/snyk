import {CustomError} from './custom-error';

export class PackageNotFoundError extends CustomError {
    private static ERROR_CODE: number = 404;
    private static ERROR_STRING_CODE: string = 'PACKAGE_NOT_FOUND';
    private static ERROR_MESSAGE: string = 'Failed to get vulns for package.';

    constructor() {
        super(PackageNotFoundError.ERROR_MESSAGE);
        this.code = PackageNotFoundError.ERROR_CODE;
        this.strCode = PackageNotFoundError.ERROR_STRING_CODE;
        this.userMessage = 'Failed to get vulnerabilities. Are you sure this is a package?';
    }
}
