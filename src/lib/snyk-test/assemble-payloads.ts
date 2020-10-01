import * as path from 'path';
import * as snyk from '../';
import * as config from '../config';
import { isCI } from '../is-ci';
import { findAndLoadPolicy } from '../policy';
import { getPlugin } from '../ecosystems';
import { Ecosystem, ScanResult } from '../ecosystems/types';
import { SupportedPackageManagers } from '../package-managers';
import { Options, PolicyOptions, TestOptions } from '../types';
import { Payload } from './types';
import { assembleQueryString } from './common';
import spinner = require('../spinner');

export async function assembleEcosystemPayloads(
  ecosystem: Ecosystem,
  options: Options & TestOptions & PolicyOptions,
): Promise<Payload[]> {
  // For --all-projects packageManager is yet undefined here. Use 'all'
  let analysisTypeText = 'all dependencies for ';
  if (options.docker) {
    analysisTypeText = 'container dependencies for ';
  } else if (options.iac) {
    analysisTypeText = 'Infrastructure as code configurations for ';
  } else if (options.packageManager) {
    analysisTypeText = options.packageManager + ' dependencies for ';
  }

  const spinnerLbl =
    'Analyzing ' +
    analysisTypeText +
    (path.relative('.', path.join(options.path, options.file || '')) ||
      path.relative('..', '.') + ' project dir');

  spinner.clear<void>(spinnerLbl)();
  await spinner(spinnerLbl);

  const plugin = getPlugin(ecosystem);
  const pluginResponse = await plugin.scan(options);

  const payloads: Payload[] = [];

  // TODO: This is a temporary workaround until the plugins themselves can read policy files and set names!
  for (const scanResult of pluginResponse.scanResults) {
    // WARNING! This mutates the payload. Policy logic should be in the plugin.
    scanResult.policy = await findAndLoadPolicyForScanResult(
      scanResult,
      options,
    );
    // WARNING! This mutates the payload. The project name logic should be handled in the plugin.
    scanResult.name =
      options['project-name'] || config.PROJECT_NAME || scanResult.name;

    payloads.push({
      method: 'POST',
      url: `${config.API}/test-dependencies`,
      json: true,
      headers: {
        'x-is-ci': isCI(),
        authorization: 'token ' + snyk.api,
      },
      body: {
        scanResult,
      },
      qs: assembleQueryString(options),
    });
  }

  return payloads;
}

async function findAndLoadPolicyForScanResult(
  scanResult: ScanResult,
  options: Options & TestOptions & PolicyOptions,
): Promise<string | undefined> {
  const targetFileRelativePath = scanResult.identity.targetFile
    ? path.join(path.resolve(`${options.path}`), scanResult.identity.targetFile)
    : undefined;
  const targetFileDir = targetFileRelativePath
    ? path.parse(targetFileRelativePath).dir
    : undefined;
  const scanType = options.docker
    ? 'docker'
    : (scanResult.identity.type as SupportedPackageManagers);
  // TODO: fix this and send only send when we used resolve-deps for node
  // it should be a ExpandedPkgTree type instead
  const packageExpanded = undefined;

  const policy = await findAndLoadPolicy(
    options.path,
    scanType,
    options,
    packageExpanded,
    targetFileDir,
  );
  return policy;
}
