import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { loadProjectContext } from '../lib/project-context.mjs';

/** Guards against caller-supplied authority bypassing the validated execution-root configuration. */
test('project context loads authority only from the trusted execution directory', async (t) => {
  /** The fixture includes a Git root so nested lookups exercise worktree discovery rather than cwd fallback. */
  const root = await mkdtemp(join(tmpdir(), 'governance-context-')); t.after(() => rm(root, { recursive: true, force: true }));
  await mkdir(join(root, '.opencode')); await mkdir(join(root, '.git'));
  /** One valid root authority acts as the oracle against a malicious nested shadow configuration. */
  const config = { repository: 'owner/repo', trustedActors: ['trusted-bot'], commands: { verify: 'npm test' }, documents: [{ path: 'AGENTS.md', purpose: 'Instructions' }], merge: { method: 'squash', automatic: false } };
  await writeFile(join(root, '.opencode/project.json'), JSON.stringify(config));
  assert.deepEqual((await loadProjectContext(root)).config, config);
  await mkdir(join(root, 'packages', 'app'), { recursive: true });
  assert.equal((await loadProjectContext(join(root, 'packages', 'app'))).root, root);
  await mkdir(join(root, 'packages', 'app', '.opencode'));
  await writeFile(join(root, 'packages', 'app', '.opencode', 'project.json'), JSON.stringify({ ...config, trustedActors: ['attacker'] }));
  assert.deepEqual((await loadProjectContext(join(root, 'packages', 'app'))).config, config);
  await writeFile(join(root, '.opencode/project.json'), '{}');
  assert.equal((await loadProjectContext(root)).status, 'rejected');
  assert.equal((await loadProjectContext(join(root, 'missing'))).status, 'rejected');
  assert.equal((await loadProjectContext(undefined)).status, 'rejected');
  /** A real directory outside any Git worktree proves discovery does not accept mere filesystem existence. */
  const unrelated = await mkdtemp(join(tmpdir(), 'governance-unrelated-')); t.after(() => rm(unrelated, { recursive: true, force: true }));
  assert.equal((await loadProjectContext(unrelated)).status, 'rejected');
});

/** Prevents public tool inputs from overriding repository trust while preserving read-only inspection. */
test('public tool schemas do not expose project authority and inspect fields are optional', async () => {
  /** Source inspection is the independent oracle for caller-visible authority fields and cwd fallback. */
  for (const name of ['governance_check', 'workflow_state', 'issue_factory']) {
    const source = await readFile(new URL(`../tools/${name}.js`, import.meta.url), 'utf8');
    /** The extracted argument fragment isolates public schema text from implementation-only enrichment. */
    const args = source.slice(source.indexOf('args:'), source.indexOf('},\n  /**', source.indexOf('args:')));
    assert.doesNotMatch(args, /repository:|trustedActors:|project:/, name);
  }
  /** Workflow source separately proves inspect-only fields remain optional. */
  const workflow = await readFile(new URL('../tools/workflow_state.js', import.meta.url), 'utf8');
  for (const field of ['artifactKind', 'artifact', 'digest', 'priorDigest']) assert.match(workflow, new RegExp(`${field}: tool\\.schema\\.[^\n]+\\.optional\\(\\)`));
  for (const name of ['governance_check', 'workflow_state', 'issue_factory', 'change_boundary', 'dependency_update']) {
    const source = await readFile(new URL(`../tools/${name}.js`, import.meta.url), 'utf8');
    assert.doesNotMatch(source, /context\?\.directory \?\? process\.cwd/);
  }
});
