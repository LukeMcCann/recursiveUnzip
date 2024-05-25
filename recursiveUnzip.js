#!/usr/bin/env node

const path = require('path');
const fs = require('fs');
const { promisify } = require('util');
const lstat = promisify(fs.lstat);
const readdir = promisify(fs.readdir);

const FLAGS = {
  HELP: ['--help', '-h'],
  VERSION: ['--version', '-v'],
};

const VERSION = '1.0.0';
const PROGRAM_NAME = path.basename(__filename, '.js');

Array.prototype.hasCommonElements = function (arr2) {
  return this.some(item => arr2.includes(item));
};

const isZip = (filePath) => path.extname(filePath).toLowerCase() === '.zip';

const validatePath = async (filePath) => {
  try {
    const absolutePath = path.resolve(filePath);
    const stats = await lstat(absolutePath);
    if (stats.isFile()) {
      return absolutePath;
    } else {
      throw new Error('Provided path is not a file');
    }
  } catch (err) {
    throw new Error(`Invalid path: ${err.message}`);
  }
};

const unzipFile = async (zipPath, outputPath) => {
  const unzipper = require('unzipper');

  try {
    await fs.createReadStream(zipPath)
      .pipe(unzipper.Extract({ path: outputPath }))
      .promise();
    console.log(`Unzipped ${zipPath} successfully to ${outputPath}`);
  } catch (err) {
    console.error('An error occurred while unzipping:', err.message);
  }
};

const unzipNestedZips = async (directory) => {
  const items = await readdir(directory);

  for (const item of items) {
    const itemPath = path.join(directory, item);
    const stats = await lstat(itemPath);

    if (stats.isFile() && isZip(itemPath)) {
      const nestedOutputDir = path.join(directory, path.basename(itemPath, '.zip'));
      if (!fs.existsSync(nestedOutputDir)) {
        fs.mkdirSync(nestedOutputDir, { recursive: true });
      }
      await unzipFile(itemPath, nestedOutputDir);
      await unzipNestedZips(nestedOutputDir);
    }
  }
};

const showHelp = () => {
  console.log(`
    Usage: node ${PROGRAM_NAME}.js <zip-file-path> <output-directory>

    Arguments:
      <zip-file-path>     Path to the zip file you want to unzip.
      <output-directory>  Directory where the contents will be extracted.

    Options:
      -h, --help          Show this help message and exit.
      -v, --version       Show the version of the script.

    Examples:
      node ${PROGRAM_NAME}.js /path/to/your/file.zip /path/to/output/directory
      node ${PROGRAM_NAME}.js -h
  `);
};

const MAIN = async () => {
  const args = process.argv.slice(2);

  if (args.hasCommonElements(FLAGS.HELP)) {
    showHelp();
    process.exit(0);
  }

  if (args.hasCommonElements(FLAGS.VERSION)) {
    console.log(`Version: ${VERSION}`);
    process.exit(0);
  }

  const [zipLocation, outputDirectory] = args;

  if (!zipLocation || !outputDirectory) {
    console.log('Error: Both zip file path and output directory must be provided.');
    console.log('Use --help or -h for usage information.');
    process.exit(1);
  }

  if (!isZip(zipLocation)) {
    console.log('Provided file is not a .zip file');
    process.exit(1);
  }

  try {
    const validZipPath = await validatePath(zipLocation);

    if (!fs.existsSync(outputDirectory)) {
      console.log('Output directory does not exist. Creating it...');
      fs.mkdirSync(outputDirectory, { recursive: true });
    }

    await unzipFile(validZipPath, outputDirectory);
    await unzipNestedZips(outputDirectory);
  } catch (err) {
    console.error(err.message);
    process.exit(1);
  }
};

MAIN();
