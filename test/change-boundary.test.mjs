import assert from 'node:assert/strict';
import test from 'node:test';
import { executeChangeBoundary } from '../lib/change-boundary.mjs';

/** Guards against producing review evidence when any worktree bytes fall outside the staged tree. */
test('stage inspection rejects unstaged and untracked bytes before hashing', async () => {
  /** These command doubles isolate each dirty-state gate without consulting the caller's repository. */
  const unstaged = await executeChangeBoundary({ action: 'stage-inspect', base: 'main' }, async (argv) => ({ argv, exitCode: argv[1] === 'diff' ? 1 : 0, stdout: '', stderr: '' }));
  assert.equal(unstaged.status, 'blocked');
  assert.equal(unstaged.stage, 'unstaged');
  const untracked = await executeChangeBoundary({ action: 'stage-inspect', base: 'main' }, async (argv) => ({ argv, exitCode: 0, stdout: argv[1] === 'ls-files' ? 'new-file.js\n' : '', stderr: '' }));
  assert.equal(untracked.status, 'blocked');
  assert.equal(untracked.stage, 'untracked');
  const empty = await executeChangeBoundary({ action: 'stage-inspect', base: 'main' }, async (argv) => ({ argv, exitCode: 0, stdout: '', stderr: '' }));
  assert.equal(empty.status, 'blocked');
  assert.equal(empty.stage, 'staged');
});

/** Proves the successful digest is bound to Git's resolved base commit and written index tree. */
test('stage inspection runs fixed argv and digests only the clean index tree', async () => {
  const calls = [];
  /** This spawn double records the security-sensitive argv sequence and supplies immutable OIDs. */
  const result = await executeChangeBoundary({ action: 'stage-inspect', base: 'origin/main' }, async (argv) => {
    calls.push(argv);
    const stdout = argv[1] === 'rev-parse' ? 'a'.repeat(40) : argv[1] === 'write-tree' ? 'b'.repeat(40) : '';
    const exitCode = argv[1] === 'diff' && argv.includes('--cached') ? 1 : 0;
    return { argv, exitCode, stdout, stderr: '' };
  });
  assert.equal(result.status, 'succeeded');
  assert.deepEqual(result.boundary, { baseCommit: 'a'.repeat(40), treeOid: 'b'.repeat(40) });
  assert.deepEqual(calls, [
    ['git', 'diff', '--quiet'],
    ['git', 'ls-files', '--others', '--exclude-standard'],
    ['git', 'diff', '--cached', '--quiet'],
    ['git', 'rev-parse', 'origin/main^{commit}'],
    ['git', 'diff', '--cached', '--quiet', 'a'.repeat(40), '--'],
    ['git', 'write-tree'],
  ]);
  assert.equal((await executeChangeBoundary({ action: 'stage-inspect', base: '--help' }, assert.fail)).status, 'rejected');
});
