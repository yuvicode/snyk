import { join } from 'path';
import { fakeServer } from '../../acceptance/fake-server';
import { test } from '../../../src/cli/commands';
import { loadPlugin } from '../../../src/lib/plugins/index';
import { CommandResult } from '../../../src/cli/commands/types';

jest.mock('../../../src/lib/plugins/index');

const apiKey = '123456789';
const port = process.env.PORT || process.env.SNYK_PORT || '12345';

const BASE_API = '/api/v1';
const SNYK_API = 'http://localhost:' + port + BASE_API;
const SNYK_HOST = 'http://localhost:' + port;
const server = fakeServer(BASE_API, apiKey);

const mockedLoadPlugin = loadPlugin as jest.Mock<any>;

describe('snyk test for python project', () => {
  beforeAll(async () => {
    await new Promise((resolve) => {
      server.listen(port, resolve);
    });
  });

  afterAll(async () => {
    await server.close();
  });

  describe('--all-projects flag is used to scan the project', () => {
    describe('pyproject.toml does not contain peotry metadata', () => {
      beforeEach(() => {
        process.env.SNYK_TOKEN = apiKey;
        process.env.SNYK_API = SNYK_API;
        process.env.SNYK_HOST = SNYK_HOST;
      });
      afterEach(() => {
        delete process.env.SNYK_API;
        delete process.env.SNYK_HOST;
        delete process.env.SNYK_PORT;

        mockedLoadPlugin.mockClear();
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
