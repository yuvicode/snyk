import * as debugLib from 'debug';
import {
  parse,
  j2xParser as Parser,
  X2jOptionsOptional,
} from 'fast-xml-parser';

import { validateRequiredData } from '../../python/handlers/validate-required-data';
import {
  EntityToFix,
  FixChangesSummary,
  FixOptions,
  UpgradeRemediation,
  Workspace,
} from '../../../types';
import { PluginFixResponse } from '../../types';

const debug = debugLib('snyk-fix:maven');

export async function updateDependencies(
  entity: EntityToFix,
  _options: FixOptions,
): Promise<PluginFixResponse> {
  const handlerResult: PluginFixResponse = {
    succeeded: [],
    failed: [],
    skipped: [],
  };

  const allChanges: FixChangesSummary[] = [];
  try {
    const { remediation, targetFile, workspace } = validateRequiredData(entity);
    debug(`remediation=${JSON.stringify(remediation)}`);
    debug(`targetFile=${JSON.stringify(targetFile)}`);
    debug(`workspace=${JSON.stringify(workspace)}`);
    // DO SOMETHING WITH REMEDIATION DATA & UPDATE FILE

    const pomXml = await workspace.readFile(targetFile);
    debug(`pomXml=${pomXml}`);
    // parse it
    const parseOptions: X2jOptionsOptional = {
      // trim string values of an attribute or node
      trimValues: true,
      // do not parse the value of text node to float, integer, or boolean
      // we parse to strings primarily so versions are not parsed as numbers
      parseNodeValue: false,
      // ignore attributes to be parsed
      ignoreAttributes: true,
    };

    const pomJson = parse(pomXml, parseOptions);
    debug(`pomJson=${JSON.stringify(pomJson)}`);

    for (const [upgradeFrom, upgradeData] of Object.entries(
      remediation.upgrade,
    )) {
      debug(`Applying upgrade for ${upgradeFrom}`);

      const { changes } = await applyUpgrade(
        pomJson,
        upgradeFrom,
        upgradeData,
        workspace,
        targetFile,
      );
      allChanges.push(...changes);
    }

    // for each upgrade =>  apply it
    // find the dep & swap the versions for each remediation
    // if successful generate successful change

    // const changes = generateSuccessfulChanges(remediation.upgrade);
    handlerResult.succeeded.push({
      original: entity,
      changes: allChanges,
    });
  } catch (error) {
    debug(
      `Failed to fix ${entity.scanResult.identity.targetFile}.\nERROR: ${error}`,
    );
    handlerResult.failed.push({
      original: entity,
      error,
      tip: `TODO: add some tip to try here`,
    });
  }
  return handlerResult;
}

// The XML parser returns either an object when a section in XML has a single entry,
// or an array of object when the section has multiple entries.
// This function works around this weird API design by ensuring we always have an array.
function ensureArray<T>(value?: T | T[]): T[] {
  if (value === null || value === undefined) {
    return [];
  }

  if (Array.isArray(value)) {
    return value.filter((v) => v !== null && v !== undefined);
  }

  return [value];
}

async function applyUpgrade(
  pomJson: any,
  upgradeFrom: string,
  upgradeData: UpgradeRemediation,
  workspace: Workspace,
  targetFile: string,
): Promise<{ changes: FixChangesSummary[] }> {
  const changes: FixChangesSummary[] = [];
  const { upgradeTo, vulns } = upgradeData;
  const newVersion = upgradeTo.split('@')[1];
  const [pkgName, version] = upgradeFrom.split('@');

  try {
    let foundDependency = false;
    // only apply upgrades to version inline, ignore everything else
    const dependencies = ensureArray(pomJson?.project?.dependencies?.dependency);
    debug(`dependencies=${dependencies}`, JSON.stringify(pomJson.dependencies))
    for (const dependency of dependencies) {
      debug(`${pkgName} does this equal ${dependency?.groupId}:${dependency?.artifactId}`);
      if (pkgName === `${dependency?.groupId}:${dependency?.artifactId}`) {
        dependency.version = newVersion;
        foundDependency = true;
        break;
      }
    }
    debug(`foundDependency ${pkgName} = ${foundDependency}`);

    if (!foundDependency) {
      throw new Error('Could not find dependency ' + upgradeFrom);
    }

    // write file back
    const defaultOptions = {
      // attributeNamePrefix : "@_",
      // attrNodeName: "@", //default is false
      // textNodeName : "#text",
      // ignoreAttributes : true,
      // cdataTagName: "__cdata", //default is false
      // cdataPositionChar: "\\c",
      // format: true,
      // indentBy: "  ",
      // supressEmptyNode: false,
      // tagValueProcessor: a=> he.encode(a, { useNamedReferences: true}),// default is a=>a
      // attrValueProcessor: a=> he.encode(a, {isAttributeValue: isAttribute, useNamedReferences: true})// default is a=>a
    };
    const parser = new Parser(defaultOptions);
    const newFileContents = parser.parse(pomJson);
    await workspace.writeFile(targetFile, newFileContents);
    changes.push({
      success: true,
      userMessage: `Upgraded ${pkgName} from ${version} to ${newVersion}`,
      issueIds: vulns,
      from: upgradeFrom,
      to: upgradeTo, //`${pkgName}@${newVersion}`,
    });
  } catch (e) {
    changes.push({
      success: false,
      reason: e.message,
      userMessage: `Failed to upgrade ${pkgName} from ${version} to ${newVersion}`,
      tip: 'Apply the changes manually',
      issueIds: vulns,
    });
  }
  return { changes };
}
