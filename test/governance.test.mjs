import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { canonicalDigest, validateContract } from '../lib/contracts.mjs';
import { dependencyUpdateArgv } from '../lib/dependency-update.mjs';
import { planGlobalInstall } from '../lib/install.mjs';
import { loadProjectContext } from '../lib/project-context.mjs';
import { projectSingleSelect } from '../lib/project-items.mjs';
import { validateDistribution, validateProject } from '../lib/validation.mjs';

/** Repository root used by every distribution smoke check. */
const root = new URL('..', import.meta.url).pathname;

/** Extract one explicit flat permission from agent frontmatter. */
function permission(content, name) {
  return new RegExp(`^  ${name === '*' ? '"\\*"' : name}: (allow|deny)$`, 'm').exec(content)?.[1];
}

/** Proves the checked-in distribution and its own project contract load together. */
test('distribution and project validate', async () => {
  assert.deepEqual(await validateDistribution(root), []);
  assert.deepEqual(await validateProject(root), []);
});

/** Keeps flexible ordinary access while preserving ownership of durable custom tools. */
test('agents allow ordinary work and match custom-tool ownership', async () => {
  const manifest = JSON.parse(await readFile(join(root, 'governance.manifest.json'), 'utf8'));
  for (const name of Object.keys(manifest.agents)) {
    const content = await readFile(join(root, 'agents', `${name}.md`), 'utf8');
    assert.equal(permission(content, '*'), 'allow', name);
    for (const tool of manifest.tools) {
      assert.equal(permission(content, tool), manifest.toolAccess[tool].includes(name) ? 'allow' : 'deny', `${name}: ${tool}`);
    }
  }
});

/** Locks down deterministic canonical hashing and total malformed-contract rejection. */
test('contract primitives remain deterministic', () => {
  assert.equal(canonicalDigest({ b: 2, a: 1 }), canonicalDigest({ a: 1, b: 2 }));
  for (const kind of ['issue', 'plan', 'review', 'verification', 'blocker', 'checkpoint']) {
    assert.ok(validateContract(kind, {}).length > 0, kind);
  }
});

/** Verifies supported package managers receive exact metadata-only update arguments. */
test('dependency command construction stays bounded', () => {
  assert.deepEqual(dependencyUpdateArgv({ manager: 'npm', package: 'example', target: '1.2.3', dev: false }), ['npm', 'install', 'example@1.2.3', '--save-exact', '--package-lock-only', '--ignore-scripts']);
  assert.deepEqual(dependencyUpdateArgv({ manager: 'pnpm', package: 'example', target: '1.2.3', dev: true }), ['corepack', 'pnpm', 'add', 'example@1.2.3', '--save-exact', '--lockfile-only', '--ignore-scripts', '--save-dev']);
  assert.equal(dependencyUpdateArgv({ manager: 'bun', package: 'example', target: '1.2.3', dev: false }), undefined);
});

/** Rejects ambiguous Project field values rather than selecting by display name. */
test('Project select values require one immutable field match', () => {
  const value = { optionId: 'ready', name: 'Ready', field: { id: 'status', name: 'Status' } };
  assert.deepEqual(projectSingleSelect({ fieldValues: { nodes: [value] } }, 'status'), { optionId: 'ready', name: 'Ready', fieldName: 'Status' });
  assert.equal(projectSingleSelect({ fieldValues: { nodes: [value, value] } }, 'status'), undefined);
});

/** Confirms public tools can discover this repository's validated authority context. */
test('project context resolves from the current worktree', async () => {
  const context = await loadProjectContext(root);
  assert.equal(context.status, 'valid');
  assert.equal(context.root, root.replace(/\/$/, ''));
});

/** Exercises installation planning without mutating a real OpenCode configuration. */
test('global installation produces a non-mutating plan', async (t) => {
  const configHome = await mkdtemp(join(tmpdir(), 'governance-smoke-'));
  t.after(() => rm(configHome, { recursive: true, force: true }));
  const plan = await planGlobalInstall({ sourceRoot: root, configHome });
  assert.ok(plan.entries.length > 0);
  assert.ok(plan.entries.every((asset) => asset.status === 'write'));
});
