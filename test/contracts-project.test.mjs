import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { canonicalJson, contractDigest, renderIssue, validateContract } from '../lib/contracts.mjs';
import { INSTALL_COMMAND_PATTERN_SOURCE, VERIFY_COMMAND_PATTERN_SOURCE, validateProject, validateProjectConfig } from '../lib/validation.mjs';

const digest = `sha256:${'a'.repeat(64)}`;
const project = { repository: 'owner/repo', commands: { verify: 'npm run check' }, documents: [{ path: 'AGENTS.md', purpose: 'Instructions' }], merge: { method: 'squash', automatic: false } };
const issue = {
  repository: 'owner/repo', title: 'Make behavior deterministic', outcome: 'Users receive one deterministic result.',
  problemEvidence: [{ source: 'src/result.js', conclusion: 'Results currently depend on object insertion order.' }],
  requirements: [{ id: 'REQ-1', text: 'Sort result keys before rendering.' }],
  scope: { included: ['Result rendering'], excluded: ['Storage changes'] },
  technicalDirection: { decisions: ['Use lexical ordering.'], constraints: ['Preserve the public API.'], discretion: ['Internal helper names.'] },
  acceptanceScenarios: [{ id: 'SCN-1', given: 'Equivalent values with different insertion order', when: 'They are rendered', then: ['Both outputs are byte-identical.'] }],
  validation: { focused: ['node --test test/result.test.mjs'], required: ['npm run check'] },
  dependencies: [], assumptions: [], references: [],
};

test('project commands use schema-identical safe token patterns and reject injection', async (t) => {
  const schema = JSON.parse(await readFile(new URL('../schemas/project.schema.json', import.meta.url), 'utf8'));
  const template = JSON.parse(await readFile(new URL('../templates/project.json', import.meta.url), 'utf8'));
  assert.equal(schema.properties.commands.properties.verify.pattern, VERIFY_COMMAND_PATTERN_SOURCE);
  assert.equal(schema.properties.commands.properties.install.pattern, INSTALL_COMMAND_PATTERN_SOURCE);
  assert.deepEqual(validateProjectConfig(template), []);
  assert.deepEqual(Object.keys(template.githubProject.statusOptionIds), ['ready', 'active', 'review', 'done', 'blocked']);
  for (const verify of ['npm test', 'npm run check -- --coverage', 'node --test test/*.test.mjs', 'pnpm exec nx affected --target=test']) assert.deepEqual(validateProjectConfig({ ...project, commands: { verify } }), [], verify);
  for (const verify of ['npm test $(touch /tmp/x)', 'npm test `id`', 'npm test "$HOME"', "npm test '$HOME'", 'npm test ${HOME}', 'npm test;git push', 'npm test\nwhoami', 'npm test --fix']) assert.match(validateProjectConfig({ ...project, commands: { verify } }).map((item) => item.message).join('\n'), /safe tokens|non-mutating/, verify);
  for (const install of ['npm ci $(id)', 'npm ci `id`', 'npm ci "--ignore-scripts"', 'npm ci\nwhoami']) assert.match(validateProjectConfig({ ...project, commands: { verify: 'npm test', install } }).map((item) => item.message).join('\n'), /lockfile install/, install);

  const root = await mkdtemp(join(tmpdir(), 'governance-project-')); t.after(() => rm(root, { recursive: true, force: true }));
  await mkdir(join(root, '.opencode')); await writeFile(join(root, 'AGENTS.md'), '# Instructions\n'); await writeFile(join(root, '.opencode/project.json'), JSON.stringify(project));
  assert.deepEqual(await validateProject(root), []);
});

test('project documents reject duplicates and realpath escapes', async (t) => {
  assert.match(validateProjectConfig({ ...project, documents: [project.documents[0], project.documents[0]] }).map((item) => item.message).join('\n'), /duplicates/);
  const root = await mkdtemp(join(tmpdir(), 'governance-project-links-')); t.after(() => rm(root, { recursive: true, force: true }));
  const outside = await mkdtemp(join(tmpdir(), 'governance-outside-')); t.after(() => rm(outside, { recursive: true, force: true }));
  await mkdir(join(root, '.opencode')); await writeFile(join(outside, 'secret.md'), 'outside\n'); await symlink(join(outside, 'secret.md'), join(root, 'guide.md'));
  await writeFile(join(root, '.opencode/project.json'), JSON.stringify({ ...project, documents: [{ path: 'guide.md', purpose: 'Guidance' }] }));
  assert.match((await validateProject(root)).map((item) => item.message).join('\n'), /escapes repository/);
});

test('structured issue and plan enforce stable unique IDs and references', () => {
  assert.deepEqual(validateContract('issue', issue), []);
  const issueDigest = contractDigest('issue', issue);
  const plan = {
    issueDigest, summary: 'Sort before rendering.',
    steps: [{ id: 'STEP-1', action: 'Add sorted rendering and regression coverage.', acceptanceScenarioIds: ['SCN-1'] }],
    validation: [{ stepId: 'STEP-1', commands: ['node --test test/result.test.mjs', 'npm run check'] }],
    risks: ['Ordering may affect snapshots.'], compatibility: ['Public signatures remain unchanged.'], rollback: 'Revert the rendering change.',
  };
  assert.deepEqual(validateContract('plan', plan, { issue }), []);
  assert.match(validateContract('plan', { ...plan, steps: [{ ...plan.steps[0], acceptanceScenarioIds: ['SCN-9'] }] }, { issue }).join('\n'), /missing scenario SCN-9/);
  assert.match(validateContract('plan', { ...plan, steps: [{ ...plan.steps[0], acceptanceScenarioIds: ['SCN-1', 'SCN-1'] }] }, { issue }).join('\n'), /references must be unique/);
  assert.match(validateContract('plan', { ...plan, steps: [{ ...plan.steps[0], acceptanceScenarioIds: ['scenario one'] }] }).join('\n'), /stable uppercase ID/);
  assert.match(validateContract('issue', { ...issue, requirements: [issue.requirements[0], issue.requirements[0]] }).join('\n'), /duplicate ID REQ-1/);
  assert.equal(canonicalJson({ ...issue, title: issue.title }), canonicalJson(issue));
  assert.match(renderIssue(issue), /## Acceptance scenarios[\s\S]*### SCN-1[\s\S]*Both outputs are byte-identical/);
});

test('contract validation is total for malformed collections', () => {
  const issueCases = [
    (bad) => ({ ...issue, problemEvidence: bad }),
    (bad) => ({ ...issue, requirements: bad }),
    (bad) => ({ ...issue, scope: bad }),
    (bad) => ({ ...issue, scope: { ...issue.scope, included: bad } }),
    (bad) => ({ ...issue, scope: { ...issue.scope, excluded: bad } }),
    (bad) => ({ ...issue, technicalDirection: { ...issue.technicalDirection, decisions: bad } }),
    (bad) => ({ ...issue, technicalDirection: { ...issue.technicalDirection, constraints: bad } }),
    (bad) => ({ ...issue, technicalDirection: { ...issue.technicalDirection, discretion: bad } }),
    (bad) => ({ ...issue, technicalDirection: bad }),
    (bad) => ({ ...issue, acceptanceScenarios: bad }),
    (bad) => ({ ...issue, acceptanceScenarios: [{ ...issue.acceptanceScenarios[0], then: bad }] }),
    (bad) => ({ ...issue, validation: { ...issue.validation, focused: bad } }),
    (bad) => ({ ...issue, validation: bad }),
    (bad) => ({ ...issue, validation: { ...issue.validation, required: bad } }),
    (bad) => ({ ...issue, dependencies: bad }),
    (bad) => ({ ...issue, assumptions: bad }),
    (bad) => ({ ...issue, references: bad }),
  ];
  const issueDigest = contractDigest('issue', issue);
  const plan = { issueDigest, summary: 'Plan', steps: [{ id: 'STEP-1', action: 'Act', acceptanceScenarioIds: ['SCN-1'] }], validation: [{ stepId: 'STEP-1', commands: ['npm test'] }], risks: [], compatibility: [], rollback: 'Revert.' };
  const planCases = [
    (bad) => ({ ...plan, steps: bad }),
    (bad) => ({ ...plan, steps: [{ ...plan.steps[0], acceptanceScenarioIds: bad }] }),
    (bad) => ({ ...plan, validation: bad }),
    (bad) => ({ ...plan, validation: [{ ...plan.validation[0], commands: bad }] }),
    (bad) => ({ ...plan, risks: bad }),
    (bad) => ({ ...plan, compatibility: bad }),
  ];
  const review = { subjectKind: 'issue', subjectDigest: issueDigest, verdict: 'PASS', findings: [] };
  const verification = { subjectDigest: issueDigest, changeDigest: digest, status: 'PASS', commands: [{ command: 'npm test', cwd: '/repo', required: true, exitCode: 0, summary: 'Passed', testsOrTargets: ['tests'], skipped: [] }] };
  const cases = [
    ...issueCases.map((make) => ['issue', make]),
    ...planCases.map((make) => ['plan', make]),
    ['review', (bad) => ({ ...review, findings: bad })],
    ['verification', (bad) => ({ ...verification, commands: bad })],
    ['verification', (bad) => ({ ...verification, commands: [{ ...verification.commands[0], testsOrTargets: bad }] })],
    ['verification', (bad) => ({ ...verification, commands: [{ ...verification.commands[0], skipped: bad }] })],
  ];
  for (const bad of [null, 7, { unexpected: true }]) for (const [kind, make] of cases) {
    let diagnostics;
    assert.doesNotThrow(() => { diagnostics = validateContract(kind, make(bad), kind === 'plan' ? { issue } : undefined); }, `${kind} ${JSON.stringify(bad)}`);
    assert.ok(diagnostics.length > 0, `${kind} ${JSON.stringify(bad)} must report diagnostics`);
  }
});

test('review verdicts require structured findings with stable IDs', async () => {
  const pass = { subjectKind: 'issue', subjectDigest: contractDigest('issue', issue), verdict: 'PASS', findings: [] };
  assert.deepEqual(validateContract('review', pass), []);
  const finding = { id: 'R1', severity: 'high', location: 'issue.requirements', evidence: 'Requirement is ambiguous.', impact: 'Two implementations are possible.', correction: 'State the ordering rule.' };
  assert.deepEqual(validateContract('review', { ...pass, verdict: 'CHANGES_REQUIRED', findings: [finding] }), []);
  assert.match(validateContract('review', { ...pass, verdict: 'PASS', findings: [finding] }).join('\n'), /PASS requires no findings/);
  assert.match(validateContract('review', { ...pass, verdict: 'BLOCKED', findings: [finding] }).join('\n'), /blocker finding/);
  const schema = JSON.parse(await readFile(new URL('../schemas/review.schema.json', import.meta.url), 'utf8'));
  assert.deepEqual(schema.allOf.map((rule) => rule.if.properties.verdict.const), ['PASS', 'CHANGES_REQUIRED', 'BLOCKED']);
  assert.equal(schema.allOf[0].then.properties.findings.maxItems, 0);
  assert.equal(schema.allOf[2].then.properties.findings.contains.properties.severity.const, 'blocker');
});

test('verification status is derived from exact command evidence', async () => {
  const command = { command: 'npm run check', cwd: '/repo', required: true, exitCode: 0, summary: '15 tests passed', testsOrTargets: ['15 node tests', 'distribution validation'], skipped: [] };
  const base = { subjectDigest: digest, changeDigest: `sha256:${'b'.repeat(64)}`, commands: [command] };
  assert.deepEqual(validateContract('verification', { ...base, status: 'PASS' }), []);
  assert.match(validateContract('verification', { ...base, status: 'PASS', commands: [{ ...command, skipped: ['integration'] }] }).join('\n'), /PASS requires/);
  assert.deepEqual(validateContract('verification', { ...base, status: 'FAIL', commands: [{ ...command, exitCode: 1, summary: 'One test failed' }] }), []);
  assert.match(validateContract('verification', { ...base, status: 'FAIL' }).join('\n'), /FAIL requires nonzero/);
  assert.deepEqual(validateContract('verification', { ...base, status: 'BLOCKED', commands: [{ ...command, exitCode: null, unavailable: 'CI service unavailable' }] }), []);
  assert.match(validateContract('verification', { ...base, status: 'BLOCKED' }).join('\n'), /BLOCKED requires/);
  const schema = JSON.parse(await readFile(new URL('../schemas/verification.schema.json', import.meta.url), 'utf8'));
  assert.deepEqual(schema.allOf.map((rule) => rule.if.properties.status.const), ['PASS', 'FAIL', 'BLOCKED']);
  assert.equal(schema.allOf[0].then.properties.commands.items.properties.exitCode.const, 0);
  assert.equal(schema.allOf[1].then.properties.commands.contains.properties.exitCode.not.const, 0);
});
