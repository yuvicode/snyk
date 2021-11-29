import * as fs from 'fs';
import * as pathLib from 'path';
const osName = require('os-name');

import {
  createDirectory,
  writeContentsToFileSwallowingErrors,
} from '../../../src/lib/json-file-output';

const iswindows =
  osName()
    .toLowerCase()
    .indexOf('windows') === 0;

const testOutputRelative = 'test-output';
const testOutputFull = pathLib.join(process.cwd(), testOutputRelative);

const levelOneRelative = 'test-output/level-one';
const levelOneFull = pathLib.join(process.cwd(), levelOneRelative);

const readonlyRelative = 'test-output/read-only';
const readonlyFull = pathLib.join(process.cwd(), readonlyRelative);
const testOutputFileFull = pathLib.join(testOutputFull, 'test-output.json');

function cleanupOutputDirsAndFiles() {
  if (fs.existsSync(levelOneFull)) {
    fs.rmdirSync(levelOneFull);
  }
  if (fs.existsSync(testOutputFileFull)) {
    console.log(`attempting to delete file ${testOutputFileFull}`);
    fs.unlinkSync(testOutputFileFull);
    if (fs.existsSync(testOutputFileFull)) {
      console.log(
        `${testOutputFileFull} still exists after attempting to delete it`,
      );
    } else {
      console.log(`${testOutputFileFull} appears to have been deleted`);
    }
  }
  if (fs.existsSync(readonlyFull)) {
    fs.rmdirSync(readonlyFull);
  }

  // try-catch because seems like in Windows we can't delete the test-output directory because it
  // thinks testOutputFileFull still exists
  try {
    if (fs.existsSync(testOutputFull)) {
      fs.rmdirSync(testOutputFull);
    }
  } catch {
    console.log('Error trying to delete test-output directory');
    const files = fs.readdirSync(testOutputFull);
    files.forEach((file) => {
      console.log(file);
    });
  }
}

beforeEach(() => {
  cleanupOutputDirsAndFiles();
});

afterAll(() => {
  cleanupOutputDirsAndFiles();
});

describe('json file output test', () => {
  it('createDirectory returns true if directory already exists - non-recursive', () => {
    // initially create the directory
    fs.mkdirSync(testOutputFull);

    // attempt to create the directory
    expect(createDirectory(testOutputFull)).toBe(true);

    expect(fs.existsSync(testOutputFull)).toBe(true);
  });

  it('createDirectory creates directory - recursive', () => {
    // attempt to create the directory requiring recursive
    expect(createDirectory(levelOneFull)).toBe(true);
    expect(fs.existsSync(levelOneFull)).toBe(true);
  });

  it('writeContentsToFileSwallowingErrors can write a file', async () => {
    // initially create the directory
    fs.mkdirSync(testOutputFull);

    // this should throw an error within writeContentsToFileSwallowingErrors but that error should be caught, logged, and disregarded
    await writeContentsToFileSwallowingErrors(
      testOutputFileFull,
      'fake-contents',
    );
    expect(fs.existsSync(testOutputFileFull)).toBe(true);
  });

  it('writeContentsToFileSwallowingErrors captures any errors when attempting to write to a readonly directory', async () => {
    if (!iswindows) {
      // initially create the directory
      fs.mkdirSync(testOutputFull);

      // create a directory without write permissions
      fs.mkdirSync(readonlyFull, 0o555);

      const outputPath = pathLib.join(readonlyFull, 'test-output.json');

      await writeContentsToFileSwallowingErrors(outputPath, 'fake-contents');
      expect(fs.existsSync(outputPath)).toBe(false);
    }
  });
});
