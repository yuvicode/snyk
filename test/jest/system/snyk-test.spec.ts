import { exec } from 'child_process';
import { sep, join } from 'path';
import { readFileSync, unlinkSync, existsSync } from 'fs';
import { v4 as uuidv4 } from 'uuid';
import { fakeServer } from '../../acceptance/fake-server';
import cli = require('../../../src/cli/commands');

// jest.mock('../../../src/lib/plugins/index', () => {
//   return {
//     loadPlugin: jest.fn(),
//     // __esModule: true,
//     // default: jest.fn(),
//   };
// });
jest.mock('../../../src/lib/plugins/index');

const main = './dist/cli/index.js'.replace(/\//g, sep);
const testTimeout = 5000;

let oldkey;
let oldendpoint;
const apiKey = '123456789';
const port = process.env.PORT || process.env.SNYK_PORT || '12345';

const BASE_API = '/api/v1';
const SNYK_API = 'http://localhost:' + port + BASE_API;
const SNYK_HOST = 'http://localhost:' + port;
const server = fakeServer(BASE_API, apiKey);

import { loadPlugin } from '../../../src/lib/plugins/index';

const mockedLoadPlugin = loadPlugin as jest.Mock<any>;

describe('snyk test for python project', () => {
  beforeAll(async () => {
    let key = await cli.config('get', 'api');
    oldkey = key;

    key = await cli.config('get', 'endpoint');
    oldendpoint = key;

    await new Promise((resolve) => {
      server.listen(port, resolve);
    });
  });

  afterAll(async () => {
    delete process.env.SNYK_API;
    delete process.env.SNYK_HOST;
    delete process.env.SNYK_PORT;

    await server.close();
    let key = 'set';
    let value = 'api=' + oldkey;
    if (!oldkey) {
      key = 'unset';
      value = 'api';
    }
    await cli.config(key, value);
    if (oldendpoint) {
      await cli.config('endpoint', oldendpoint);
    }
  });

  //   afterEach(() => {
  //     mockLoadPlugin.mockClear();
  //   });

  describe('--all-projects flag is used to scan the project', () => {
    describe('pyproject.toml does not contain peotry metadata', () => {
      let jsonOutputFilename;
      beforeEach(() => {
        jsonOutputFilename = `${uuidv4()}.json`;
      });
      afterEach(() => {
        if (existsSync(jsonOutputFilename)) {
          unlinkSync(`./${jsonOutputFilename}`);
        }
      });

      it(
        'should not attempt to scan peotry vulnerabilities',
        async (done) => {
          const fixturePath = join(
            __dirname,
            '../../acceptance/workspaces',
            'python-w-pyproject-wo-poetry',
          );

          //   const plugin = {
          //     async inspect() {
          //       return {
          //         plugin: {
          //           targetFile: 'Pipfile',
          //           name: 'snyk-python-plugin',
          //           runtime: 'Python',
          //         },
          //         package: {},
          //       };
          //     },
          //   };

          //   const spyPlugin = sinon.spy(plugin, 'inspect');
          //   const spyPlugin = jest.spyOn(plugin, 'inspect');

          //   const loadPlugin = sinon.stub(params.plugins, 'loadPlugin');
          //   mockLoadPlugin.mockImplementation(() => {
          //     return plugin;
          //   });
          //   t.teardown(loadPlugin.restore);
          //   loadPlugin.withArgs('pip').returns(plugin);

          //   process.chdir(fixturePath);

          //   const result: CommandResult = await cli.test(
          //     'python-w-pyproject-wo-poetry',
          //     {
          //       allProjects: true,
          //     },
          //   );

          //   console.log(`result`, result);

          exec(
            `node ${main} test ${fixturePath} --all-projects  --json --json-file-output=${jsonOutputFilename}`,
            {
              env: {
                PATH: process.env.PATH,
                SNYK_TOKEN: apiKey,
                SNYK_API,
                SNYK_HOST,
              },
              //   cwd: fixturePath,
            },
            (err, stdout) => {
              if (err) {
                console.log(`err`, err);

                throw err;
              }

              const stdoutJson = stdout;

              const outputFileContents = readFileSync(
                jsonOutputFilename,
                'utf-8',
              );
              unlinkSync(`./${jsonOutputFilename}`);
              expect(stdoutJson).toEqual(outputFileContents);
              //   const outputFileContents = readFileSync(
              //     jsonOutputFilename,
              //     'utf-8',
              //   );
              //   unlinkSync(`./${jsonOutputFilename}`);
              //   const jsonObj = JSON.parse(outputFileContents);
              //   const okValue = jsonObj.ok as boolean;
              //   expect(okValue).toBeTruthy();
              done();
            },
          );
        },
        testTimeout,
      );
    });
  });
});
