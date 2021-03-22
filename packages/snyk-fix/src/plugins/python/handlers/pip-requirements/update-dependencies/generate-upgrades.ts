import { DependencyPins, FixChangesSummary } from '../../../../../types';
import { calculateRelevantFixes } from './calculate-relevant-fixes';
import { isDefined } from './is-defined';
import { Requirement } from './requirements-file-parser';
import { UpgradedRequirements } from './types';

export function generateUpgrades(
  requirements: Requirement[],
  updates: DependencyPins,
): { updatedRequirements: UpgradedRequirements; changes: FixChangesSummary[] } {
  // Lowercase the upgrades object. This might be overly defensive, given that
  // we control this input internally, but its a low cost guard rail. Outputs a
  // mapping of upgrade to -> from, instead of the nested upgradeTo object.
  const lowerCasedUpgrades = calculateRelevantFixes(
    requirements,
    updates,
    'direct-upgrades',
  );

  const changes: FixChangesSummary[] = [];
  const updatedRequirements = {};
  requirements.map(
    ({
      name,
      originalName,
      versionComparator,
      version,
      originalText,
      extras,
    }) => {
      // Defensive patching; if any of these are undefined, return
      if (
        typeof name === 'undefined' ||
        typeof versionComparator === 'undefined' ||
        typeof version === 'undefined' ||
        originalText === ''
      ) {
        return;
      }

      // Check if we have an upgrade; if we do, replace the version string with
      // the upgrade, but keep the rest of the content
      const upgrade = Object.keys(
        lowerCasedUpgrades,
      ).filter((packageVersionUpgrade: string) =>
        packageVersionUpgrade.startsWith(`${name.toLowerCase()}@${version}`),
      )[0];

      if (!upgrade) {
        return;
      }
      const newVersion = lowerCasedUpgrades[upgrade].split('@')[1];
      const updatedRequirement = `${originalName}${versionComparator}${newVersion}`;
      changes.push({
        success: true,
        userMessage: `Upgraded ${originalName} from ${version} to ${newVersion}`,
      });
      updatedRequirements[originalText] = `${updatedRequirement}${
        extras ? extras : ''
      }`;
    },
  );

  return {
    updatedRequirements,
    changes,
  };
}

export function getRelevantFixes(
  requirements: Requirement[],
  updates: DependencyPins,
  forTransitiveDeps = false,
): { [upgradeFrom: string]: string } {
  const lowerCasedUpgrades: { [upgradeFrom: string]: string } = {};
  const topLevelDeps = requirements
    .map(({ name }) => name && name.toLowerCase())
    .filter(isDefined);
  Object.keys(updates).forEach((update) => {
    const { upgradeTo } = updates[update];
    const [pkgName] = update.split('@');
    const isTransitiveDep = topLevelDeps.indexOf(pkgName.toLowerCase()) >= 0;
    if (forTransitiveDeps ? isTransitiveDep : !isTransitiveDep) {
      lowerCasedUpgrades[update.toLowerCase()] = upgradeTo.toLowerCase();
    }
  });
  return lowerCasedUpgrades;
}
