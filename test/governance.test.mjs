import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { canonicalDigest, validateContract } from '../lib/contracts.mjs';
import { dependencyUpdateArgv } from '../lib/dependency-update.mjs';
import { planGlobalInstall } from '../lib/install.mjs';
import { loadProjectContext } from '../lib/project-context.mjs';
import { normalizeProjectItems, selectDeterministicQueue } from '../lib/governance-check.mjs';
import { projectSingleSelect } from '../lib/project-items.mjs';
import { validateDistribution, validateProject } from '../lib/validation.mjs';

/** Repository root used by every distribution smoke check. */
const root = new URL('..', import.meta.url).pathname;
/** Canonical digest-shaped fixture used when only checkpoint binding presence matters. */
const digest = `sha256:${'a'.repeat(64)}`;
/** Minimal valid Project configuration used by queue normalization regressions. */
const projectConfig = {
  repository: 'owner/repo', trustedActors: ['actor'], commands: { verify: 'npm test' },
  documents: [{ path: 'README.md', purpose: 'Project documentation' }], merge: { method: 'squash', automatic: false },
  githubProject: {
    owner: 'owner', number: 1, id: 'project', statusFieldId: 'status',
    statusOptionIds: { ready: 'ready', active: 'active', review: 'review', done: 'done', blocked: 'blocked' },
    statuses: { ready: 'Ready', active: 'Active', review: 'Review', done: 'Done', blocked: 'Blocked' },
    priorityFieldId: 'priority', priorityOptions: [{ name: 'High', optionId: 'high' }],
    missingPriority: 'last', includeDrafts: false, includeArchived: false,
  },
};

/** Build one live Project issue with caller-selected field evidence and repository casing. */
function projectItem(fieldValues, repository = 'owner/repo') {
  return {
    id: 'item', type: 'ISSUE', isArchived: false,
    content: { __typename: 'Issue', url: `https://github.com/${repository}/issues/1`, repository: { nameWithOwner: repository } },
    fieldValues: { nodes: fieldValues },
  };
}

/** Extract one explicit flat permission from agent frontmatter. */
function permission(content, name) {
  return new RegExp(`^  ${name === '*' ? '"\\*"' : name}: (allow|deny)$`, 'm').exec(content)?.[1];
}

/** Extract one scalar top-level agent setting from Markdown frontmatter. */
function agentSetting(content, name) {
  return new RegExp(`^${name}: ([^\\s]+)$`, 'm').exec(content)?.[1];
}

/** Proves the checked-in distribution and its own project contract load together. */
test('distribution and project validate', async () => {
  assert.deepEqual(await validateDistribution(root), []);
  assert.deepEqual(await validateProject(root), []);
});

/** Keeps flexible ordinary access while preserving ownership of durable custom tools. */
test('agents allow ordinary work and match custom-tool ownership', async () => {
  const manifest = JSON.parse(await readFile(join(root, 'governance.manifest.json'), 'utf8'));
  for (const [name, agent] of Object.entries(manifest.agents)) {
    const content = await readFile(join(root, 'agents', `${name}.md`), 'utf8');
    assert.match(agent.model, /^openai\/gpt-5\.6-(?:luna|terra|sol)$/);
    assert.match(agent.reasoningEffort, /^(?:low|medium|high|xhigh|max)$/);
    assert.equal(agentSetting(content, 'model'), agent.model, `${name}: model`);
    assert.equal(agentSetting(content, 'reasoningEffort'), agent.reasoningEffort, `${name}: reasoning effort`);
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

/** Prevents lifecycle labels from outrunning the evidence a checkpoint actually binds. */
test('terminal checkpoints require completed workflow evidence', () => {
  const checkpoint = {
    issueDigest: digest, mode: 'issue', stage: 'done', repository: 'owner/repo',
    issueUrl: 'https://github.com/owner/repo/issues/1', rounds: { plan: 0, change: 0, ci: 0 },
  };
  assert.ok(validateContract('checkpoint', checkpoint).some((error) => error.includes('planDigest: required for stage done')));
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

/** Keeps duplicate priority evidence distinct from the configured missing-priority policy. */
test('Project normalization blocks ambiguous priority values', () => {
  const status = { optionId: 'ready', name: 'Ready', field: { id: 'status', name: 'Status' } };
  const priority = { optionId: 'high', name: 'High', field: { id: 'priority', name: 'Priority' } };
  const normalized = normalizeProjectItems(projectConfig, [projectItem([status, priority, priority])]);
  assert.equal(normalized.status, 'blocked');
  assert.match(normalized.diagnostics[0], /ambiguous configured priority field/);
});

/** GitHub repository identities remain equivalent regardless of canonical display casing. */
test('Project selection compares repository identity case-insensitively', () => {
  const status = { optionId: 'ready', name: 'Ready', field: { id: 'status', name: 'Status' } };
  const normalized = normalizeProjectItems(projectConfig, [projectItem([status], 'Owner/Repo')]);
  assert.equal(normalized.status, 'valid');
  assert.equal(selectDeterministicQueue(projectConfig, normalized.items).status, 'selected');
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
