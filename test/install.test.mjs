import assert from 'node:assert/strict';
import {
  access,
  copyFile,
  mkdtemp,
  mkdir,
  readFile,
  rm,
  rmdir,
  unlink,
  writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { installGlobal, planGlobalInstall } from '../lib/install.mjs';

async function fixture(t) {
  const root = await mkdtemp(join(tmpdir(), 'governance-install-'));
  t.after(() => rm(root, { recursive: true, force: true }));

  const sourceRoot = join(root, 'source');
  const configHome = join(root, 'config');
  const skillsHome = join(root, 'installed-skills');
  await mkdir(join(sourceRoot, 'agents'), { recursive: true });
  await mkdir(join(sourceRoot, 'commands'), { recursive: true });
  await mkdir(join(sourceRoot, 'skills', 'review', 'references'), { recursive: true });
  await writeFile(join(sourceRoot, 'agents', 'reviewer.md'), 'agent\n');
  await writeFile(join(sourceRoot, 'commands', 'review.md'), 'command\n');
  await writeFile(join(sourceRoot, 'skills', 'review', 'SKILL.md'), 'skill\n');
  await writeFile(join(sourceRoot, 'skills', 'review', 'references', 'guide.md'), 'guide\n');

  return { sourceRoot, configHome, skillsHome };
}

test('dry run plans every write without changing the destination', async (t) => {
  const options = await fixture(t);
  const plan = await planGlobalInstall(options);
  const result = await installGlobal(options);

  assert.equal(plan.entries.length, 4);
  assert.ok(plan.entries.every((entry) => entry.status === 'write'));
  assert.deepEqual(plan.conflicts, []);
  assert.equal(result.applied, false);
  assert.deepEqual(result.written, []);
  await assert.rejects(access(options.configHome), { code: 'ENOENT' });
  await assert.rejects(access(options.skillsHome), { code: 'ENOENT' });
});

test('apply creates directories and copies agents, commands, and complete skills', async (t) => {
  const options = await fixture(t);
  const result = await installGlobal({ ...options, apply: true });

  assert.equal(result.applied, true);
  assert.equal(result.written.length, 4);
  assert.equal(await readFile(join(options.configHome, 'agents', 'reviewer.md'), 'utf8'), 'agent\n');
  assert.equal(await readFile(join(options.configHome, 'commands', 'review.md'), 'utf8'), 'command\n');
  assert.equal(await readFile(join(options.skillsHome, 'review', 'SKILL.md'), 'utf8'), 'skill\n');
  assert.equal(
    await readFile(join(options.skillsHome, 'review', 'references', 'guide.md'), 'utf8'),
    'guide\n',
  );
});

test('reapplying an identical installation is idempotent', async (t) => {
  const options = await fixture(t);
  await installGlobal({ ...options, apply: true });
  const result = await installGlobal({ ...options, apply: true });

  assert.equal(result.applied, true);
  assert.deepEqual(result.written, []);
  assert.ok(result.entries.every((entry) => entry.status === 'identical'));
  assert.deepEqual(result.conflicts, []);
});

test('a differing destination is a conflict and prevents all writes', async (t) => {
  const options = await fixture(t);
  const conflictingFile = join(options.configHome, 'agents', 'reviewer.md');
  await mkdir(join(options.configHome, 'agents'), { recursive: true });
  await writeFile(conflictingFile, 'local customization\n');

  const result = await installGlobal({ ...options, apply: true });

  assert.equal(result.applied, false);
  assert.deepEqual(result.written, []);
  assert.deepEqual(result.conflicts, [
    { destination: conflictingFile, reason: 'destination differs from source' },
  ]);
  assert.equal(await readFile(conflictingFile, 'utf8'), 'local customization\n');
  await assert.rejects(access(join(options.configHome, 'commands')), { code: 'ENOENT' });
  await assert.rejects(access(options.skillsHome), { code: 'ENOENT' });
});

test('a later copy failure rolls back files written by the apply', async (t) => {
  const options = await fixture(t);
  let copyAttempts = 0;

  await assert.rejects(
    installGlobal({
      ...options,
      apply: true,
      copyFile: async (...arguments_) => {
        copyAttempts += 1;
        if (copyAttempts === 2) throw new Error('injected copy failure');
        await copyFile(...arguments_);
      },
      unlink,
    }),
    /injected copy failure/,
  );

  assert.equal(copyAttempts, 2);
  await assert.rejects(access(join(options.configHome, 'agents', 'reviewer.md')), {
    code: 'ENOENT',
  });
  await assert.rejects(access(join(options.configHome, 'commands', 'review.md')), {
    code: 'ENOENT',
  });
  await assert.rejects(access(join(options.skillsHome, 'review', 'SKILL.md')), {
    code: 'ENOENT',
  });
  await assert.rejects(access(options.configHome), { code: 'ENOENT' });
  await assert.rejects(access(options.skillsHome), { code: 'ENOENT' });
});

test('a directory creation failure removes only directories created by the apply', async (t) => {
  const options = await fixture(t);
  const failedDirectory = join(options.configHome, 'commands');
  await mkdir(options.configHome);

  await assert.rejects(
    installGlobal({
      ...options,
      apply: true,
      mkdir: async (directory) => {
        if (directory === failedDirectory) throw new Error('injected mkdir failure');
        await mkdir(directory);
      },
      rmdir,
    }),
    /injected mkdir failure/,
  );

  await access(options.configHome);
  await assert.rejects(access(join(options.configHome, 'agents')), { code: 'ENOENT' });
  await assert.rejects(access(options.skillsHome), { code: 'ENOENT' });
});

test('a rollback failure reports the residual paths precisely', async (t) => {
  const options = await fixture(t);
  const residualPath = join(options.configHome, 'agents', 'reviewer.md');
  const residualDirectory = join(options.configHome, 'agents');
  let copyAttempts = 0;

  await assert.rejects(
    installGlobal({
      ...options,
      apply: true,
      copyFile: async (...arguments_) => {
        copyAttempts += 1;
        if (copyAttempts === 2) throw new Error('injected copy failure');
        await copyFile(...arguments_);
      },
      unlink: async () => {
        throw new Error('injected unlink failure');
      },
    }),
    (error) => {
      assert.equal(
        error.message,
        `Apply failed: injected copy failure; rollback failed; residual paths: ${residualPath}, ${residualDirectory}, ${options.configHome}`,
      );
      assert.ok(error instanceof AggregateError);
      assert.deepEqual(error.residualPaths, [
        residualPath,
        residualDirectory,
        options.configHome,
      ]);
      return true;
    },
  );

  assert.equal(await readFile(residualPath, 'utf8'), 'agent\n');
  await assert.rejects(access(options.skillsHome), { code: 'ENOENT' });
});

test('a directory cleanup failure reports the residual directory', async (t) => {
  const options = await fixture(t);
  let copyAttempts = 0;

  await assert.rejects(
    installGlobal({
      ...options,
      apply: true,
      copyFile: async (...arguments_) => {
        copyAttempts += 1;
        if (copyAttempts === 2) throw new Error('injected copy failure');
        await copyFile(...arguments_);
      },
      rmdir: async (directory) => {
        if (directory === options.skillsHome) throw new Error('injected rmdir failure');
        await rmdir(directory);
      },
    }),
    (error) => {
      assert.ok(error instanceof AggregateError);
      assert.deepEqual(error.residualPaths, [options.skillsHome]);
      assert.match(error.message, new RegExp(`residual paths: ${options.skillsHome}$`));
      return true;
    },
  );

  await access(options.skillsHome);
  await assert.rejects(access(options.configHome), { code: 'ENOENT' });
});
