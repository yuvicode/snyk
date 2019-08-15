import chalk from 'chalk';
import * as wrap from 'wrap-ansi';
import * as config from '../../../../lib/config';
import { TestOptions } from '../../../../lib/types';
import {
  RemediationChanges, PatchRemediation,
  DependencyUpdates, IssueData, SEVERITY, GroupedVuln,
  DependencyPins,
  UpgradeRemediation,
  PinRemediation,
} from '../../../../lib/snyk-test/legacy';
import { SEVERITIES } from '../../../../lib/snyk-test/common';

interface BasicVulnInfo {
  title: string;
  severity: SEVERITY;
  isNew: boolean;
  name: string;
  version: string;
  fixedIn: string[];
  legalInstructions?: string;
  paths: string[][];
}

interface TopLevelPackageUpgrade {
  name: string;
  version: string;
}

interface UpgradesByAffectedPackage {
  [pkgNameAndVersion: string]: TopLevelPackageUpgrade[];
}

export function formatIssuesWithRemediation(
  vulns: GroupedVuln[],
  remediationInfo: RemediationChanges,
  options: TestOptions,
): string[] {

  const basicVulnInfo: {
    [name: string]: BasicVulnInfo,
  } = {};

  for (const vuln of vulns) {
    basicVulnInfo[vuln.metadata.id] = {
      title: vuln.title,
      severity: vuln.severity,
      isNew: vuln.isNew,
      name: vuln.name,
      version: vuln.version,
      fixedIn: vuln.fixedIn,
      legalInstructions: vuln.legalInstructions,
      paths: vuln.list.map((v) => v.from),
    };
  }
  const results = [chalk.bold.white('Remediation advice')];

  let upgradeTextArray: string[];
  if (remediationInfo.pin && Object.keys(remediationInfo.pin).length) {
    const upgradesByAffected: UpgradesByAffectedPackage = {};
    for (const topLevelPkg of Object.keys(remediationInfo.upgrade)) {
      for (const targetPkgStr of remediationInfo.upgrade[topLevelPkg].upgrades) {
        if (!upgradesByAffected[targetPkgStr]) {
          upgradesByAffected[targetPkgStr] = [];
        }
        upgradesByAffected[targetPkgStr].push({
          name: topLevelPkg,
          version: remediationInfo.upgrade[topLevelPkg].upgradeTo,
        });
      }
    }
    upgradeTextArray = constructPinText(remediationInfo.pin, upgradesByAffected, basicVulnInfo);
    const allVulnIds = new Set();
    Object.keys(remediationInfo.pin).forEach(
      (name) => remediationInfo.pin[name].issues.forEach((vid) => allVulnIds.add(vid)));
    remediationInfo.unresolved = remediationInfo.unresolved.filter((issue) => !allVulnIds.has(issue.id));
  } else {
    upgradeTextArray = constructUpgradesText(remediationInfo.upgrade, basicVulnInfo);
  }
  if (upgradeTextArray.length > 0) {
    results.push(upgradeTextArray.join('\n'));
  }

  const patchedTextArray = constructPatchesText(remediationInfo.patch, basicVulnInfo);

  if (patchedTextArray.length > 0) {
    results.push(patchedTextArray.join('\n'));
  }

  const unfixableIssuesTextArray = constructUnfixableText(remediationInfo.unresolved);

  if (unfixableIssuesTextArray.length > 0) {
    results.push(unfixableIssuesTextArray.join('\n'));
  }

  return results;
}

export function getSeverityValue(severity: SEVERITY): number {
  return SEVERITIES.find((s) => s.verboseName === severity)!.value;
}

function constructPatchesText(
  patches: {
    [name: string]: PatchRemediation;
  },
  basicVulnInfo: {
    [name: string]: BasicVulnInfo;
  },
): string[] {

  if (!(Object.keys(patches).length > 0)) {
    return [];
  }
  const patchedTextArray = [chalk.bold.green('\nPatchable issues:')];

  for (const id of Object.keys(patches)) {
    // todo: add vulnToPatch package name
    const packageAtVersion = `${basicVulnInfo[id].name}@${basicVulnInfo[id].version}`;
    const patchedText = `\n  Patch available for ${chalk.bold.whiteBright(packageAtVersion)}\n`;
    const thisPatchFixes = formatIssue(
      id,
      basicVulnInfo[id].title,
      basicVulnInfo[id].severity,
      basicVulnInfo[id].isNew,
      basicVulnInfo[id].legalInstructions,
      `${basicVulnInfo[id].name}@${basicVulnInfo[id].version}`,
    );
    patchedTextArray.push(patchedText + thisPatchFixes);
  }

  return patchedTextArray;
}

function thisUpgradeFixes(vulnIds: string[], basicVulnInfo: Record<string, BasicVulnInfo>) {
  return vulnIds
    .sort((a, b) => getSeverityValue(basicVulnInfo[a].severity) - getSeverityValue(basicVulnInfo[b].severity))
    .map((id) => formatIssue(
      id,
      basicVulnInfo[id].title,
      basicVulnInfo[id].severity,
      basicVulnInfo[id].isNew,
      basicVulnInfo[id].legalInstructions,
      `${basicVulnInfo[id].name}@${basicVulnInfo[id].version}`,
      ))
    .join('\n');
}

function processUpgrades(
  sink: string[],
  upgradesByDep: DependencyUpdates | DependencyPins,
  deps: string[],
  basicVulnInfo: Record<string, BasicVulnInfo>,
) {
  for (const dep of deps) {
    const data = upgradesByDep[dep];
    const upgradeDepTo = data.upgradeTo;
    const vulnIds = (data as UpgradeRemediation).vulns || (data as PinRemediation).issues;
    const upgradeText =
      `\n  Upgrade ${chalk.bold.whiteBright(dep)} to ${chalk.bold.whiteBright(upgradeDepTo)} to fix\n`;
    sink.push(upgradeText + thisUpgradeFixes(vulnIds, basicVulnInfo));
  }
}

function constructUpgradesText(
  upgrades: DependencyUpdates,
  basicVulnInfo: {
    [name: string]: BasicVulnInfo;
  },
): string[] {

  if (!(Object.keys(upgrades).length > 0)) {
    return [];
  }

  const upgradeTextArray = [chalk.bold.green('\nIssues to fix by upgrading:')];
  processUpgrades(upgradeTextArray, upgrades, Object.keys(upgrades), basicVulnInfo);
  return upgradeTextArray;
}

function constructPinText(
  pins: DependencyPins,
  upgradesByAffected: UpgradesByAffectedPackage, // classical "remediation via top-level dep" upgrades
  basicVulnInfo: Record<string, BasicVulnInfo>,
): string[] {

  if (!(Object.keys(pins).length)) {
    return [];
  }

  // First, direct upgrades
  const upgradeTextArray: string[] = [];

  const upgradeables = Object.keys(pins).filter((name) => !pins[name].isTransitive);
  if (upgradeables.length) {
    upgradeTextArray.push(chalk.bold.green('\nIssues to fix by upgrading existing dependencies:'));
    processUpgrades(upgradeTextArray, pins, upgradeables, basicVulnInfo);
  }

  // Second, pins
  const pinables = Object.keys(pins).filter((name) => pins[name].isTransitive);

  if (pinables.length) {
    upgradeTextArray.push(chalk.bold.green('\nIssues to fix by pinning sub-dependencies:'));

    for (const pkgName of pinables) {
      const data = pins[pkgName];
      const vulnIds = data.issues;
      const upgradeDepTo = data.upgradeTo;
      const upgradeText =
        `\n  Pin ${chalk.bold.whiteBright(pkgName)} to ${chalk.bold.whiteBright(upgradeDepTo)} to fix`;
      upgradeTextArray.push(upgradeText);
      upgradeTextArray.push(thisUpgradeFixes(vulnIds, basicVulnInfo));

      // Transitive dependencies are not visible for the user. Therefore, it makes sense to print
      // at least some guidance explaining where they do come from. We want to limit the number
      // of paths, because it can be in thousands for some projects.
      const allPaths = new Set();
      for (const vid of vulnIds) {
        for (const path of basicVulnInfo[vid].paths) {
          allPaths.add(path.slice(1).join(' > '));
        }
      }
      upgradeTextArray.push(allPaths.size === 1
        ? `  (introduced by ${allPaths.keys().next().value})`
        : `  (introduced by ${allPaths.keys().next().value} and ${allPaths.size - 1} other path(s))`);

      // Finally, if we have some upgrade paths that fix the same issues, suggest them as well.
      const topLevelUpgradesAlreadySuggested = new Set();
      for (const vid of vulnIds) {
        for (const topLevelPkg of upgradesByAffected[pkgName + '@' + basicVulnInfo[vid].version] || []) {
          const setKey = `${topLevelPkg.name}\n${topLevelPkg.version}`;
          if (!topLevelUpgradesAlreadySuggested.has(setKey)) {
            topLevelUpgradesAlreadySuggested.add(setKey);
            upgradeTextArray.push('  The issues above can also be fixed by upgrading top-level dependency ' +
              `${topLevelPkg.name} to ${topLevelPkg.version}`);
          }
        }
      }
    }
  }

  return upgradeTextArray;
}

function constructUnfixableText(unresolved: IssueData[]) {
  if (!(unresolved.length > 0)) {
    return [];
  }
  const unfixableIssuesTextArray = [chalk.bold.white('\nIssues with no direct upgrade or patch:')];
  for (const issue of unresolved) {
    const extraInfo = issue.fixedIn && issue.fixedIn.length
      ? `\n  This issue was fixed in versions: ${chalk.bold(issue.fixedIn.join(', '))}`
      : '\n  No upgrade or patch available';
    const packageNameAtVersion = chalk.bold
      .whiteBright(`\n  ${issue.packageName}@${issue.version}\n`);
    unfixableIssuesTextArray
      .push(packageNameAtVersion +
        formatIssue(
          issue.id,
          issue.title,
          issue.severity,
          issue.isNew,
          issue.legalInstructions) + `${extraInfo}`);
  }

  return unfixableIssuesTextArray;
}

function formatIssue(
  id: string,
  title: string,
  severity: SEVERITY,
  isNew: boolean,
  legalInstructions?: string,
  vulnerableModule?: string): string {
  const severitiesColourMapping = {
    low: {
      colorFunc(text) {
        return chalk.blueBright(text);
      },
    },
    medium: {
      colorFunc(text) {
        return chalk.yellowBright(text);
      },
    },
    high: {
      colorFunc(text) {
        return chalk.redBright(text);
      },
    },
  };
  const newBadge = isNew ? ' (new)' : '';
  const name = vulnerableModule ? ` in ${chalk.bold(vulnerableModule)}` : '';
  const wrapLegalText = wrap(`${legalInstructions}`, 100);
  const formatLegalText = wrapLegalText.split('\n').join('\n    ');

  return severitiesColourMapping[severity].colorFunc(
    `  ✗ ${chalk.bold(title)}${newBadge} [${titleCaseText(severity)} Severity]`,
  ) + `[${config.ROOT}/vuln/${id}]` + name
    + (legalInstructions ? `${chalk.bold('\n    Legal instructions')}:\n    ${formatLegalText}` : '');
}

function titleCaseText(text) {
  return text[0].toUpperCase() + text.slice(1);
}
