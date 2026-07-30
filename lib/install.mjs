import { constants } from 'node:fs';
import { copyFile, mkdir, readFile, readdir, rmdir, stat, unlink } from 'node:fs/promises';
import { homedir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const DISTRIBUTION_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

export const DEFAULT_CONFIG_HOME = join(homedir(), '.config', 'opencode');
export const DEFAULT_SKILLS_HOME = '/workspace/skills/skills';

async function addTopLevelMarkdownFiles(sourceDirectory, destinationDirectory, files) {
  const entries = await readdir(sourceDirectory, { withFileTypes: true });
  for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
    if (!entry.isFile() || !entry.name.endsWith('.md')) continue;
    files.push({
      source: join(sourceDirectory, entry.name),
      destination: join(destinationDirectory, entry.name),
    });
  }
}

async function addDirectoryFiles(sourceDirectory, destinationDirectory, files, directories) {
  directories.add(destinationDirectory);
  const entries = await readdir(sourceDirectory, { withFileTypes: true });
  for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
    const source = join(sourceDirectory, entry.name);
    const destination = join(destinationDirectory, entry.name);
    if (entry.isDirectory()) {
      await addDirectoryFiles(source, destination, files, directories);
    } else if (entry.isFile()) {
      files.push({ source, destination });
    } else {
      throw new Error(`unsupported source entry: ${source}`);
    }
  }
}

async function buildLayout({ sourceRoot, configHome, skillsHome }) {
  const files = [];
  const agentHome = join(configHome, 'agents');
  const commandHome = join(configHome, 'commands');
  const directories = new Set([agentHome, commandHome, skillsHome]);

  await addTopLevelMarkdownFiles(join(sourceRoot, 'agents'), agentHome, files);
  await addTopLevelMarkdownFiles(join(sourceRoot, 'commands'), commandHome, files);
  await addDirectoryFiles(join(sourceRoot, 'skills'), skillsHome, files, directories);

  return {
    files,
    directories: [...directories].sort((a, b) => a.localeCompare(b)),
  };
}

async function destinationFileStatus(source, destination) {
  const sourceContent = await readFile(source);
  try {
    const destinationContent = await readFile(destination);
    return destinationContent.equals(sourceContent) ? 'identical' : 'conflict';
  } catch (error) {
    if (error.code === 'ENOENT') return 'write';
    return 'conflict';
  }
}

function directoryDepth(directory) {
  let depth = 0;
  let current = directory;
  while (dirname(current) !== current) {
    depth += 1;
    current = dirname(current);
  }
  return depth;
}

function destinationDirectoryHierarchy(directories) {
  const hierarchy = new Set();
  for (const directory of directories) {
    let current = directory;
    while (!hierarchy.has(current)) {
      hierarchy.add(current);
      const parent = dirname(current);
      if (parent === current) break;
      current = parent;
    }
  }
  return [...hierarchy].sort(
    (a, b) => directoryDepth(a) - directoryDepth(b) || a.localeCompare(b),
  );
}

export async function planGlobalInstall({
  sourceRoot = DISTRIBUTION_ROOT,
  configHome = DEFAULT_CONFIG_HOME,
  skillsHome = DEFAULT_SKILLS_HOME,
} = {}) {
  const locations = {
    sourceRoot: resolve(sourceRoot),
    configHome: resolve(configHome),
    skillsHome: resolve(skillsHome),
  };
  const layout = await buildLayout(locations);
  const conflicts = [];

  for (const directory of layout.directories) {
    try {
      const info = await stat(directory);
      if (!info.isDirectory()) {
        conflicts.push({ destination: directory, reason: 'destination is not a directory' });
      }
    } catch (error) {
      if (error.code !== 'ENOENT') {
        conflicts.push({ destination: directory, reason: `cannot inspect destination: ${error.message}` });
      }
    }
  }

  const destinations = new Set();
  const entries = [];
  for (const file of layout.files) {
    if (destinations.has(file.destination)) {
      conflicts.push({ destination: file.destination, reason: 'multiple sources target this path' });
      continue;
    }
    destinations.add(file.destination);

    const status = await destinationFileStatus(file.source, file.destination);
    entries.push({ ...file, status });
    if (status === 'conflict') {
      conflicts.push({ destination: file.destination, reason: 'destination differs from source' });
    }
  }

  return { ...locations, directories: layout.directories, entries, conflicts };
}

export async function installGlobal({
  apply = false,
  copyFile: copyFileOperation = copyFile,
  mkdir: mkdirOperation = mkdir,
  rmdir: rmdirOperation = rmdir,
  unlink: unlinkOperation = unlink,
  ...options
} = {}) {
  const plan = await planGlobalInstall(options);
  if (!apply || plan.conflicts.length > 0) {
    return { ...plan, applied: false, written: [] };
  }

  const absentDirectories = [];
  for (const directory of destinationDirectoryHierarchy(plan.directories)) {
    try {
      await stat(directory);
    } catch (error) {
      if (error.code === 'ENOENT') {
        absentDirectories.push(directory);
      } else {
        throw error;
      }
    }
  }

  const written = [];
  const createdDirectories = new Set();
  try {
    for (const directory of absentDirectories) {
      try {
        await mkdirOperation(directory);
        createdDirectories.add(directory);
      } catch (error) {
        try {
          const info = await stat(directory);
          if (info.isDirectory()) createdDirectories.add(directory);
        } catch {
          // The failed mkdir did not leave a directory at this path.
        }
        throw error;
      }
    }

    for (const entry of plan.entries) {
      if (entry.status !== 'write') continue;
      await copyFileOperation(entry.source, entry.destination, constants.COPYFILE_EXCL);
      written.push(entry.destination);
    }
  } catch (error) {
    const cleanupFailures = [];
    const filesToRemove = written.toReversed();
    for (const destination of filesToRemove) {
      try {
        await unlinkOperation(destination);
      } catch (cleanupError) {
        if (cleanupError.code !== 'ENOENT') {
          cleanupFailures.push(cleanupError);
        }
      }
    }

    const directoriesToRemove = [...createdDirectories].sort(
      (a, b) => directoryDepth(b) - directoryDepth(a) || b.localeCompare(a),
    );
    for (const directory of directoriesToRemove) {
      try {
        await rmdirOperation(directory);
      } catch (cleanupError) {
        if (cleanupError.code !== 'ENOENT') {
          cleanupFailures.push(cleanupError);
        }
      }
    }

    const residualPaths = [];
    for (const path of [...filesToRemove, ...directoriesToRemove]) {
      try {
        await stat(path);
        residualPaths.push(path);
      } catch (inspectionError) {
        if (inspectionError.code !== 'ENOENT') {
          cleanupFailures.push(inspectionError);
          residualPaths.push(path);
        }
      }
    }

    if (cleanupFailures.length > 0 || residualPaths.length > 0) {
      const failureMessage = error instanceof Error ? error.message : String(error);
      const rollbackError = new AggregateError(
        cleanupFailures,
        `Apply failed: ${failureMessage}; rollback failed; residual paths: ${residualPaths.join(', ')}`,
        { cause: error },
      );
      rollbackError.residualPaths = residualPaths;
      throw rollbackError;
    }

    throw error;
  }

  return { ...plan, applied: true, written };
}
