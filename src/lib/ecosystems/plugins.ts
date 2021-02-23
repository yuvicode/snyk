import * as cppPlugin from 'snyk-cpp-plugin';
import * as dockerPlugin from 'snyk-docker-plugin';
import { Ecosystem, EcosystemPlugin } from './types';

//TODO(artur) remove
import { getCodeAnalysisAndParseResults } from '../snyk-test/run-code-test';
import { getCodeDisplayedOutput } from '../../cli/commands/test/code-output';
import { formatTestMeta } from '../../cli/commands/test/formatters';

const code: EcosystemPlugin = {
  async scan(options) {
    return null as any;
  },
  async display() {
    return '';
  },
  async test(paths, options) {
    const spinnerLbl = 'Querying vulnerabilities database...';
    console.log('>>>>>>>>>>>>>>>>>>>>>>');
    console.log(paths);
    console.log('<<<<<<<<<<<<<<<<<<<<<<');
    const sarifTypedResult = await getCodeAnalysisAndParseResults(spinnerLbl, paths[0], options);
    const meta = 'Meta temp';
    const prefix = 'Prefix temp';
    const readableResult = await getCodeDisplayedOutput(sarifTypedResult, meta, prefix);
    return { readableResult };
  },
};

const EcosystemPlugins: {
  readonly [ecosystem in Ecosystem]: EcosystemPlugin;
} = {
  cpp: cppPlugin as EcosystemPlugin,
  // TODO: not any
  docker: dockerPlugin as any,
  code,
};

export function getPlugin(ecosystem: Ecosystem): EcosystemPlugin {
  return EcosystemPlugins[ecosystem];
}
