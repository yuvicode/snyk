import * as fs from 'fs';
import * as pathLib from 'path';
import * as snykFix from '../../../../src';
import {
  generateEntityToFixWithFileReadWrite,
  generateTestResult,
} from '../../../helpers/generate-entity-to-fix';

describe('fix pom.xml projects', () => {
  let filesToDelete: string[] = [];
  afterEach(() => {
    filesToDelete.map((f) => fs.unlinkSync(f));
  });
  const workspacesPath = pathLib.resolve(__dirname, 'workspaces');

  it('fixes a simple project by upgrading inline', async () => {
    // Arrange
    const targetFile = 'simple-app/pom.xml';
    filesToDelete = [pathLib.join(workspacesPath, 'simple-app/fixed-pom.xml')];

    const testResult = {
      ...generateTestResult(),
      remediation: {
        unresolved: [],
        upgrade: {
          'org.springframework:spring-core@5.0.5.RELEASE': {
            upgradeTo: 'org.springframework:spring-core@5.0.6.RELEASE',
            vulns: ['SNYK-JAVA-ORGSPRINGFRAMEWORK-31651'],
            upgrades: ['org.springframework:spring-core'],
          },
        },
        patch: {},
        ignore: {},
        pin: {},
      },
    };

    const entityToFix = generateEntityToFixWithFileReadWrite(
      workspacesPath,
      targetFile,
      testResult,
      {
        type: 'maven',
      },
    );

    // Act
    const result = await snykFix.fix([entityToFix], {
      // quiet: true,
      // stripAnsi: true,
    });
    // Assert
    expect(result).toMatchObject({
      exceptions: {},
      results: {
        maven: {
          failed: [],
          skipped: [],
          succeeded: [
            {
              original: entityToFix,
              changes: [
                {
                  success: true,
                  userMessage:
                    'Upgraded org.springframework:spring-core from 5.0.5.RELEASE to 5.0.6.RELEASE',
                },
              ],
            },
          ],
        },
      },
    });

    const expectedPom = fs.readFileSync(
      pathLib.resolve(workspacesPath, 'simple-app/expected-pom.xml'),
      'utf-8',
    );
    const fixedPom = fs.readFileSync(
      pathLib.resolve(workspacesPath, 'simple-app/fixed-pom.xml'),
      'utf-8',
    );
    expect(fixedPom).toBe(expectedPom);
  });
  it('fixes a simple project with properties in the same file by upgrading the property', async () => {
    // Arrange
    const targetFile = 'app-with-properties/pom.xml';
    filesToDelete = [pathLib.join(workspacesPath, 'app-with-properties/fixed-pom.xml')];

    const testResult = {
      ...generateTestResult(),
      remediation: {
        unresolved: [],
        upgrade: {
          'org.springframework:spring-core@5.0.5.RELEASE': {
            upgradeTo: 'org.springframework:spring-core@5.0.6.RELEASE',
            vulns: ['SNYK-JAVA-ORGSPRINGFRAMEWORK-31651'],
            upgrades: ['org.springframework:spring-core'],
          },
        },
        patch: {},
        ignore: {},
        pin: {},
      },
    };

    const entityToFix = generateEntityToFixWithFileReadWrite(
      workspacesPath,
      targetFile,
      testResult,
      {
        type: 'maven',
      },
    );

    // Act
    const result = await snykFix.fix([entityToFix], {
      // quiet: true,
      // stripAnsi: true,
    });
    // Assert
    expect(result).toMatchObject({
      exceptions: {},
      results: {
        maven: {
          failed: [],
          skipped: [],
          succeeded: [
            {
              original: entityToFix,
              changes: [
                {
                  success: true,
                  userMessage:
                    'Upgraded org.springframework:spring-core from 5.0.5.RELEASE to 5.0.6.RELEASE',
                },
              ],
            },
          ],
        },
      },
    });

    const expectedPom = fs.readFileSync(
      pathLib.resolve(workspacesPath, 'app-with-properties/expected-pom.xml'),
      'utf-8',
    );
    const fixedPom = fs.readFileSync(
      pathLib.resolve(workspacesPath, 'app-with-properties/fixed-pom.xml'),
      'utf-8',
    );
    expect(fixedPom).toBe(expectedPom);
  });
  it.todo('dependency version is coming from a property in same pom');
  it.todo('dependency version is coming from a dependencyMangement in same pom');
  it.todo('dependency version is a property outside of pom');

  // remote parent = our inline versions won't apply?

  // "adding dep management section inline in this pom" the vulnerability is in a transitive, then to fix we need to add a depManagement section and override the version

  // TODO: does it actually override anything?
  it.todo('dependency version is not set as it is coming from somewhere else'); // write the version to override it

});
