import {inspectors, Spec} from './inspectors';
import * as types from '../types';
import {MissingTargetFileError} from '../../errors/missing-targetfile-error';
import * as _ from 'lodash';
import * as path from 'path';

interface RubyGemsInspectResult extends types.InspectResult {
  package: {
    name: string;
    targetFile: string;
    files: any
  };
}

export async function inspect(root: string, targetFiles: string[]): Promise<RubyGemsInspectResult[]> {
  if (!targetFiles ) {
    throw MissingTargetFileError(root);
  }
  console.log('**** targetFiles', targetFiles)

  const rubyTargetFiles: any = _(targetFiles)
    .map((p) => ({ path: p, ...path.parse(p) }))
    .filter((p) => p.base === 'Gemfile.lock')
    .groupBy('dir')
    .value();

  if (_.isEmpty(rubyTargetFiles)) {
    return [];
  }

  console.log('**** rubyTargetFiles', rubyTargetFiles)
  const results: RubyGemsInspectResult[] = [];
  for (const directory of Object.keys(rubyTargetFiles)) {
    console.log('**** directory', directory)

    const rubyLockFileName =
    directory === '' ? 'Gemfile.lock' : `${directory}/Gemfile.lock`;

    console.log('**** directory', directory)

    const specs = await gatherSpecs(root, rubyLockFileName);

    results.push({
      plugin: {
        name: 'bundled:rubygems',
        runtime: 'unknown',
      },
      package: {
        name: specs.packageName,
        targetFile: specs.targetFile,
        files: specs.files,
      },
    });
  }
  return results;
}

async function gatherSpecs(root, targetFile): Promise<Spec> {
  for (const inspector of inspectors) {
    if (inspector.canHandle(targetFile)) {
      return await inspector.gatherSpecs(root, targetFile);
    }
  }

  throw new Error(`Could not handle file: ${targetFile}`);
}
