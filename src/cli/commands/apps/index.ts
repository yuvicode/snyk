import * as Debug from 'debug';
import { MethodArgs } from '../../args';
import { processCommandArgs } from '../process-command-args';
import {
  EValidSubCommands,
  HelpMessages,
  validAppsSubCommands,
  createAppPrompts,
  SNYK_APP_NAME,
  SNYK_APP_REDIRECT_URIS,
  SNYK_APP_SCOPES,
  deleteAppPrompts,
  SNYK_APP_ORG_ID,
  SNYK_APP_CLIENT_ID,
  SNYK_APP_DEBUG,
} from '../../../lib/apps';
import * as inquirer from '@snyk/inquirer';
import config from '../../../lib/config';
import { createApp } from './create-app';
import { deleteApp } from './delete-app';

const debug = Debug(SNYK_APP_DEBUG);

export default async function apps(
  ...args0: MethodArgs
): Promise<string | undefined | any> {
  debug('Snyk apps CLI called');
  const { options, paths } = processCommandArgs(...args0);
  debug(options, paths);

  const subCommand = paths[0];
  const validSubCommand =
    subCommand && validAppsSubCommands.includes(subCommand);

  if (!validSubCommand) {
    // Display what is available
    debug(`Not a valid sub command ${subCommand}`);
    return HelpMessages.availableCommands;
  }

  const configOrg = config.org ? decodeURIComponent(config.org) : undefined;

  if (subCommand === EValidSubCommands.CREATE) {
    const answers = await inquirer.prompt(createAppPrompts);
    // Process answers
    const snykAppName = answers[SNYK_APP_NAME].trim() as string;
    const snykAppRedirectUris = answers[SNYK_APP_REDIRECT_URIS].trim().split(
      ' ',
    ) as string[];
    const snykAppScopes = answers[SNYK_APP_SCOPES].trim().split(
      ' ',
    ) as string[];
    const orgId = answers[SNYK_APP_ORG_ID] || configOrg;
    // POST: to create an app
    const res = await createApp({
      orgId,
      snykAppName,
      snykAppRedirectUris,
      snykAppScopes,
    });
    if (res) return res;
  } else if (subCommand === EValidSubCommands.DELETE) {
    // DELETE: app created in Snyk
    const answers = await inquirer.prompt(deleteAppPrompts);

    if (!answers.snykAppDelete) return;

    const orgId = answers[SNYK_APP_ORG_ID] || configOrg;
    const clientId = answers[SNYK_APP_CLIENT_ID];
    const res = await deleteApp(orgId, clientId);
    if (res) return res;
  } else {
    debug(`Not a valid sub command ${subCommand}`);
    return HelpMessages.availableCommands;
  }
}
