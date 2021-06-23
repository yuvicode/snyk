import { readFileSync, unlinkSync } from 'fs';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { isWindows, ROOT_DIR, verifySARIFPaths } from './helpers';
import { startMockServer } from '../iac/helpers';

jest.setTimeout(50000);

describe('GitHub action - IaC', () => {
  let run: (
    cmd: string,
  ) => Promise<{ stdout: string; stderr: string; exitCode: number }>;
  let teardown: () => void;

  beforeAll(async () => {
    ({ run, teardown } = await startMockServer());
  });

  afterAll(async () => teardown());

  describe.each([
    [
      'iac',
      [
        {
          relativeDir: '',
          inputPath: './iac', // one folder down
        },
        {
          relativeDir: 'iac',
          inputPath: '.', // current directory provided as .
        },
        {
          relativeDir: 'iac',
          inputPath: '', // current directory provided by default
        },
        {
          relativeDir: 'iac/file-output',
          inputPath: '../../iac', // one folder up
        },
      ],
      ['', '--legacy'],
    ],
  ])('when running %p command', (command, configs, flags) => {
    for (const config of configs) {
      const relativeDir = config.relativeDir;
      const inputPath = path.join(config.inputPath);

      describe(`when changing directory into ${relativeDir} and providing input path ${inputPath}`, () => {
        for (const flag of flags) {
          it(`when running with flag ${flag}`, async () => {
            const changeDir =
              relativeDir !== ''
                ? `cd ${isWindows ? '/d' : ''} ${relativeDir} &&`
                : '';
            const sarifOutputFilename = path.join(
              __dirname,
              `${uuidv4()}.sarif`,
            );
            const { stderr } = await run(
              `${changeDir} snyk ${command} test ${inputPath} ${flag} --sarif-file-output=${sarifOutputFilename}`,
            );
            expect(stderr).toBe('');

            const outputFileContents = readFileSync(
              sarifOutputFilename,
              'utf-8',
            );
            unlinkSync(sarifOutputFilename);

            verifySARIFPaths(
              outputFileContents,
              path.resolve(path.join(ROOT_DIR, relativeDir), inputPath),
            );
          });
        }
      });
    }
  });
});
