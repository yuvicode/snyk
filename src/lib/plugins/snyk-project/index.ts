import { MissingTargetFileError } from '../../errors/missing-targetfile-error';
import * as _ from 'lodash';
import { MultiProjectResult } from '@snyk/cli-interface/legacy/plugin';
import * as depGraphLib from '@snyk/dep-graph';
import { ScannedProject, DepTree } from '@snyk/cli-interface/legacy/common';

export async function inspect(
  root: string,
  targetFile: string,
): Promise<MultiProjectResult> {
  if (!targetFile) {
    throw MissingTargetFileError(root);
  }

  const depGraphs = JSON.parse(targetFile);

  return {
    plugin: {
      name: 'snyk-project',
      runtime: 'unknown',
    },
    scannedProjects: await Promise.all(
      depGraphs.map(graph => convertGraphToScannedProject(depGraphs))
    ),
  };
}


async function convertGraphToScannedProject(graph: depGraphLib.DepGraph):
  Promise<ScannedProject> {
  return {
    depTree: await depGraphLib.legacy.graphToDepTree(graph, graph.pkgManager.name) as DepTree,
  }
}