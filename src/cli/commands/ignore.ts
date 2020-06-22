export = ignore;

import * as policyLib from 'snyk-policy';
import chalk from 'chalk';
import * as authorization from '../../lib/authorization';
import * as auth from './auth/is-authed';
import { apiTokenExists } from '../../lib/api-token';
import { isCI } from '../../lib/is-ci';
import { MethodResult } from './types';

import * as Debug from 'debug';
const debug = Debug('snyk');

import { MisconfiguredAuthInCI } from '../../lib/errors/misconfigured-auth-in-ci-error';

interface IgnoreOptions {
  reason?: string;
  id: string;
  expiry: string | Date;
}

async function ignore(options: IgnoreOptions): Promise<MethodResult> {
  debug('snyk ignore called with options: %O', options);

  const authed = await auth.isAuthed();
  if (!authed && isCI()) {
    throw MisconfiguredAuthInCI();
  }

  await apiTokenExists();
  const cliIgnoreAuthorization = await authorization.actionAllowed(
    'cliIgnore',
    options,
  );
  if (!cliIgnoreAuthorization.allowed) {
    debug('snyk ignore called when disallowed');
    console.log(chalk.bold.red(cliIgnoreAuthorization.reason));
    return;
  }
  if (!options.id) {
    throw Error('idRequired');
  }
  options.expiry = new Date(options.expiry);
  if (options.expiry.getTime() !== options.expiry.getTime()) {
    debug('No/invalid expiry given, using the default 30 days');
    options.expiry = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
  }
  if (!options.reason) {
    options.reason = 'None Given';
  }

  debug(
    'changing policy: ignore "%s", for all paths, reason: "%s", until: %o',
    options.id,
    options.reason,
    options.expiry,
  );

  let policy: PolicyObject;
  try {
    policy = await policyLib.load(options['policy-path']);
  } catch (error) {
    if (error.code === 'ENOENT') {
      // file does not exist - create it
      policy = policyLib.create();
    }
    throw Error('policyFile');
  }
  const updatedPolicy = await ignoreIssue(options, policy);
  return updatedPolicy;
}

async function ignoreIssue(options: IgnoreOptions, pol: PolicyObject) {
  pol.ignore[options.id] = [
    {
      '*': {
        reason: options.reason,
        expires: options.expiry,
      },
    },
  ];
  return await policyLib.save(pol, options['policy-path']);
}

interface PolicyObject {
  skipVerifyPatch?: boolean;
  ignore: { [issueId: string]: PolicyRule[] };
  patch: { [issueId: string]: PolicyRule[] };
  __filename?: string;
}
interface PolicyRule {
  [path: string]: RuleOptions;
}
interface RuleOptions {
  disregardIfFixable?: true;
  expires?: string | Date;
  reason?: string;
}
