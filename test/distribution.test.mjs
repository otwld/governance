import assert from 'node:assert/strict';
import { cp, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { validateDistribution } from '../lib/validation.mjs';

const root = new URL('..', import.meta.url).pathname;

function bashRules(content) {
  const lines = content.split('\n');
  const start = lines.indexOf('  bash:');
  if (start < 0) return [];
  const rules = [];
  for (const line of lines.slice(start + 1)) {
    if (/^  [^ ]/.test(line)) break;
    const match = /^    "(.*)": (allow|deny)$/.exec(line);
    if (match) rules.push({ pattern: match[1], action: match[2] });
  }
  return rules;
}

function effective(rules, command) {
  let action = 'deny';
  for (const rule of rules) {
    const expression = rule.pattern.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replaceAll('*', '.*');
    if (new RegExp(`^${expression}$`).test(command)) action = rule.action;
  }
  return action;
}

test('canonical manifest distribution validates', async () => {
  assert.deepEqual(await validateDistribution(root), []);
});

test('every agent has deny-default read and external boundaries', async () => {
  const manifest = JSON.parse(await readFile(new URL('../governance.manifest.json', import.meta.url), 'utf8'));
  for (const [name, config] of Object.entries(manifest.agents)) {
    const content = await readFile(new URL(`../agents/${name}.md`, import.meta.url), 'utf8');
    assert.match(content, /^permission:\n  "\*": deny$/m, name);
    assert.match(content, /^  read:\n    "\*": allow\n    "\*\.env": deny\n    "\*\.env\.\*": deny\n    "\*\.env\.example": allow$/m, name);
    assert.match(content, /^  external_directory:\n    "\*": deny\n    "~\/\.local\/share\/opencode\/tool-output\/\*\*": allow\n    "\/tmp\/opencode\/\*\*": allow$/m, name);
    assert.match(content, new RegExp(`^mode: ${config.mode}$`, 'm'), name);
    assert.match(content, new RegExp(`^  issue_factory: ${name === 'task-shaper' ? 'allow' : 'deny'}$`, 'm'), name);
  }
  assert.match(await readFile(new URL('../agents/brainstormer.md', import.meta.url), 'utf8'), /^  skill: allow$/m);
});

test('last-match shell denies block compound input and dangerous actions', async () => {
  const shellAgents = ['task-shaper', 'orchestrator', 'planner', 'implementer', 'reviewer'];
  for (const name of shellAgents) {
    const rules = bashRules(await readFile(new URL(`../agents/${name}.md`, import.meta.url), 'utf8'));
    for (const command of ['git status; git push origin HEAD', 'git status && git push origin HEAD', 'git status || git push origin HEAD', 'git diff | tee patch', 'git diff > patch', 'git show < input', 'git status $(id)', 'git status `id`', 'git status ${HOME}']) assert.equal(effective(rules, command), 'deny', `${name}: ${command}`);
    for (const command of ['git diff --output=file', 'git show --output=file', 'git log --output=file']) assert.equal(effective(rules, command), 'deny', `${name}: ${command}`);
    for (const command of ['git reset --hard', 'git push --force origin HEAD', 'gh pr merge 1 --admin', 'npm publish', 'pnpm run deploy', 'yarn publish', 'bun run deploy']) assert.equal(effective(rules, command), 'deny', `${name}: ${command}`);
  }
  const orchestrator = bashRules(await readFile(new URL('../agents/orchestrator.md', import.meta.url), 'utf8'));
  assert.equal(effective(orchestrator, 'git push origin HEAD'), 'allow');
  assert.equal(effective(orchestrator, 'gh pr merge --squash 12'), 'allow');
  assert.equal(effective(orchestrator, 'gh pr merge --squash 12 -d'), 'deny');
  assert.equal(effective(orchestrator, 'git switch -c branch --discard-changes'), 'deny');
  assert.equal(effective(orchestrator, 'gh project field-list 2 --owner OTWLD'), 'allow');
});

test('only orchestrator carries delivery mutation allows', async () => {
  for (const name of ['brainstormer', 'task-shaper', 'planner', 'implementer', 'reviewer', 'researcher']) {
    const content = await readFile(new URL(`../agents/${name}.md`, import.meta.url), 'utf8');
    assert.doesNotMatch(content, /^    "git (?:add|commit|push origin|switch -c).*": allow$/m, name);
    assert.doesNotMatch(content, /^    "gh (?:project item-edit|pr (?:create|edit|merge)).*": allow$/m, name);
  }
});

test('distribution validation rejects malformed contract schema shape', async (t) => {
  const fixture = await mkdtemp(join(tmpdir(), 'governance-distribution-')); t.after(() => rm(fixture, { recursive: true, force: true }));
  for (const path of ['agents', 'commands', 'skills', 'tools', 'lib', 'schemas', 'templates']) await cp(join(root, path), join(fixture, path), { recursive: true });
  await cp(join(root, 'governance.manifest.json'), join(fixture, 'governance.manifest.json'));
  const schemaPath = join(fixture, 'schemas/review.schema.json');
  const schema = JSON.parse(await readFile(schemaPath, 'utf8'));
  delete schema.properties.subjectKind;
  await writeFile(schemaPath, JSON.stringify(schema));
  assert.match((await validateDistribution(fixture)).map((item) => item.message).join('\n'), /missing required top-level contract field subjectKind/);
});
