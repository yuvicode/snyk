import { readdirSync, statSync } from 'fs';
import * as path from 'path';
const osName = require('os-name');

export async function verifySARIFPaths(sarif: string, dir: string) {
  const jsonObj = JSON.parse(sarif);

  const actualPaths: Set<string> = new Set();
  for await (const p of walk(dir)) {
    actualPaths.add('file://' + p.replace(/\\/g, '/')); // URIs should use forward slash, not backward slash
  }

  const generatedPaths: Set<string> = new Set();
  for (const run of jsonObj.runs) {
    const projectRoot = run.originalUriBaseIds.PROJECTROOT.uri;

    for (const result of run.results) {
      for (const loc of result.locations) {
        generatedPaths.add(
          projectRoot + loc.physicalLocation.artifactLocation.uri,
        );
      }
    }
  }

  for (const p of generatedPaths) {
    expect(actualPaths).toContainEqual(p);
  }
}

async function* walk(dir: string) {
  const files = readdirSync(dir);
  for (const file of files) {
    const entry = path.join(dir, file);
    if (statSync(entry).isDirectory()) {
      yield* walk(entry);
    } else {
      yield entry;
    }
  }
}

export const isWindows =
  osName()
    .toLowerCase()
    .indexOf('windows') === 0;

export const ROOT_DIR = './test/fixtures';
