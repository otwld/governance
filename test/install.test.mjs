import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { access, mkdtemp, mkdir, readFile, rm, rmdir, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { installGlobal, planGlobalInstall } from '../lib/install.mjs';

const hash = (value) => createHash('sha256').update(value).digest('hex');

async function fixture(t) {
  const root = await mkdtemp(join(tmpdir(), 'governance-install-')); t.after(() => rm(root, { recursive: true, force: true }));
  const sourceRoot = join(root, 'source'); const configHome = join(root, 'config');
  for (const dir of ['agents', 'commands', 'skills/check', 'tools']) await mkdir(join(sourceRoot, dir), { recursive: true });
  await writeFile(join(sourceRoot, 'governance.manifest.json'), JSON.stringify({ assets: ['agents', 'commands', 'skills', 'tools'] }));
  await writeFile(join(sourceRoot, 'agents/a.md'), 'agent one\n'); await writeFile(join(sourceRoot, 'commands/c.md'), 'command\n'); await writeFile(join(sourceRoot, 'skills/check/SKILL.md'), 'skill\n'); await writeFile(join(sourceRoot, 'tools/t.js'), 'tool\n');
  return { sourceRoot, configHome };
}

test('dry run and first apply write standard config-home assets and ownership records', async (t) => {
  const options = await fixture(t); const plan = await planGlobalInstall(options);
  assert.ok(plan.entries.every((entry) => entry.status === 'write'));
  assert.equal((await installGlobal(options)).applied, false);
  await assert.rejects(access(options.configHome), { code: 'ENOENT' });
  const result = await installGlobal({ ...options, apply: true });
  assert.equal(result.changed.length, 4);
  assert.equal(await readFile(join(options.configHome, 'skills/check/SKILL.md'), 'utf8'), 'skill\n');
  const ownership = JSON.parse(await readFile(join(options.configHome, 'governance.assets.json'), 'utf8'));
  assert.deepEqual(Object.keys(ownership.assets[0]), ['path', 'kind', 'hash']);
});

test('managed unchanged files replace and removed assets delete', async (t) => {
  const options = await fixture(t); await installGlobal({ ...options, apply: true });
  await writeFile(join(options.sourceRoot, 'agents/a.md'), 'agent two\n');
  await rm(join(options.sourceRoot, 'commands/c.md'));
  const plan = await planGlobalInstall(options);
  assert.equal(plan.entries.find((x) => x.path === 'agents/a.md').status, 'replace');
  assert.equal(plan.entries.find((x) => x.path === 'commands/c.md').status, 'remove');
  await installGlobal({ ...options, apply: true });
  assert.equal(await readFile(join(options.configHome, 'agents/a.md'), 'utf8'), 'agent two\n');
  await assert.rejects(access(join(options.configHome, 'commands/c.md')), { code: 'ENOENT' });
});

test('local modifications conflict and are never overwritten or deleted', async (t) => {
  const options = await fixture(t); await installGlobal({ ...options, apply: true });
  const target = join(options.configHome, 'agents/a.md'); await writeFile(target, 'local\n'); await writeFile(join(options.sourceRoot, 'agents/a.md'), 'new\n');
  const result = await installGlobal({ ...options, apply: true });
  assert.equal(result.applied, false); assert.equal(result.conflicts[0].status, 'conflict'); assert.equal(await readFile(target, 'utf8'), 'local\n');
});

test('apply failure restores replaced and removed managed files', async (t) => {
  const options = await fixture(t); await installGlobal({ ...options, apply: true });
  await writeFile(join(options.sourceRoot, 'agents/a.md'), 'agent two\n'); await rm(join(options.sourceRoot, 'commands/c.md'));
  let failed = false;
  await writeFile(join(options.sourceRoot, 'skills/check/SKILL.md'), 'skill two\n');
  await assert.rejects(installGlobal({ ...options, apply: true, writeFile: async (path, data) => { if (!failed && path.includes('skills/check/SKILL.md')) { failed = true; throw new Error('injected'); } await writeFile(path, data); } }), /injected/);
  assert.equal(await readFile(join(options.configHome, 'agents/a.md'), 'utf8'), 'agent one\n');
  assert.equal(await readFile(join(options.configHome, 'commands/c.md'), 'utf8'), 'command\n');
});

test('first-install failure removes files and directories created by apply', async (t) => {
  const options = await fixture(t);
  let writes = 0;
  await assert.rejects(installGlobal({ ...options, apply: true, writeFile: async (path, data) => { writes += 1; if (writes === 2) throw new Error('first install failed'); await writeFile(path, data); } }), /first install failed/);
  await assert.rejects(access(options.configHome), { code: 'ENOENT' });
});

test('rollback reports created directories that could not be removed', async (t) => {
  const options = await fixture(t);
  let writes = 0;
  await assert.rejects(
    installGlobal({
      ...options,
      apply: true,
      writeFile: async (path, data) => { writes += 1; if (writes === 2) throw new Error('apply failed'); await writeFile(path, data); },
      rmdir: async (directory) => { if (directory === options.configHome) throw new Error('directory cleanup failed'); await rmdir(directory); },
    }),
    (error) => {
      assert.ok(error instanceof AggregateError);
      assert.deepEqual(error.residualPaths, [options.configHome]);
      assert.match(error.message, /rollback incomplete; residual paths:/);
      return true;
    },
  );
});

test('ownership manifest rejects malformed, unsafe, and duplicate entries', async (t) => {
  const options = await fixture(t);
  await mkdir(options.configHome);
  const valid = { path: 'agents/a.md', kind: 'agents', hash: hash('agent one\n') };
  const cases = [
    [{ ...valid, extra: true }],
    [{ ...valid, path: '/tmp/outside' }],
    [{ ...valid, path: '../outside' }],
    [{ ...valid, path: 'agents\\outside' }],
    [{ ...valid, path: 'agents/a.md\n../outside' }],
    [{ ...valid, kind: 'tools' }],
    [{ ...valid, hash: 'bad' }],
    [valid, valid],
  ];
  for (const assets of cases) {
    await writeFile(join(options.configHome, 'governance.assets.json'), JSON.stringify({ assets }));
    await assert.rejects(planGlobalInstall(options), /invalid ownership manifest/);
  }
});

test('managed paths cannot resolve through a symlink outside config home', async (t) => {
  const options = await fixture(t);
  const outside = await mkdtemp(join(tmpdir(), 'governance-install-outside-')); t.after(() => rm(outside, { recursive: true, force: true }));
  await mkdir(options.configHome);
  await symlink(outside, join(options.configHome, 'agents'));
  await assert.rejects(planGlobalInstall(options), /resolves outside config home/);
});

test('ownership manifest itself cannot be read through an escaping symlink', async (t) => {
  const options = await fixture(t);
  const outside = await mkdtemp(join(tmpdir(), 'governance-ownership-outside-')); t.after(() => rm(outside, { recursive: true, force: true }));
  await mkdir(options.configHome);
  const outsideManifest = join(outside, 'assets.json');
  await writeFile(outsideManifest, JSON.stringify({ assets: [] }));
  await symlink(outsideManifest, join(options.configHome, 'governance.assets.json'));
  await assert.rejects(planGlobalInstall(options), /invalid ownership manifest: managed asset resolves outside config home/);
});
