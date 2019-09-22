import * as _ from 'lodash';
import * as fs from 'fs';
import moduleToObject = require('snyk-module');
import * as depGraphLib from '@snyk/dep-graph';
import analytics = require('../analytics');
import * as config from '../config';
import plugins = require('../plugins');
import {ModuleInfo} from '../module-info';
import {isCI} from '../is-ci';
import request = require('../request');
import snyk = require('../');
import spinner = require('../spinner');
import common = require('./common');
import {DepTree, TestOptions} from '../types';
import gemfileLockToDependencies = require('../../lib/plugins/rubygems/gemfile-lock-to-dependencies');
import {
  convertTestDepGraphResultToLegacy, AnnotatedIssue, LegacyVulnApiResult,
  TestDepGraphResponse,
} from './legacy';
import {Options} from '../types';
import {
  NoSupportedManifestsFoundError,
  InternalServerError,
  FailedToGetVulnerabilitiesError,
  FailedToRunTestError,
} from '../errors';
import { maybePrintDeps } from '../print-deps';
import { countPathsToGraphRoot, pruneGraph } from '../prune';
import { legacyPlugin as pluginApi } from '@snyk/cli-interface';
import { AuthFailedError } from '../errors/authentication-failed-error';
import {Plugin} from '../plugins/types';
import {SupportedPackageManagers} from '../package-managers';
import * as rubygemsPlugin from '../plugins/rubygems';

// tslint:disable-next-line:no-var-requires
const debug = require('debug')('snyk');

interface DepTreeFromResolveDeps extends DepTree {
  numDependencies: number;
  pluck: any;
}

interface PayloadBody {
  depGraph?: depGraphLib.DepGraph; // missing for legacy endpoint (options.vulnEndpoint)
  policy: string;
  targetFile?: string;
  projectNameOverride?: string;
  hasDevDependencies?: boolean;
  docker?: any;
}

interface Payload {
  method: string;
  url: string;
  json: boolean;
  headers: {
    'x-is-ci': boolean;
    authorization: string;
  };
  body?: PayloadBody;
  qs?: object | null;
  modules?: DepTreeFromResolveDeps;
}

export async function runTest(root: string,
                              targetFiles: string[],
                              options: Options & TestOptions): Promise<LegacyVulnApiResult[]> {
  const results: LegacyVulnApiResult[] = [];
  const spinnerLbl = 'Querying vulnerabilities database...';
  try {
    const payloads = await assemblePayloads(root, targetFiles, options);
    for (const payload of payloads) {
      const payloadPolicy = payload.body && payload.body.policy;
      const depGraph = payload.body && payload.body.depGraph;

      await spinner(spinnerLbl);
      analytics.add('depGraph', !!depGraph);
      // Type assertion might be a lie, but we are correcting that below
      let res = await sendTestPayload(payload) as LegacyVulnApiResult;
      if (depGraph) {
        res = convertTestDepGraphResultToLegacy(
          res as any as TestDepGraphResponse, // Double "as" required by Typescript for dodgy assertions
          depGraph,
          depGraph.pkgManager.name,
          options.severityThreshold);

        // For Node.js: inject additional information (for remediation etc.) into the response.
        if (payload.modules) {
          res.dependencyCount = payload.modules.numDependencies;
          if (res.vulnerabilities) {
            res.vulnerabilities.forEach((vuln) => {
              if (payload.modules && payload.modules.pluck) {
                const plucked = payload.modules.pluck(vuln.from, vuln.name, vuln.version);
                vuln.__filename = plucked.__filename;
                vuln.shrinkwrap = plucked.shrinkwrap;
                vuln.bundled = plucked.bundled;

                // this is an edgecase when we're testing the directly vuln pkg
                if (vuln.from.length === 1) {
                  return;
                }

                const parentPkg = moduleToObject(vuln.from[1]);
                const parent = payload.modules.pluck(vuln.from.slice(0, 2),
                  parentPkg.name,
                  parentPkg.version);
                vuln.parentDepType = parent.depType;
              }
            });
          }
        }
      }
      // TODO: is this needed? we filter on the other side already based on policy
      // this will move to be filtered server side soon & it will support `'ignore-policy'`
      analytics.add('vulns-pre-policy', res.vulnerabilities.length);
      res.filesystemPolicy = !!payloadPolicy;
      if (!options['ignore-policy']) {
        res.policy = res.policy || payloadPolicy as string;
        const policy = await snyk.policy.loadFromText(res.policy);
        res = policy.filter(res, root);
      }
      analytics.add('vulns', res.vulnerabilities.length);

      res.uniqueCount = countUniqueVulns(res.vulnerabilities);
      results.push(res);
    }
    return results;
  } catch (err) {
    // handling denial from registry because of the feature flag
    // currently done for go.mod
    if (err.code === 403 && err.message.includes('Feature not allowed')) {
      throw NoSupportedManifestsFoundError([root]);
    }

    throw new FailedToRunTestError(
      err.userMessage || err.message || 'Failed to test project',
      err.code,
    );
  } finally {
    spinner.clear<void>(spinnerLbl)();
  }
}

function sendTestPayload(payload: Payload):
    Promise<LegacyVulnApiResult | TestDepGraphResponse> {
  const filesystemPolicy = payload.body && !!payload.body.policy;
  return new Promise((resolve, reject) => {
    request(payload, (error, res, body) => {
      if (error) {
        return reject(error);
      }
      if (res.statusCode !== 200) {
        const err = handleTestHttpErrorResponse(res, body);
        return reject(err);
      }

      body.filesystemPolicy = filesystemPolicy;

      resolve(body);
    });
  });
}

function handleTestHttpErrorResponse(res, body) {
  const {statusCode} = res;
  let err;
  const userMessage = body && body.userMessage;
  switch (statusCode) {
    case 401:
    case 403:
      err = AuthFailedError(userMessage, statusCode);
      err.innerError = body.stack;
      break;
    case 500:
      err = new InternalServerError(userMessage);
      err.innerError = body.stack;
      break;
    default:
      err = new FailedToGetVulnerabilitiesError(userMessage, statusCode);
      err.innerError = body.error;
  }
  return err;
}

function assemblePayloads(root: string, targetFiles: string[], options: Options & TestOptions): Promise<Payload[]> {
  const isLocal = fs.existsSync(root);
  console.log('assemblePayloads ', targetFiles);
  analytics.add('local', isLocal);
  if (isLocal) {
    return assembleLocalPayloads(root, targetFiles, options);
  }
  return assembleRemotePayloads(root, options);
}

async function getDiscoveryResult(
  root: string,
  targetFiles: string[], options): Promise<pluginApi.SinglePackageResult[]> {
  const results: pluginApi.SinglePackageResult[] = [];
  console.log('targetFiles', targetFiles);
  console.log('root', root);
  console.log('rubygemsPlugin', rubygemsPlugin);

  for (const plugin of [rubygemsPlugin]) {
    console.log('******* plugin', plugin)

    const moduleInfo = ModuleInfo(plugin, options.policy);
    console.log('******* moduleInfo', moduleInfo)

    const inspectRes: pluginApi.InspectResult[] = await moduleInfo.inspect(root, targetFiles, options);
    console.log('******* inspectRes', inspectRes);
    results.push(...inspectRes)

    // if (!pluginApi.isMultiResult(inspectRes)) {

    //   results.push({
    //     plugin: inspectRes.plugin,
    //     scannedProjects: [{depTree: inspectRes.package}],
    //   });
    // } else {
    //   // We are using "options" to store some information returned from plugin that we need to use later,
    //   // but don't want to send to Registry in the Payload.
    //   // TODO(kyegupov): decouple inspect and payload so that we don't need this hack
    //   (options as any).subProjectNames =
    //     inspectRes.scannedProjects.map((scannedProject) => scannedProject.depTree.name);
    //   results.push(inspectRes);
    // }
  }
  return results;
}

// Payload to send to the Registry for scanning a package from the local filesystem.
async function assembleLocalPayloads(root, targetFiles: string[], options: Options & TestOptions): Promise<Payload[]> {
  // const spinnerLbl = 'Analyzing dependencies for ' +
  //    (pathUtil.relative('.', pathUtil.join(root, targetFile)) ||
  //      (pathUtil.relative('..', '.') + ' project dir'));
  const spinnerLbl = 'Analyzing dependencies'; // todo: figure out what to display

  try {
    const payloads: Payload[] = [];

    await spinner(spinnerLbl);
    const depsRes = await getDiscoveryResult(root, targetFiles, options);
    for (const deps of depsRes) {
      analytics.add('pluginName', deps.plugin.name);

      for (const scannedProject of deps.scannedProjects) {
        const pkg = scannedProject.depTree;
        if (options['print-deps']) {
          await spinner.clear<void>(spinnerLbl)();
          maybePrintDeps(options, pkg);
        }
        if (deps.plugin && deps.plugin.packageManager) {
          (options as any).packageManager = deps.plugin.packageManager;
        }

        if (_.get(pkg, 'files.gemfileLock.contents')) {
          const gemfileLockBase64 = pkg.files.gemfileLock.contents;
          const gemfileLockContents = Buffer.from(gemfileLockBase64, 'base64').toString();
          pkg.dependencies = gemfileLockToDependencies(gemfileLockContents);
        }

        let policyLocations: string[] = [options['policy-path'] || root];
        if (['npm', 'yarn'].indexOf(options.packageManager) > -1) {
          policyLocations = policyLocations.concat(pluckPolicies(pkg));
        }
        debug('policies found', policyLocations);

        analytics.add('policies', policyLocations.length);
        analytics.add('packageManager', options.packageManager);
        addPackageAnalytics(pkg);

        let policy;
        if (policyLocations.length > 0) {
          try {
            policy = await snyk.policy.load(policyLocations, options);
          } catch (err) {
            // note: inline catch, to handle error from .load
            //   if the .snyk file wasn't found, it is fine
            if (err.code !== 'ENOENT') {
              throw err;
            }
          }
        }

        let body: PayloadBody = {
          targetFile: pkg.targetFile,
          projectNameOverride: options.projectName,
          policy: policy && policy.toString(),
          hasDevDependencies: (pkg as any).hasDevDependencies,
        };

        if (options.vulnEndpoint) {
          // options.vulnEndpoint is only used by `snyk protect` (i.e. local filesystem tests).
          body = {...body, ...pkg};
        } else {
          // Graphs are more compact and robust representations.
          // Legacy parts of the code are still using trees, but will eventually be fully migrated.
          debug('converting dep-tree to dep-graph', {
            name: pkg.name,
            targetFile: scannedProject.targetFile || options.file,
          });
          let depGraph = await depGraphLib.legacy.depTreeToGraph(
            pkg, options.packageManager);

          debug('done converting dep-tree to dep-graph', {uniquePkgsCount: depGraph.getPkgs().length});
          if (options['prune-repeated-subdependencies']) {
            debug('Trying to prune the graph');
            const prePruneDepCount = countPathsToGraphRoot(depGraph);
            debug('pre prunedPathsCount: ' + prePruneDepCount);

            depGraph = await pruneGraph(depGraph, options.packageManager);

            analytics.add('prePrunedPathsCount', prePruneDepCount);
            const postPruneDepCount = countPathsToGraphRoot(depGraph);
            debug('post prunedPathsCount: ' + postPruneDepCount);
            analytics.add('postPrunedPathsCount', postPruneDepCount);
          }
          body.depGraph = depGraph;
        }

        const payload: Payload = {
          method: 'POST',
          url: config.API + (options.vulnEndpoint || '/test-dep-graph'),
          json: true,
          headers: {
            'x-is-ci': isCI(),
            'authorization': 'token ' + (snyk as any).api,
          },
          qs: common.assembleQueryString(options),
          body,
        };

        if (['yarn', 'npm'].indexOf(options.packageManager) !== -1) {
          const isLockFileBased = options.file
            && (options.file.endsWith('package-lock.json') || options.file.endsWith('yarn.lock'));
          if (!isLockFileBased || options.traverseNodeModules) {
            payload.modules = pkg as DepTreeFromResolveDeps; // See the output of resolve-deps
          }
        }

        payloads.push(payload);
      }
    }
    return payloads;
  } finally {
    await spinner.clear<void>(spinnerLbl)();
  }
}

// Payload to send to the Registry for scanning a remote package.
async function assembleRemotePayloads(root, options): Promise<Payload[]> {
  const pkg = moduleToObject(root);
  debug('testing remote: %s', pkg.name + '@' + pkg.version);
  addPackageAnalytics(pkg);
  const encodedName = encodeURIComponent(pkg.name + '@' + pkg.version);
  // options.vulnEndpoint is only used by `snyk protect` (i.e. local filesystem tests)
  const url = `${config.API}${(options.vulnEndpoint || `/vuln/${options.packageManager}`)}/${encodedName}`;
  return [{
    method: 'GET',
    url,
    qs: common.assembleQueryString(options),
    json: true,
    headers: {
      'x-is-ci': isCI(),
      'authorization': 'token ' + snyk.api,
    },
  }];
}

function addPackageAnalytics(module): void {
  analytics.add('packageName', module.name);
  analytics.add('packageVersion', module.version);
  analytics.add('package', module.name + '@' + module.version);
}

function countUniqueVulns(vulns: AnnotatedIssue[]): number {
  const seen = {};
  for (const curr of vulns) {
    seen[curr.id] = true;
  }
  return Object.keys(seen).length;
}

function pluckPolicies(pkg) {
  if (!pkg) {
    return null;
  }

  if (pkg.snyk) {
    return pkg.snyk;
  }

  if (!pkg.dependencies) {
    return null;
  }

  return _.flatten(Object.keys(pkg.dependencies).map((name) => {
    return pluckPolicies(pkg.dependencies[name]);
  }).filter(Boolean));
}
