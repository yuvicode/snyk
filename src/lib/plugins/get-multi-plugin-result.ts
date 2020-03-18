import * as _ from 'lodash';
import * as path from 'path';
import * as cliInterface from '@snyk/cli-interface';
import * as debugModule from 'debug';
import * as types from './types';
import { TestOptions, Options, MonitorOptions } from '../types';
import { detectPackageManagerFromFile } from '../detect';
import { SupportedPackageManagers } from '../package-managers';
import { getSinglePluginResult } from './get-single-plugin-result';
import * as nodeJSPlugin from './nodejs-plugin';
import { convertSingleResultToMultiCustom } from './convert-single-plugin-res-to-multi-custom';
import { convertMultiResultToMultiCustom } from './convert-multi-plugin-res-to-multi-custom';
import { PluginMetadata } from '@snyk/cli-interface/legacy/plugin';

const debug = debugModule('snyk');

export interface ScannedProjectCustom
  extends cliInterface.legacyCommon.ScannedProject {
  packageManager: SupportedPackageManagers;
  plugin: PluginMetadata;
}

export interface CliPlugin2 {
  supportedTargetFiles: string[];
  discover: (
    root: string,
    targetFiles: string[],
    options: types.Options & Options & (TestOptions | MonitorOptions),
  ) => Promise<ScannedProjectCustom[]>;
}

export interface MultiProjectResultCustom
  extends cliInterface.legacyPlugin.MultiProjectResult {
  scannedProjects: ScannedProjectCustom[];
}

export async function getMultiPluginResult(
  root: string,
  options: Options & (TestOptions | MonitorOptions),
  targetFiles: string[],
): Promise<MultiProjectResultCustom> {
  const allResults: ScannedProjectCustom[] = [];
  // 1. Refactor / feat : send all targetFiles to the nodejs-plugin to be like Registry discovery
  // filter all for node related files only and then process each like before
  // 2. then start to detect workspaces as part 2

  // send all files NODE to node-js (it will filter)

  // for all target files filter all that relate to some registered plugin
  // send them to that plugin remove them from current targetFiles array
  // which ones to not process again?
  const newPlugins: CliPlugin2[] = [nodeJSPlugin];

  const newPluginsSupportedFiles: string[] = newPlugins.reduce(
    (acc: string[], plugin) => acc.concat(plugin.supportedTargetFiles),
    [],
  );

  newPlugins.forEach(async (plugin) => {
    try {
      const res = await plugin.discover(root, targetFiles, options);
      if (res.length) {
        allResults.push(...res);
      }
    } catch (e) {
      console.log(e.message);
    }
  });

  const oldPluginsTargetFiles: string[] = targetFiles
    .map((p) => ({ p, ...path.parse(p) }))
    .filter((p) => !newPluginsSupportedFiles.includes(p.base))
    .map(({ p }) => p);

  // We are filtering out NodeJS exostsyem files as we pass them to our plugin in a new manner
  // that soon we will transform the rest of the plugins to;
  for (const targetFile of oldPluginsTargetFiles) {
    const optionsClone = _.cloneDeep(options);
    optionsClone.file = path.relative(root, targetFile);
    optionsClone.packageManager = detectPackageManagerFromFile(
      path.basename(targetFile),
    );
    try {
      const inspectRes = await getSinglePluginResult(
        root,
        optionsClone,
        optionsClone.file,
      );
      let resultWithScannedProjects: cliInterface.legacyPlugin.MultiProjectResult;

      if (!cliInterface.legacyPlugin.isMultiResult(inspectRes)) {
        resultWithScannedProjects = convertSingleResultToMultiCustom(
          inspectRes,
          optionsClone.packageManager,
        );
      } else {
        resultWithScannedProjects = inspectRes;
      }

      const pluginResultWithCustomScannedProjects = convertMultiResultToMultiCustom(
        resultWithScannedProjects,
        optionsClone.packageManager,
        optionsClone.file,
      );
      // annotate the package manager, project name & targetFile to be used
      // for test & monitor
      // TODO: refactor how we display meta to not have to do this
      (options as any).projectNames = resultWithScannedProjects.scannedProjects.map(
        (scannedProject) => scannedProject.depTree.name,
      );

      allResults.push(...pluginResultWithCustomScannedProjects.scannedProjects);
    } catch (err) {
      // TODO: fix this we are spamming, should be not logging at all unless debug is on
      debug(`Failed to test ${targetFile}: ${err.message}`);
    }
  }
  debug('*** scannedProjects', allResults);

  return {
    plugin: {
      name: 'custom-auto-detect',
    },
    scannedProjects: allResults,
  };
}
