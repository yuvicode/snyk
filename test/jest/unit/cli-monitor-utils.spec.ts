import * as utils from '../../../src/lib/monitor/utils';
import { ScannedProject, DepTree } from '@snyk/cli-interface/legacy/common';
import * as depGraphLib from '@snyk/dep-graph';
import * as fs from 'fs';
import { MonitorMeta } from '../../../src/lib/types';
import { PluginMetadata } from '@snyk/cli-interface/legacy/plugin';

const stubScannedProjectContainer = () => {
  return {
    depTree: {},
    meta: {
      imageName: 'some-image',
    },
    targetFile: '/tmp/package.json',
  };
};

const stubScannedProject = () => {
  return {
    depTree: {},
  };
};

const stubDepTree: DepTree = {
  name: 'my-project',
};

const stubDepGraph: depGraphLib.DepGraph = JSON.parse(
  fs.readFileSync('./test/fixtures/dep-graph/dep-graph.json').toString(),
);

const stubMeta: MonitorMeta = {
  method: 'cli',
  packageManager: 'npm',
  'policy-path': '',
  'project-name': '',
  isDocker: true,
  prune: false,
};

const overrideNameStubMeta: MonitorMeta = {
  method: 'cli',
  packageManager: 'npm',
  'policy-path': '',
  'project-name': 'project-name-override',
  isDocker: true,
  prune: false,
};

const stubPluginMeta: PluginMetadata = {
  name: 'my-plugin',
  targetFile: '/tmp2/package.json',
};

describe('cli-monitor-utils test', () => {
  it('getNameDepTree returns name from scanned project if container', () => {
    const scannedProject: ScannedProject = stubScannedProjectContainer();
    const res = utils.getNameDepTree(scannedProject, stubDepTree, stubMeta);
    expect(res).toEqual('some-image:/tmp/package.json');
  });

  it('getNameDepTree returns name from depTree if not container', () => {
    const scannedProject: ScannedProject = stubScannedProject();
    const res = utils.getNameDepTree(scannedProject, stubDepTree, stubMeta);
    expect(res).toEqual('my-project');
  });

  it('getNameDepGraph returns name from scanned project if container', () => {
    const scannedProject: ScannedProject = stubScannedProjectContainer();
    const res = utils.getNameDepGraph(scannedProject, stubDepGraph, stubMeta);
    expect(res).toEqual('some-image:/tmp/package.json');
  });

  it('getNameDepGraph returns name from depGraph if not container', () => {
    const scannedProject: ScannedProject = stubScannedProject();
    const res = utils.getNameDepGraph(scannedProject, stubDepGraph, stubMeta);
    expect(res).toEqual('my-project');
  });

  it('getProjectName returns name from scanned project if container', () => {
    const scannedProject: ScannedProject = stubScannedProjectContainer();
    const res = utils.getProjectName(scannedProject, stubMeta);
    expect(res).toEqual('some-image');
  });

  it('getProjectName returns name from meta if not container', () => {
    const scannedProject: ScannedProject = stubScannedProject();
    const res = utils.getProjectName(scannedProject, overrideNameStubMeta);
    expect(res).toEqual('project-name-override');
  });

  it('getTargetFile returns name from scanned project if container', () => {
    const scannedProject: ScannedProject = stubScannedProjectContainer();
    const res = utils.getTargetFile(scannedProject, stubPluginMeta);
    expect(res).toEqual('/tmp/package.json');
  });

  it('getTargetFile returns name from plugin meta if not container', () => {
    const scannedProject: ScannedProject = stubScannedProject();
    const res = utils.getTargetFile(scannedProject, stubPluginMeta);
    expect(res).toEqual('/tmp2/package.json');
  });
});
