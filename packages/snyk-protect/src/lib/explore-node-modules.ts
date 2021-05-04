import * as fs from 'fs';
import * as path from 'path';
import { InstalledPackage, PackageName } from './types';

function checkInstalledPackage(
  packagePath: string,
  packagesToPatch: Readonly<Set<PackageName>>,
  installedPackages: InstalledPackage[],
): void {
  const packageName = path.basename(packagePath);
  if (!packagesToPatch.has(packageName)) {
    return;
  }

  const packageJsonPath = path.resolve(packagePath, 'package.json');
  if (
    fs.existsSync(packageJsonPath) &&
    fs.lstatSync(packageJsonPath).isFile()
  ) {
    const { name, version } = JSON.parse(
      fs.readFileSync(packageJsonPath, 'utf8'),
    );
    if (packagesToPatch.has(name)) {
      installedPackages.push({
        name,
        version,
        path: packagePath,
      });
    }
  }
}

export function checkProject(
  packagePath: string,
  packagesToPatch: Readonly<Set<PackageName>>,
  installedPackages: InstalledPackage[] = [],
): InstalledPackage[] {
  if (fs.existsSync(packagePath) && fs.lstatSync(packagePath).isDirectory()) {
    checkInstalledPackage(packagePath, packagesToPatch, installedPackages);

    const nodeModules = path.resolve(packagePath, 'node_modules');
    if (fs.existsSync(nodeModules) && fs.lstatSync(nodeModules).isDirectory()) {
      fs.readdirSync(nodeModules).forEach((packageName) => {
        checkProject(
          path.resolve(nodeModules, packageName),
          packagesToPatch,
          installedPackages,
        );
      });
    }
  }
  return installedPackages;
}
