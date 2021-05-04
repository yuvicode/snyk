import { join } from 'path';
import { test } from '../../../src/cli/commands';
import { loadPlugin } from '../../../src/lib/plugins/index';
import { CommandResult } from '../../../src/cli/commands/types';
import makeRequest = require('../../../src/lib/request/request');

jest.mock('../../../src/lib/plugins/index');
jest.mock('../../../src/lib/request/request');

const mockedLoadPlugin = loadPlugin as jest.Mock<any>;
const mockedMakeRequest = makeRequest as jest.Mock<any>;

describe('snyk test for python project', () => {
  describe('--all-projects flag is used to scan the project', () => {
    describe('pyproject.toml does not contain peotry metadata', () => {
      afterEach(() => {
        jest.clearAllMocks();
      });

      it('should not attempt to scan peotry vulnerabilities', async (done) => {
        const fixturePath = join(
          __dirname,
          '../../acceptance/workspaces',
          'python-w-pyproject-wo-poetry',
        );
        const plugin = {
          async inspect() {
            return {
              plugin: {
                targetFile: 'Pipfile',
                name: 'snyk-python-plugin',
                runtime: 'Python',
              },
              package: {},
            };
          },
        };
        mockedLoadPlugin.mockImplementationOnce(() => {
          return plugin;
        });
        mockedMakeRequest.mockImplementationOnce(() => {
          return {
            res: { statusCode: 200 },
            body: {
              result: { issuesData: {}, affectedPkgs: {} },
              meta: { org: 'test-org', isPublic: false },
              filesystemPolicy: false,
            },
          };
        });

        const result: CommandResult = await test(fixturePath, {
          allProjects: true,
          json: true,
        });

        const expectedResultObject = {
          vulnerabilities: [],
          ok: true,
          dependencyCount: 0,
          org: 'test-org',
          policy: undefined,
          isPrivate: true,
          licensesPolicy: null,
          packageManager: 'pip',
          projectId: undefined,
          ignoreSettings: null,
          docker: undefined,
          summary: 'No known vulnerabilities',
          severityThreshold: undefined,
          remediation: undefined,
          filesystemPolicy: false,
          uniqueCount: 0,
          targetFile: 'Pipfile',
          projectName: undefined,
          foundProjectCount: undefined,
          displayTargetFile: 'Pipfile',
          platform: undefined,
          path: fixturePath,
        };
        expect(result).toMatchObject({
          result: JSON.stringify(expectedResultObject, null, 2),
        });

        done();
      });
    });
  });
});
