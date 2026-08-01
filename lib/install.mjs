import { createHash } from 'node:crypto';
import { mkdir, readFile, realpath, readdir, rename, rm, rmdir, stat, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export const DEFAULT_CONFIG_HOME = join(homedir(), '.config', 'opencode');
const OWNERSHIP = 'governance.assets.json';
const hash = (content) => createHash('sha256').update(content).digest('hex');

async function files(directory) {
  const result = [];
  for (const entry of (await readdir(directory, { withFileTypes: true })).sort((a, b) => a.name.localeCompare(b.name))) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) result.push(...await files(path));
    else if (entry.isFile()) result.push(path);
  }
  return result;
}

async function exists(path) { try { await stat(path); return true; } catch (error) { if (error.code === 'ENOENT') return false; throw error; } }
async function currentHash(path) { try { return hash(await readFile(path)); } catch (error) { if (error.code === 'ENOENT') return undefined; throw error; } }

async function ensureDirectory(directory, created, mkdirOperation) {
  const missing = [];
  let current = directory;
  while (!(await exists(current))) {
    missing.push(current);
    const parent = dirname(current);
    if (parent === current) break;
    current = parent;
  }
  for (const path of missing.toReversed()) {
    await mkdirOperation(path);
    created.add(path);
  }
}

function safeManagedPath(value) {
  return typeof value === 'string' && /^[A-Za-z0-9._-]+(?:\/[A-Za-z0-9._-]+)*$/.test(value) && !value.split('/').some((part) => part === '.' || part === '..');
}

function inside(root, target) {
  return target === root || target.startsWith(`${root}${sep}`);
}

async function containedDestination(configHome, managedPath) {
  if (!safeManagedPath(managedPath)) throw new Error(`invalid managed asset path: ${managedPath}`);
  const absoluteHome = resolve(configHome);
  const destination = resolve(absoluteHome, managedPath);
  if (!inside(absoluteHome, destination)) throw new Error(`managed asset escapes config home: ${managedPath}`);
  if (!(await exists(absoluteHome))) return destination;
  const realHome = await realpath(absoluteHome);
  let existing = destination;
  while (!(await exists(existing))) {
    const parent = dirname(existing);
    if (parent === existing) break;
    existing = parent;
  }
  if (await exists(existing)) {
    const realExisting = await realpath(existing);
    if (!inside(realHome, realExisting)) throw new Error(`managed asset resolves outside config home: ${managedPath}`);
  }
  return destination;
}

async function layout(sourceRoot, configHome) {
  const manifest = JSON.parse(await readFile(join(sourceRoot, 'governance.manifest.json'), 'utf8'));
  if (!Array.isArray(manifest.assets) || manifest.assets.length === 0 || manifest.assets.some((kind) => typeof kind !== 'string' || !/^[a-z][a-z0-9-]*$/.test(kind)) || new Set(manifest.assets).size !== manifest.assets.length) throw new Error('invalid distribution asset sources');
  const entries = [];
  for (const kind of manifest.assets) {
    const base = join(sourceRoot, kind);
    for (const source of await files(base)) {
      const rel = relative(base, source).split(sep).join('/');
      const managedPath = `${kind}/${rel}`;
      const destination = await containedDestination(configHome, managedPath);
      const content = await readFile(source);
      entries.push({ path: managedPath, kind, hash: hash(content), source, destination });
    }
  }
  return { entries, kinds: new Set(manifest.assets) };
}

async function ownership(configHome, kinds) {
  try {
    const ownershipPath = await containedDestination(configHome, OWNERSHIP);
    const value = JSON.parse(await readFile(ownershipPath, 'utf8'));
    if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).length !== 1 || !Array.isArray(value.assets)) throw new Error('must contain only an assets array');
    const paths = new Set();
    for (const [index, entry] of value.assets.entries()) {
      if (!entry || typeof entry !== 'object' || Array.isArray(entry) || Object.keys(entry).sort().join(',') !== 'hash,kind,path') throw new Error(`assets[${index}] must contain only path, kind, and hash`);
      if (!safeManagedPath(entry.path)) throw new Error(`assets[${index}].path is unsafe`);
      if (typeof entry.kind !== 'string' || !kinds.has(entry.kind) || entry.path.split('/')[0] !== entry.kind) throw new Error(`assets[${index}].kind is invalid`);
      if (!/^[a-f0-9]{64}$/.test(entry.hash ?? '')) throw new Error(`assets[${index}].hash is invalid`);
      if (paths.has(entry.path)) throw new Error(`assets[${index}].path is duplicated`);
      paths.add(entry.path);
      await containedDestination(configHome, entry.path);
    }
    return value.assets;
  } catch (error) { if (error.code === 'ENOENT') return []; throw new Error(`invalid ownership manifest: ${error.message}`); }
}

export async function planGlobalInstall({ sourceRoot = ROOT, configHome = DEFAULT_CONFIG_HOME } = {}) {
  sourceRoot = resolve(sourceRoot); configHome = resolve(configHome);
  const desiredLayout = await layout(sourceRoot, configHome);
  const desired = desiredLayout.entries;
  const prior = await ownership(configHome, desiredLayout.kinds);
  const priorByPath = new Map(prior.map((entry) => [entry.path, entry]));
  const desiredPaths = new Set(desired.map((entry) => entry.path));
  const entries = [];
  for (const entry of desired) {
    const actual = await currentHash(entry.destination);
    const old = priorByPath.get(entry.path);
    const status = actual === undefined ? 'write' : actual === entry.hash ? 'identical' : old && actual === old.hash ? 'replace' : 'conflict';
    entries.push({ ...entry, status });
  }
  for (const old of prior) if (!desiredPaths.has(old.path)) {
    const destination = await containedDestination(configHome, old.path);
    const actual = await currentHash(destination);
    entries.push({ ...old, destination, status: actual === undefined ? 'identical' : actual === old.hash ? 'remove' : 'conflict' });
  }
  return { sourceRoot, configHome, ownershipPath: await containedDestination(configHome, OWNERSHIP), entries, conflicts: entries.filter((entry) => entry.status === 'conflict') };
}

export async function installGlobal({ apply = false, writeFile: write = writeFile, rename: move = rename, rm: remove = rm, mkdir: makeDirectory = mkdir, rmdir: removeDirectory = rmdir, ...options } = {}) {
  const plan = await planGlobalInstall(options);
  if (!apply || plan.conflicts.length) return { ...plan, applied: false, changed: [] };
  const touched = plan.entries.filter((entry) => ['write', 'replace', 'remove'].includes(entry.status));
  const previous = new Map();
  const manifestExisted = await exists(plan.ownershipPath);
  if (manifestExisted) previous.set(plan.ownershipPath, await readFile(plan.ownershipPath));
  for (const entry of touched) if (await exists(entry.destination)) previous.set(entry.destination, await readFile(entry.destination));
  const created = [];
  const temporaries = [];
  const createdDirectories = new Set();
  try {
    for (const entry of touched) {
      await ensureDirectory(dirname(entry.destination), createdDirectories, makeDirectory);
      if (entry.status === 'remove') await remove(entry.destination);
      else {
        const temporary = `${entry.destination}.governance-${process.pid}.tmp`;
        temporaries.push(temporary);
        await write(temporary, await readFile(entry.source));
        await move(temporary, entry.destination);
        if (!previous.has(entry.destination)) created.push(entry.destination);
      }
    }
    await ensureDirectory(dirname(plan.ownershipPath), createdDirectories, makeDirectory);
    const assets = plan.entries.filter((entry) => entry.source).map(({ path, kind, hash }) => ({ path, kind, hash })).sort((a, b) => a.path.localeCompare(b.path));
    const temporary = `${plan.ownershipPath}.governance-${process.pid}.tmp`;
    temporaries.push(temporary);
    await write(temporary, `${JSON.stringify({ assets }, null, 2)}\n`);
    await move(temporary, plan.ownershipPath);
  } catch (error) {
    const failures = [];
    for (const path of temporaries.toReversed()) try { await remove(path, { force: true }); } catch (failure) { failures.push(failure); }
    for (const path of [...created, ...(!manifestExisted ? [plan.ownershipPath] : [])].toReversed()) try { await remove(path, { force: true }); } catch (failure) { failures.push(failure); }
    for (const [path, content] of previous) try { await write(path, content); } catch (failure) { failures.push(failure); }
    const residualPaths = [];
    for (const directory of [...createdDirectories].sort((a, b) => b.split(sep).length - a.split(sep).length || b.localeCompare(a))) {
      try { await removeDirectory(directory); }
      catch (failure) {
        if (failure.code !== 'ENOENT') {
          failures.push(failure);
          if (await exists(directory)) residualPaths.push(directory);
        }
      }
    }
    if (failures.length) {
      const rollbackError = new AggregateError(failures, `Install failed: ${error.message}; rollback incomplete; residual paths: ${residualPaths.join(', ') || 'unknown'}`, { cause: error });
      rollbackError.residualPaths = residualPaths;
      throw rollbackError;
    }
    throw error;
  }
  return { ...plan, applied: true, changed: touched.map((entry) => entry.destination) };
}
