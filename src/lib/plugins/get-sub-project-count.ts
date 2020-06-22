import { legacyPlugin as pluginApi } from '@snyk/cli-interface';
import { find } from '../find-files';
import { AUTO_DETECTABLE_FILES } from '../detect';

export async function getSubProjectCount(
  root,
  options,
  inspectResult: pluginApi.InspectResult,
): Promise<number | undefined> {
  // gradle sub-projects are returned as meta like this
  if (
    inspectResult.plugin.meta &&
    inspectResult.plugin.meta.allSubProjectNames &&
    inspectResult.plugin.meta.allSubProjectNames.length > 1
  ) {
    return inspectResult.plugin.meta.allSubProjectNames.length;
  }

  if (!options.allProjects) {
    const targetFiles = await find(root, [], AUTO_DETECTABLE_FILES, 4);
    if (targetFiles.length > 1) {
      return targetFiles.length - 1;
    }
  }

  return undefined;
}
