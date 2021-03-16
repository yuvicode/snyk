import * as pathLib from 'path';
import { EntityToFix } from '../../types';

export function generateEntityDisplayName(entity: EntityToFix): string {
  const { targetFile, type } = entity.scanResult.identity;
  if (targetFile) {
    return pathLib.relative(entity.options.path, targetFile);
  }

  return `${type} project`;
}
