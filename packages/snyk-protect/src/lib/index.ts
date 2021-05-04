import * as fs from 'fs';
import * as path from 'path';
import { extractPatchMetadata } from './snyk-file';
import { applyPatchToFile } from './patch';
import { getPatches } from './get-patches';
import { checkProject } from './explore-node-modules';
import { PackageName, PatchMetadata } from './types';

const getPackages = (patchMetadata: PatchMetadata): Set<PackageName> => {
  const result: Set<PackageName> = new Set();
  for (const values of patchMetadata.values()) {
    for (const value of values) {
      result.add(value);
    }
  }
  return result;
};

async function protect(projectFolderPath: string): Promise<void> {
  const snykFilePath = path.resolve(projectFolderPath, '.snyk');

  if (!fs.existsSync(snykFilePath)) {
    console.log('No .snyk file found.');
    return;
  }

  const snykFileContents = fs.readFileSync(snykFilePath, 'utf8');
  const patchMetadata = extractPatchMetadata(snykFileContents);

  const vulnsToPatch = new Set(patchMetadata.keys());
  const packagesToPatch: Set<PackageName> = getPackages(patchMetadata);

  const installedPackages = checkProject(projectFolderPath, packagesToPatch);

  const patchesByPackage = await getPatches(installedPackages, vulnsToPatch);
  if (patchesByPackage.size === 0) {
    console.log('Nothing to patch.');
    return;
  }

  for (const installedPackage of installedPackages) {
    const patches = patchesByPackage.get(installedPackage.name);
    if (!patches) {
      continue;
    }

    for (const patch of patches) {
      for (const patchDiff of patch.diffs) {
        applyPatchToFile(patchDiff, installedPackage.path);
      }
    }
  }
}

export default protect;
