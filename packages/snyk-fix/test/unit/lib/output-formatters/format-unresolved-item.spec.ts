import stripAnsi = require('strip-ansi');
import * as pathLib from 'path';

import { formatUnresolved } from '../../../../src/lib/output-formatters/format-unresolved-item';
import { generateEntityToFix } from '../../../helpers/generate-entity-to-fix';

describe('format unresolved item', () => {
  it('formats unresolved as expected by default', async () => {
    const entity = generateEntityToFix(
      'pip',
      pathLib.resolve(process.cwd(), 'requirements.txt'),
      JSON.stringify({}),
      process.cwd(),
    );
    const res = await formatUnresolved(entity, 'Failed to process item');
    expect(stripAnsi(res)).toMatchSnapshot();
  });

  it('formats ok when missing targetFile', async () => {
    const entity = generateEntityToFix(
      'npm',
      undefined as any,
      JSON.stringify({}),
    );
    const res = await formatUnresolved(entity, 'Failed to process item');
    expect(stripAnsi(res)).toMatchSnapshot();
  });
});
