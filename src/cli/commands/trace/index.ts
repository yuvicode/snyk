// TODO: locate where bear is
// TODO: - LD_PRELOAD = /path/to/libbear.so build.sh
// TODO: command to trace?
// `which bear` - gives us the path to the executable <--- *nix only
// then pass it into the env variable
import * as fs from 'fs';
import * as path from 'path';
import * as Debug from 'debug';

import { executeCommand } from '../../../lib/exec';
import { TraceOptions, Options } from '../../../lib/types';
import * as subProcess from './sub-process';
import * as depGraphLib from '@snyk/dep-graph';
import * as tmp from 'tmp';

const debug = Debug('snyk');

export = async function traceCommand(options: TraceOptions & Options) {
  debug('snyk trace called with options: %O', options);

  // Bail out early if this is Windows
  if (isWindows()) {
    throw new Error(
      "Windows is unsupported fro C/C++ for now. Get over it. Use unix. C'mon. You know it is better",
    );
  }

  // Bail out early is Bear command is not present
  await checkBearInstalled();

  validateArguments(options);
  try {
    const tracerLogPath = await invokeTracing(options);
    return `Hello I am tracing and saved it to ${tracerLogPath}.\nYou can now run \`snyk test ${tracerLogPath}\``;
  } catch (e) {
    throw new Error(`Failed tracing: ${e.message}`);
  }
};

async function checkBearInstalled(): Promise<string> {
  try {
    const res = ((await executeCommand('which bear')) as any) as string;
    if (!res.length) {
      throw new Error();
    }
    return res;
  } catch (e) {
    throw new Error('Please make sure bear is installed.');
  }
}

function isWindows(): boolean {
  return (
    process.platform === 'win32' ||
    process.env.OSTYPE === 'cygwin' ||
    process.env.OSTYPE === 'msys'
  );
}

function validateArguments(options: TraceOptions & Options): void | Error {
  if (!options.command) {
    throw new Error('Please provide a command to trace');
  }

  if (typeof options.command !== 'string') {
    throw new Error("Command to trace must be a string e.g. --command='make'");
  }

  if (
    options.snykProjectJsonPath &&
    typeof options.snykProjectJsonPath !== 'string'
  ) {
    throw new Error('snyk-project.json path must be a string');
  }
}

async function invokeTracing(options: TraceOptions & Options): Promise<string> {
  debug(`Snyk is invoking & tracing provided command: ${options.command}`);

  const outputFile = 'trace.json';
  const bearArgs = [`--cdb ${outputFile}`, `--disable-filter`]; // TODO: filters??????
  await subProcess.execute('bear', bearArgs.concat(options.command), {
    cwd: process.cwd(),
  });
  debug('Finished executing bear');

  // << END OF BUILD >>
  const tracerLogContent = loadFile('tracer.log');
  // TODO: correctly get the relevant path
  // 3. Filter all the tracer command to only what we need
  // equavalent to tracer_parser.py being run?
  debug('Finished loading traver.log');

  const parsedTracerLog = await parseTraceLog(tracerLogContent, process.cwd());
  debug('Finished loading traver.log');

  // 4. create manifake is not create snyk-project.json
  // where we create a depgraph
  // TODO: THIS IS THE PART WE WANT TO TRY WRITING IN JS
  // MOCK THE REST

  const SnykProjectJson = createSnykProjectJson(parsedTracerLog);
 

  return writeTracerResult(
    SnykProjectJson.toString(),
    options.snykProjectJsonPath,
  );
}

function loadFile(filePath) {
  // fs.existsSync doesn't throw an exception; no need for try
  if (!fs.existsSync(filePath)) {
    throw new Error('File not found: ' + filePath);
  }
  return fs.readFileSync(filePath, 'utf8');
}

// TODO: is this needed?
async function getTmpContent(): Promise<string[]> {
  const dir = '/tmp/';
  return fs
    .readdirSync(dir)
    .filter((filename) => !fs.statSync(path.join(dir, filename)).isDirectory());
}

/**
 * Parses the tracer log file into a collection of objects, each representing a parsed build command.
 * The returned list contains an object per parsed command, e.g. for `ld` command, it would return `ParsedLd` object.
 */
async function parseTraceLog(tracerLogContent: string, root): Promise<string> {

  // gave up for now trying to execute the python scripts in JS
  // due to lack of time
  // for now run in env, later convert it all to TS
  // const tempDirObj = tmp.dirSync({
  //   unsafeCleanup: true,
  // });
  // const script = 'deps/trace_parser';
  // dumpAllFilesInTempDir(tempDirObj, script, tracerLogContent);
  // const baseargs = [];
  // const command = 'python';
  // console.log('**** command ', command);
  // try {
  //   const output = await subProcess.execute(
  //     command,
  //     [...baseargs, ...buildArgs(tempDirObj.name, script)],
  //     { cwd: root },
  //   );
  //   return JSON.parse(output);
  // } catch (error) {
  //   throw error;
  // } finally {
  //   tempDirObj.removeCallback();
  // }

  return tracerLogContent;
}

async function createSnykProjectJson(
  tracerLogContent: string,
): Promise<depGraphLib.DepGraph[]> {

  // 1. for each available list of deps per package manager (allowed project types only)
  // 2. take deps for that packageManager and generate a depgraph
  // 3. return an array of graphs

  // should all this live in a custom plugin!?
  // example of generating a graph https://github.com/snyk/npm-deps/blob/develop/src/lib/dep-graph-from-npm-registry.ts
  // https://github.com/snyk/dep-graph
  
  // it is the equivalent of
  // deps_json = create_manifake(
  //     parsed_commands,
  //     convert_crlf_when_fingerprinting=not args.disable_crlf)
  // dependencies.py

  return [];
}

async function writeTracerResult(
  content: string,
  snykProjectJsonPath?: string,
) {
  let tracerLogPath;
  // TODO: what are we using as content?
  try {
    // save the output to be later used for snyk test
    const snykProjectJsonFileName = 'snyk-project.json';
    let relative = process.cwd();
    if (snykProjectJsonPath) {
      relative = path.relative(process.cwd(), snykProjectJsonPath);
    }
    tracerLogPath = path.resolve(relative, snykProjectJsonFileName);
    if (!tracerLogPath) {
      throw new Error('could not save tracer log');
    }

    fs.writeFileSync(tracerLogPath, content, 'utf-8');
    debug('Done writing to ' + tracerLogPath);
    return tracerLogPath;
  } catch (e) {
    throw new Error('Failed to write tracer log result');
  }
}

//  bear -o tracer.log --disable-filter <BUILD_COMMAND_FROM_CLI>

function buildArgs(tempDirPath: string, script: string) {
  const pathToRun = path.join(tempDirPath, `${script}.py`);
  return [pathToRun];
}

// function dumpAllFilesInTempDir(tempDirName: string) {
//   createAssets().forEach((currentReadFilePath) => {
//     if (!fs.existsSync(currentReadFilePath)) {
//       throw new Error('The file `' + currentReadFilePath + '` is missing');
//     }

//     const relFilePathToDumpDir = getFilePathRelativeToDumpDir(
//       currentReadFilePath,
//     );

//     const writeFilePath = path.join(tempDirName, relFilePathToDumpDir);

//     const contents = fs.readFileSync(currentReadFilePath, 'utf8');
//     writeFile(writeFilePath, contents);
//   });
// }

function writeFile(writeFilePath: string, contents: string) {
  const dirPath = path.dirname(writeFilePath);
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath);
  }
  fs.writeFileSync(writeFilePath, contents);
}

function createAssets(script): string[] {
  return [path.join(__dirname, `./pysrc/deps/trace_parser.py`)];
  return [path.join(__dirname, `./tracer.log`)];
}

function getFilePathRelativeToDumpDir(filePath: string) {
  let pathParts = filePath.split('\\pysrc\\');

  // Windows
  if (pathParts.length > 1) {
    return pathParts[1];
  }

  // Unix
  pathParts = filePath.split('/pysrc/');
  return pathParts[1];
}
