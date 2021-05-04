import * as https from 'https';
import {
  TestResponse,
  Diff,
  PackageAndVersion,
  PackageName,
  VulnerabilityID,
  Patch,
} from './types';

const DEFAULT_API_BASE_URL = 'https://snyk.io/api';

export async function getPatches(
  packages: PackageAndVersion[],
  vulnsToPatch: Set<VulnerabilityID>,
): Promise<Map<PackageName, Array<Patch>>> {
  const patchesByPackage = new Map();
  const checkedPackages = new Set();
  for (const pkg of packages) {
    const toCheck = `${pkg.name}/${pkg.version}`;
    if (checkedPackages.has(toCheck)) {
      continue;
    }

    checkedPackages.add(toCheck);

    const snykToken = process.env.SNYK_TOKEN || process.env.SNYK_API_KEY;
    if (!snykToken) {
      throw new Error('SNYK_TOKEN must be set');
    }

    let apiBaseUrl = DEFAULT_API_BASE_URL;
    if (process.env.SNYK_API) {
      if (process.env.SNYK_API.endsWith('/api')) {
        apiBaseUrl = process.env.SNYK_API;
      } else if (process.env.SNYK_API.endsWith('/api/v1')) {
        apiBaseUrl = process.env.SNYK_API.replace('/v1', '');
      } else {
        console.log(
          `Malformed SNYK_API value. Using default: ${DEFAULT_API_BASE_URL}`,
        );
      }
    }

    const { issues } = await httpsGet<TestResponse>(
      `${apiBaseUrl}/v1/test/npm/${toCheck}`,
      {
        json: true,
        headers: {
          Authorization: `token ${snykToken}`,
          'Content-Type': 'application/json',
        },
      },
    );

    if (!issues.vulnerabilities) {
      continue;
    }

    for (const vulnerability of issues.vulnerabilities) {
      if (!vulnsToPatch.has(vulnerability.id)) {
        continue;
      }

      const fetchedPatches: Patch[] = [];
      for (const patch of vulnerability.patches) {
        const patchWithDiffs: Patch = {
          ...patch,
          diffs: [],
        };

        for (const url of patch.urls) {
          const diff = await httpsGet<Diff>(url);
          patchWithDiffs.diffs.push(diff);
        }

        fetchedPatches.push(patchWithDiffs);
      }

      patchesByPackage.set(vulnerability.package, fetchedPatches);
    }
  }
  return patchesByPackage;
}

export const httpsGet = async <T>(url: string, options: any = {}): Promise<T> =>
  new Promise((resolve, reject) => {
    const parsedURL = new URL(url);
    const requestOptions = {
      ...options,
      host: parsedURL.host,
      path: parsedURL.pathname,
    };
    const request = https.get(requestOptions, (response) => {
      if (
        response.statusCode &&
        (response.statusCode < 200 || response.statusCode > 299)
      ) {
        reject(
          new Error('HTTP request failed. Status Code: ' + response.statusCode),
        );
      }
      const body: any[] = [];
      response.on('data', (chunk: any) => body.push(chunk));
      response.on('end', () =>
        resolve(options.json ? JSON.parse(body.join('')) : body.join('')),
      );
    });
    request.on('error', reject);
  });
