import type { PatchMetadata } from './types'

const lineRegex = /^(\s*)(.*):(?:$| )+(.*)$/i;

const isComment = (line: string): boolean => {
  return line.trimStart().startsWith('#');
};

export function extractPatchMetadata(
  dotSnykFileContent: string,
): PatchMetadata {
  let writingPatches = false;
  let currentVulnId: string;

  return dotSnykFileContent
    .split('\n')
    .filter((line) => line.length > 0 && !isComment(line))
    .map((line) => lineRegex.exec(line))
    .filter((matches) => !!matches)
    .reduce((patchMetadata, matches) => {
      const [, indent, key, value] = matches as RegExpExecArray;
      if (writingPatches && indent.length === 0) {
        writingPatches = false;
      } else if (indent.length === 0 && key === 'patch' && value === '') {
        writingPatches = true;
      } else if (writingPatches) {
        if (indent.length === 2) {
          currentVulnId = key;
          patchMetadata.set(key, new Set());
        } else {
          if (key.startsWith('-')) {
            const packageName = key.split('>').pop()?.trim();
            patchMetadata.get(currentVulnId).add(packageName);
          }
        }
      }
      return patchMetadata;
    }, new Map());
}
