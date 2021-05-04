import * as fs from 'fs';
import * as path from 'path';
import { PackageAndVersion } from '../../src/lib/types';

import { extractPatchMetadata } from '../../src/lib/snyk-file';
import { checkProject } from '../../src/lib/explore-node-modules';
import { getPatches } from '../../src/lib/get-patches';
import {
  extractTargetFilePathFromPatch,
  patchString,
} from '../../src/lib/patch';

// TODO: lower it once Protect stops hitting real Snyk API endpoints
const testTimeout = 30000;

describe('parsing .snyk file content', () => {
  it('works with a single patch', () => {
    const dotSnykFileContents = `
# Snyk (https://snyk.io) policy file, patches or ignores known vulnerabilities.
version: v1.19.0
ignore: {}
# patches apply the minimum changes required to fix a vulnerability
patch:
  SNYK-JS-LODASH-567746:
    - tap > nyc > istanbul-lib-instrument > babel-types > lodash:
        patched: '2021-02-17T13:43:51.857Z'
    `;
    const result = extractPatchMetadata(dotSnykFileContents);

    expect(result).toEqual(
      new Map([['SNYK-JS-LODASH-567746', new Set(['lodash'])]]),
    );
  });

  it('works with multiple patches', async () => {
    const dotSnykFileContents = `
# Snyk (https://snyk.io) policy file, patches or ignores known vulnerabilities.
version: v1.19.0
ignore: {}
# patches apply the minimum changes required to fix a vulnerability
patch:
  SNYK-JS-LODASH-567746:
    - tap > nyc > istanbul-lib-instrument > babel-types > lodash:
        patched: '2021-02-17T13:43:51.857Z'

  SNYK-FAKE-THEMODULE-000000:
    - top-level > some-other > the-module:
        patched: '2021-02-17T13:43:51.857Z'
    `;
    const result = extractPatchMetadata(dotSnykFileContents);
    expect(result).toEqual(
      new Map([
        ['SNYK-JS-LODASH-567746', new Set(['lodash'])],
        ['SNYK-FAKE-THEMODULE-000000', new Set(['the-module'])],
      ]),
    );
  });

  it('works with zero patches defined in patch section', async () => {
    const dotSnykFileContents = `
# Snyk (https://snyk.io) policy file, patches or ignores known vulnerabilities.
version: v1.19.0
ignore: {}
# patches apply the minimum changes required to fix a vulnerability
patch:
`;
    const result = extractPatchMetadata(dotSnykFileContents);
    expect(result).toEqual(new Map());
  });

  it('works with no patch section', async () => {
    const dotSnykFileContents = `
# Snyk (https://snyk.io) policy file, patches or ignores known vulnerabilities.
version: v1.19.0
ignore: {}
`;
    const result = extractPatchMetadata(dotSnykFileContents);
    expect(result).toEqual(new Map());
  });
});

describe('checkProject', () => {
  it('works with no matching physical modules', () => {
    const fixtureFolderRelativePath = '../fixtures/no-matching-paths';
    const fixtureFolder = path.join(__dirname, fixtureFolderRelativePath);
    expect(checkProject(fixtureFolder, new Set(['lodash']))).toHaveLength(0);
  });

  it('works with single matching physical module', () => {
    const fixtureFolderRelativePath = '../fixtures/single-patchable-module';
    const fixtureFolder = path.join(__dirname, fixtureFolderRelativePath);

    const physicalModulesToPatch = checkProject(
      fixtureFolder,
      new Set(['lodash']),
    );

    expect(physicalModulesToPatch).toHaveLength(1);
    const m = physicalModulesToPatch[0];
    expect(m.name).toBe('lodash');
    expect(m.version).toBe('4.17.15');
    expect(m.path).toEqual(
      path.join(
        __dirname,
        fixtureFolderRelativePath,
        '/node_modules/nyc/node_modules/lodash',
      ),
    );
  });

  it('works with multiple matching physical modules', () => {
    const fixtureFolderRelativePath = '../fixtures/multiple-matching-paths';
    const fixtureFolder = path.join(__dirname, fixtureFolderRelativePath);

    const physicalModulesToPatch = checkProject(
      fixtureFolder,
      new Set(['lodash']),
    );

    expect(physicalModulesToPatch).toHaveLength(2);
    const m0 = physicalModulesToPatch[0];
    expect(m0.name).toBe('lodash');
    expect(m0.version).toBe('4.17.15');
    expect(m0.path).toEqual(
      path.join(__dirname, fixtureFolderRelativePath, '/node_modules/lodash'),
    );
    const m1 = physicalModulesToPatch[1];
    expect(m1.name).toBe('lodash');
    expect(m1.version).toBe('4.17.15');
    expect(m1.path).toEqual(
      path.join(
        __dirname,
        fixtureFolderRelativePath,
        '/node_modules/nyc/node_modules/lodash',
      ),
    );
  });
});

// These tests makes a real API calls to Snyk
// TODO: would be better to mock the response
describe('getPatches', () => {
  it(
    'seems to work',
    async () => {
      const packageAndVersions: PackageAndVersion[] = [
        {
          name: 'lodash',
          version: '4.17.15',
        } as PackageAndVersion,
      ];
      const vulnIds = new Set(['SNYK-JS-LODASH-567746']);
      const patches = await getPatches(packageAndVersions, vulnIds);
      expect(patches).toMatchObject(
        new Map([
          [
            'lodash',
            [
              {
                id: 'patch:SNYK-JS-LODASH-567746:0',
                modificationTime: expect.any(String),
                urls: [expect.any(String)],
                version: expect.any(String),
                comments: [],
                diffs: [
                  expect.stringContaining('index 9b95dfef..43e71ffb 100644'),
                ],
              },
            ],
          ],
        ]),
      );
    },
    testTimeout,
  );

  it(
    'does not download patch for non-applicable version',
    async () => {
      const packageAndVersions = [
        {
          name: 'lodash',
          version: '4.17.20', // this version is not applicable to the patch
        },
      ];
      const vulnIds = new Set(['SNYK-JS-LODASH-567746']);
      const patches = await getPatches(packageAndVersions, vulnIds);
      expect(patches).toEqual(new Map()); // expect nothing to be returned because SNYK-JS-LODASH-567746 does not apply to 4.17.20 of lodash
    },
    testTimeout,
  );
});

describe('applying patches', () => {
  it('can apply a patch using string', () => {
    const fixtureFolder = path.join(
      __dirname,
      '../fixtures/patchable-file-lodash',
    );
    const patchFilePath = path.join(fixtureFolder, 'lodash.patch');

    const patchContents = fs.readFileSync(patchFilePath, 'utf-8');

    const targetFilePath = path.join(
      fixtureFolder,
      extractTargetFilePathFromPatch(patchContents),
    );
    const contentsToPatch = fs.readFileSync(targetFilePath, 'utf-8');

    const patchedContents = patchString(patchContents, contentsToPatch);

    const expectedPatchedContentsFilePath = path.join(
      fixtureFolder,
      'lodash-expected-patched.js',
    );
    const expectedPatchedContents = fs.readFileSync(
      expectedPatchedContentsFilePath,
      'utf-8',
    );
    expect(patchedContents).toBe(expectedPatchedContents);
    expect(0).toBe(0);
  });

  // if the patch is not compatible with the target, make sure we throw an Error and do patch
  it('will throw if patch does not match target', () => {
    const fixtureFolder = path.join(
      __dirname,
      '../fixtures/non-patchable-file-because-non-matching',
    );
    const patchFilePath = path.join(fixtureFolder, 'lodash.patch');
    const patchContents = fs.readFileSync(patchFilePath, 'utf-8');
    const targetFilePath = path.join(
      fixtureFolder,
      extractTargetFilePathFromPatch(patchContents),
    );
    const contentsToPatch = fs.readFileSync(targetFilePath, 'utf-8');
    expect(() => {
      patchString(patchContents, contentsToPatch);
    }).toThrow(Error);
  });
});
