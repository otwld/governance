import assert from 'node:assert/strict';
import { mkdtemp, mkdir, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { dependencyUpdateArgv, executeDependencyUpdate } from '../lib/dependency-update.mjs';

/** Create an isolated package workspace whose manager, dependency class, pin, and package identity are independently selectable. */
async function fixture(t, { manager = 'npm', section = 'dependencies', packageManager, packageName = 'safe-package' } = {}) {
  const root = await mkdtemp(join(tmpdir(), 'governance-dependency-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const packageDirectory = '.';
  const pin = packageManager ?? `${manager}@${manager === 'yarn' ? '4.1.0' : '10.1.0'}`;
  const manifest = { name: 'app', [section]: { [packageName]: '1.0.0' }, packageManager: pin };
  await writeFile(join(root, 'package.json'), JSON.stringify(manifest));
  const lock = manager === 'npm' ? 'package-lock.json' : manager === 'pnpm' ? 'pnpm-lock.yaml' : manager === 'yarn' ? 'yarn.lock' : 'bun.lock';
  await writeFile(join(root, lock), 'lock\n');
  return { root, packageDirectory, manifestPath: join(root, 'package.json') };
}

/** Return successful Git, version, and metadata-update evidence without network access. */
function successfulSpawn(version) {
  return async (argv) => ({ argv, exitCode: 0, stdout: argv.includes('--version') ? version : '', stderr: '' });
}

/** Prevents manager-specific argv from enabling scripts or accepting non-exact dependency targets. */
test('dependency argv supports exact npm, pnpm, and Yarn Berry metadata updates only', () => {
  const base = { package: '@scope/pkg', target: '1.2.3-beta.1+build.5', dev: true };
  assert.deepEqual(dependencyUpdateArgv({ ...base, manager: 'npm' }), ['npm', 'install', '@scope/pkg@1.2.3-beta.1+build.5', '--save-exact', '--package-lock-only', '--ignore-scripts', '--save-dev']);
  assert.deepEqual(dependencyUpdateArgv({ ...base, manager: 'pnpm' }), ['corepack', 'pnpm', 'add', '@scope/pkg@1.2.3-beta.1+build.5', '--save-exact', '--lockfile-only', '--ignore-scripts', '--save-dev']);
  assert.deepEqual(dependencyUpdateArgv({ ...base, manager: 'yarn' }), ['corepack', 'yarn', 'add', '@scope/pkg@1.2.3-beta.1+build.5', '--exact', '--mode=update-lockfile', '--dev']);
  assert.equal(dependencyUpdateArgv({ ...base, manager: 'bun' }), undefined);
});

/** Guards the production-dependency class and trusted working-directory boundary across both subprocesses. */
test('npm integration preserves an existing production dependency and trusted cwd', async (t) => {
  const workspace = await fixture(t);
  const calls = [];
  /** The command adapter captures cwd evidence while avoiding an actual package-manager mutation. */
  const result = await executeDependencyUpdate({ action: 'update', manager: 'npm', package: 'safe-package', target: '1.2.3', dev: false, ...workspace }, async (argv, options) => {
    calls.push({ argv, options }); return { argv, exitCode: 0, stdout: argv.includes('--version') ? '10.1.0' : '', stderr: '' };
  });
  assert.equal(result.status, 'succeeded');
  assert.deepEqual(calls[0].argv, ['git', 'ls-files', '--error-unmatch', '--', 'package-lock.json']);
  assert.equal(calls[0].options.cwd, workspace.root);
  assert.equal(calls[1].options.cwd, workspace.root);
  assert.deepEqual(calls[1].argv, ['npm', '--version']);
  assert.equal(calls[2].options.cwd, workspace.root);
});

/** Prevents an approved development dependency update from silently moving into production dependencies. */
test('development dependencies retain their class and exact dev argv', async (t) => {
  const workspace = await fixture(t, { section: 'devDependencies' });
  const calls = [];
  /** This successful adapter exposes the generated dev flag for an independent assertion. */
  const result = await executeDependencyUpdate({ action: 'update', manager: 'npm', package: 'safe-package', target: '1.2.3', dev: true, ...workspace }, async (argv) => { calls.push(argv); return { argv, exitCode: 0, stdout: argv.includes('--version') ? '10.1.0' : '', stderr: '' }; });
  assert.equal(result.status, 'succeeded');
  assert.ok(calls[2].includes('--save-dev'));
});

/** Exercises metadata gates that prevent writes under the wrong manager, class, or untracked lockfile. */
test('manager identity, Yarn generation, dependency class, and committed lockfile are enforced', async (t) => {
  const npm = await fixture(t);
  const base = { action: 'update', package: 'safe-package', target: '1.2.3', dev: false, ...npm };
  assert.equal((await executeDependencyUpdate({ ...base, manager: 'pnpm' }, assert.fail)).status, 'rejected');
  assert.equal((await executeDependencyUpdate({ ...base, manager: 'npm', dev: true }, assert.fail)).status, 'rejected');
  const untracked = await executeDependencyUpdate({ ...base, manager: 'npm' }, async (argv) => ({ argv, exitCode: 1, stdout: '', stderr: '' }));
  assert.equal(untracked.status, 'rejected');
  const mismatchCalls = [];
  const mismatch = await executeDependencyUpdate({ ...base, manager: 'npm' }, async (argv) => { mismatchCalls.push(argv); return { argv, exitCode: 0, stdout: argv.includes('--version') ? '9.0.0' : '', stderr: '' }; });
  assert.equal(mismatch.status, 'rejected');
  assert.equal(mismatchCalls.length, 2);
  const unavailable = await executeDependencyUpdate({ ...base, manager: 'npm' }, async (argv) => ({ argv, exitCode: argv.includes('--version') ? 1 : 0, stdout: '', stderr: '' }));
  assert.equal(unavailable.status, 'rejected');
  const yarnClassic = await fixture(t, { manager: 'yarn', packageManager: 'yarn@1.22.0' });
  assert.equal((await executeDependencyUpdate({ action: 'update', manager: 'yarn', package: 'safe-package', target: '2.0.0', dev: false, ...yarnClassic }, assert.fail)).status, 'rejected');
  const yarnBerry = await fixture(t, { manager: 'yarn', packageManager: 'yarn@4.1.0' });
  const berry = await executeDependencyUpdate({ action: 'update', manager: 'yarn', package: 'safe-package', target: '2.0.0', dev: false, ...yarnBerry }, async (argv) => ({ argv, exitCode: 0, stdout: argv.includes('--version') ? '4.1.0' : '', stderr: '' }));
  assert.equal(berry.status, 'succeeded');
  const absent = await fixture(t);
  await writeFile(absent.manifestPath, JSON.stringify({ name: 'app', dependencies: { 'safe-package': '1.0.0' } }));
  assert.equal((await executeDependencyUpdate({ action: 'update', manager: 'npm', package: 'safe-package', target: '2.0.0', dev: false, ...absent }, assert.fail)).status, 'rejected');
  const prefixed = await fixture(t);
  await writeFile(prefixed.manifestPath, JSON.stringify({ name: 'app', packageManager: 'npm@^10.1.0', dependencies: { 'safe-package': '1.0.0' } }));
  assert.equal((await executeDependencyUpdate({ action: 'update', manager: 'npm', package: 'safe-package', target: '2.0.0', dev: false, ...prefixed }, assert.fail)).status, 'rejected');
  assert.equal((await executeDependencyUpdate({ action: 'update', manager: 'npm', package: 'safe-package', target: '2.0.0', dev: false, ...npm, packageDirectory: 'packages/app' }, assert.fail)).status, 'rejected');
});

/** Guards unsupported dependency ownership and filesystem cases before any package-manager execution. */
test('undeclared, peer, optional, override, Bun, and path escapes are rejected', async (t) => {
  for (const section of ['peerDependencies', 'optionalDependencies']) {
    const workspace = await fixture(t, { section });
    const result = await executeDependencyUpdate({ action: 'update', manager: 'npm', package: 'safe-package', target: '1.2.3', dev: false, ...workspace }, assert.fail);
    assert.equal(result.status, 'rejected');
  }
  const override = await fixture(t);
  await writeFile(override.manifestPath, JSON.stringify({ name: 'app', dependencies: { 'safe-package': '1.0.0' }, overrides: { 'safe-package': '1.0.1' } }));
  assert.equal((await executeDependencyUpdate({ action: 'update', manager: 'npm', package: 'safe-package', target: '1.2.3', dev: false, ...override }, assert.fail)).status, 'rejected');
  for (const declaration of ['npm:other@1.0.0', 'workspace:*', 'catalog:default', 'file:../pkg', 'link:../pkg', 'portal:../pkg', 'patch:pkg@1.0.0#x', 'git+https://x', 'git@github.com:x/y', 'ssh://x', 'https://x', 'github:x/y', 'owner/repo', '../pkg', '/tmp/pkg']) {
    const protocol = await fixture(t);
    await writeFile(protocol.manifestPath, JSON.stringify({ name: 'app', packageManager: 'npm@10.1.0', dependencies: { 'safe-package': declaration } }));
    assert.equal((await executeDependencyUpdate({ action: 'update', manager: 'npm', package: 'safe-package', target: '1.2.3', dev: false, ...protocol }, assert.fail)).status, 'rejected', declaration);
  }
  const bun = await fixture(t, { manager: 'bun' });
  assert.equal((await executeDependencyUpdate({ action: 'update', manager: 'bun', package: 'safe-package', target: '1.2.3', dev: false, ...bun }, assert.fail)).status, 'rejected');
  const outside = await mkdtemp(join(tmpdir(), 'governance-outside-')); t.after(() => rm(outside, { recursive: true, force: true }));
  const root = await mkdtemp(join(tmpdir(), 'governance-root-')); t.after(() => rm(root, { recursive: true, force: true }));
  await symlink(outside, join(root, 'escape'));
  assert.equal((await executeDependencyUpdate({ action: 'update', manager: 'npm', package: 'safe-package', target: '1.2.3', dev: false, root, packageDirectory: 'escape' }, assert.fail)).status, 'rejected');
});

/** Proves unbounded or command-like package inputs cannot cross the subprocess boundary. */
test('ranges, tags, injection, and malformed actions fail before spawn', async (t) => {
  const workspace = await fixture(t);
  const base = { action: 'update', manager: 'npm', package: 'safe-package', target: '1.2.3', dev: false, ...workspace };
  for (const input of [{ ...base, target: '^1.2.3' }, { ...base, target: 'latest' }, { ...base, target: '1.2.3-01' }, { ...base, target: '1.2.3-alpha..1' }, { ...base, target: '1.2.3+' }, { ...base, target: '1.2.3-alpha.' }, { ...base, package: '--help' }, { ...base, action: 'preview' }]) assert.equal((await executeDependencyUpdate(input, assert.fail)).status, 'rejected');
});

/** Prevents a nested lockfile from authorizing package metadata writes for the project root. */
test('lockfile authority is accepted only at the project root', async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'governance-lock-root-')); t.after(() => rm(root, { recursive: true, force: true }));
  await writeFile(join(root, 'package.json'), JSON.stringify({ name: 'app', packageManager: 'npm@10.1.0', dependencies: { 'safe-package': '1.0.0' } }));
  const nested = join(root, 'nested');
  await mkdir(nested); await writeFile(join(nested, 'package-lock.json'), '{}');
  const result = await executeDependencyUpdate({ action: 'update', manager: 'npm', package: 'safe-package', target: '1.2.3', dev: false, root, packageDirectory: '.' }, assert.fail);
  assert.equal(result.status, 'rejected');
  assert.match(result.diagnostics.join('\n'), /root lockfile/);
});

/** Covers manager selector grammars and nested maps without rejecting unrelated overrides. */
test('override detection recursively matches package selectors only', async (t) => {
  /** Positive cases cover direct, version-qualified, nested, glob, and parent-selector ownership forms. */
  const cases = [
    { overrides: { 'safe-package': '2.0.0' } },
    { overrides: { 'safe-package@^1.0.0': '2.0.0' } },
    { overrides: { parent: { 'safe-package': '2.0.0' } } },
    { resolutions: { '**/safe-package': '2.0.0' } },
    { resolutions: { 'parent/safe-package': '2.0.0' } },
    { resolutions: { '@scope/parent/safe-package': '2.0.0' } },
    { pnpm: { overrides: { 'parent>safe-package': '2.0.0' } } },
  ];
  for (const managerMap of cases) {
    const workspace = await fixture(t);
    await writeFile(workspace.manifestPath, JSON.stringify({ name: 'app', packageManager: 'npm@10.1.0', dependencies: { 'safe-package': '1.0.0' }, ...managerMap }));
    const result = await executeDependencyUpdate({ action: 'update', manager: 'npm', package: 'safe-package', target: '2.0.0', dev: false, ...workspace }, assert.fail);
    assert.equal(result.status, 'rejected', JSON.stringify(managerMap));
    assert.match(result.diagnostics.join('\n'), /override-managed/);
  }
  /** Unrelated nested selectors are the independent false-positive oracle. */
  const unrelated = await fixture(t);
  await writeFile(unrelated.manifestPath, JSON.stringify({ name: 'app', packageManager: 'npm@10.1.0', dependencies: { 'safe-package': '1.0.0' }, overrides: { other: { child: '2.0.0' } }, resolutions: { '**/unrelated': '3.0.0' }, pnpm: { overrides: { 'parent>different': '4.0.0' } } }));
  const allowed = await executeDependencyUpdate({ action: 'update', manager: 'npm', package: 'safe-package', target: '2.0.0', dev: false, ...unrelated }, successfulSpawn('10.1.0'));
  assert.equal(allowed.status, 'succeeded');

  /** A scoped exact selector must not claim an unrelated unscoped package with the same basename. */
  const unscoped = await fixture(t);
  await writeFile(unscoped.manifestPath, JSON.stringify({ name: 'app', packageManager: 'npm@10.1.0', dependencies: { 'safe-package': '1.0.0' }, overrides: { '@scope/safe-package': '2.0.0' } }));
  assert.equal((await executeDependencyUpdate({ action: 'update', manager: 'npm', package: 'safe-package', target: '2.0.0', dev: false, ...unscoped }, successfulSpawn('10.1.0'))).status, 'succeeded');

  /** Conversely, an unscoped exact selector must not claim the scoped package. */
  const scoped = await fixture(t, { packageName: '@scope/safe-package' });
  await writeFile(scoped.manifestPath, JSON.stringify({ name: 'app', packageManager: 'npm@10.1.0', dependencies: { '@scope/safe-package': '1.0.0' }, overrides: { 'safe-package': '2.0.0' } }));
  assert.equal((await executeDependencyUpdate({ action: 'update', manager: 'npm', package: '@scope/safe-package', target: '2.0.0', dev: false, ...scoped }, successfulSpawn('10.1.0'))).status, 'succeeded');

  /** Scoped version, path, glob, and parent selectors remain positive ownership evidence. */
  for (const selector of ['@scope/safe-package@^1.0.0', 'parent/@scope/safe-package', '**/@scope/safe-package', 'parent>@scope/safe-package']) {
    const selected = await fixture(t, { packageName: '@scope/safe-package' });
    await writeFile(selected.manifestPath, JSON.stringify({ name: 'app', packageManager: 'npm@10.1.0', dependencies: { '@scope/safe-package': '1.0.0' }, resolutions: { [selector]: '2.0.0' } }));
    const result = await executeDependencyUpdate({ action: 'update', manager: 'npm', package: '@scope/safe-package', target: '2.0.0', dev: false, ...selected }, assert.fail);
    assert.equal(result.status, 'rejected', selector);
  }
});

/** Integrity metadata remains in evidence while only recognized Corepack hashes are omitted from comparison. */
test('pnpm and Yarn integrity pins compare semantic versions without integrity metadata', async (t) => {
  /** The matrix binds each integrity-bearing descriptor to its runtime-visible semantic version. */
  for (const [manager, descriptor, runtime] of [
    ['pnpm', 'pnpm@10.1.0+sha224.aabbcc', '10.1.0'],
    ['pnpm', 'pnpm@10.1.0-beta.2+sha256.aabbcc', '10.1.0-beta.2'],
    ['yarn', 'yarn@4.1.0+sha384.cafebabe', '4.1.0'],
    ['yarn', 'yarn@4.1.0+sha512.deadbeef', '4.1.0'],
  ]) {
    const workspace = await fixture(t, { manager, packageManager: descriptor });
    const calls = [];
    const result = await executeDependencyUpdate({ action: 'update', manager, package: 'safe-package', target: '2.0.0', dev: false, ...workspace }, async (argv) => { calls.push(argv); return successfulSpawn(runtime)(argv); });
    assert.equal(result.status, 'succeeded', manager);
    assert.equal(result.packageManager, descriptor);
    assert.equal(result.versionEvidence.descriptorVersion, descriptor.slice(descriptor.indexOf('@') + 1));
    assert.equal(result.versionEvidence.version, runtime);
    assert.deepEqual(calls[1], ['corepack', manager, '--version']);
  }
  /** Ordinary SemVer build metadata remains executable identity and must not be stripped as integrity. */
  const generic = await fixture(t, { manager: 'pnpm', packageManager: 'pnpm@10.1.0+build.5' });
  const calls = [];
  const rejected = await executeDependencyUpdate({ action: 'update', manager: 'pnpm', package: 'safe-package', target: '2.0.0', dev: false, ...generic }, async (argv) => { calls.push(argv); return successfulSpawn('10.1.0')(argv); });
  assert.equal(rejected.status, 'rejected');
  assert.match(rejected.diagnostics.join('\n'), /does not match/);
  assert.equal(calls.length, 2);
});
