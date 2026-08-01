import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { canonicalJson, changeDigest, contractDigest, renderIssue, validateChangeBoundary, validateContract } from '../lib/contracts.mjs';
import { INSTALL_COMMAND_PATTERN_SOURCE, VERIFY_COMMAND_PATTERN_SOURCE, validateProject, validateProjectConfig } from '../lib/validation.mjs';

/** Shared fixtures provide valid baselines so each assertion isolates one contract or project boundary. */
const digest = `sha256:${'a'.repeat(64)}`;
const project = { repository: 'owner/repo', trustedActors: ['trusted-bot'], commands: { verify: 'npm run check' }, documents: [{ path: 'AGENTS.md', purpose: 'Instructions' }], merge: { method: 'squash', automatic: false } };
/** Complete deterministic Project mapping accepted by runtime validation. */
const githubProject = {
  owner: 'owner', number: 7, id: 'PVT_project', statusFieldId: 'PVT_status',
  statuses: { ready: 'Ready', active: 'In progress', review: 'In review', done: 'Done', blocked: 'Blocked' },
  statusOptionIds: { ready: 'ready', active: 'active', review: 'review', done: 'done', blocked: 'blocked' },
  priorityFieldId: 'PVT_priority', priorityOptions: [{ name: 'Urgent', optionId: 'urgent' }, { name: 'High', optionId: 'high' }, { name: 'Normal', optionId: 'normal' }],
  missingPriority: 'last', includeDrafts: false, includeArchived: false,
};
/** The issue fixture carries every required approval and documentation field for isolated invalid-input tests. */
const issue = {
  repository: 'owner/repo', title: 'Make behavior deterministic', outcome: 'Users receive one deterministic result.',
  problemEvidence: [{ source: 'src/result.js', conclusion: 'Results currently depend on object insertion order.' }],
  requirements: [{ id: 'REQ-1', text: 'Sort result keys before rendering.' }],
  scope: { included: ['Result rendering'], excluded: ['Storage changes'] },
  technicalDirection: { decisions: ['Use lexical ordering.'], constraints: ['Preserve the public API.'], discretion: ['Internal helper names.'] },
  acceptanceScenarios: [{ id: 'SCN-1', given: 'Equivalent values with different insertion order', when: 'They are rendered', then: ['Both outputs are byte-identical.'] }],
  validation: { focused: ['node --test test/result.test.mjs'], required: ['npm run check'] },
  documentation: { declarations: ['renderResult ordering contract'], external: [], rationale: 'The public declaration changes while external guidance does not describe ordering.' },
  dependencies: [], assumptions: [], references: [],
};

/** Prevents runtime/schema command drift and shell-like verification or install input from becoming trusted. */
test('project commands use schema-identical safe token patterns and reject injection', async (t) => {
  const schema = JSON.parse(await readFile(new URL('../schemas/project.schema.json', import.meta.url), 'utf8'));
  const template = JSON.parse(await readFile(new URL('../templates/project.json', import.meta.url), 'utf8'));
  assert.equal(schema.properties.commands.properties.verify.pattern, VERIFY_COMMAND_PATTERN_SOURCE);
  assert.equal(schema.properties.commands.properties.install.pattern, INSTALL_COMMAND_PATTERN_SOURCE);
  assert.match(validateProjectConfig(template).map((item) => item.message).join('\n'), /supported non-mutating verification command/);
  assert.equal(template.githubProject, undefined);
  assert.deepEqual(schema.properties.githubProject.required.slice(-5), ['priorityFieldId', 'priorityOptions', 'missingPriority', 'includeDrafts', 'includeArchived']);
  assert.deepEqual(schema.properties.githubProject.properties.missingPriority.enum, ['first', 'last']);
  assert.equal(schema.properties.githubProject.properties.priorityOptions.uniqueItems, true);
  assert.equal(schema.properties.githubProject.properties.includeDrafts.const, false);
  assert.equal(schema.properties.githubProject.properties.includeArchived.const, false);
  assert.ok(schema.required.includes('trustedActors'));
  assert.deepEqual(validateProjectConfig({ ...project, githubProject }), []);
  assert.match(validateProjectConfig({ ...project, trustedActors: [] }).map((item) => item.message).join('\n'), /non-empty array/);
  assert.match(validateProjectConfig({ ...project, trustedActors: ['Owner', 'owner'] }).map((item) => item.message).join('\n'), /unique ignoring case/);
  for (const invalid of [
    { ...githubProject, priorityFieldId: '' },
    { ...githubProject, priorityOptions: [] },
    { ...githubProject, priorityOptions: [{ name: 'High', optionId: 'high' }, { name: 'High', optionId: 'other' }] },
    { ...githubProject, missingPriority: 'middle' },
    { ...githubProject, includeDrafts: 'no' },
    { ...githubProject, includeArchived: true },
  ]) assert.ok(validateProjectConfig({ ...project, githubProject: invalid }).length > 0);
  for (const verify of ['npm test', 'npm run check -- --coverage', 'node --test test/*.test.mjs', 'pnpm exec nx affected --target=test']) assert.deepEqual(validateProjectConfig({ ...project, commands: { verify } }), [], verify);
  for (const verify of ['npm test $(touch /tmp/x)', 'npm test `id`', 'npm test "$HOME"', "npm test '$HOME'", 'npm test ${HOME}', 'npm test;git push', 'npm test\nwhoami', 'npm test --fix']) assert.match(validateProjectConfig({ ...project, commands: { verify } }).map((item) => item.message).join('\n'), /safe tokens|non-mutating/, verify);
  for (const install of ['npm ci $(id)', 'npm ci `id`', 'npm ci "--ignore-scripts"', 'npm ci\nwhoami']) assert.match(validateProjectConfig({ ...project, commands: { verify: 'npm test', install } }).map((item) => item.message).join('\n'), /lockfile install/, install);

  const root = await mkdtemp(join(tmpdir(), 'governance-project-')); t.after(() => rm(root, { recursive: true, force: true }));
  await mkdir(join(root, '.opencode')); await writeFile(join(root, 'AGENTS.md'), '# Instructions\n'); await writeFile(join(root, '.opencode/project.json'), JSON.stringify(project));
  assert.deepEqual(await validateProject(root), []);
});

/** Guards configured-document identity and containment against duplicate or symlink-based ambiguity. */
test('project documents reject duplicates and realpath escapes', async (t) => {
  assert.match(validateProjectConfig({ ...project, documents: [project.documents[0], project.documents[0]] }).map((item) => item.message).join('\n'), /duplicates/);
  const root = await mkdtemp(join(tmpdir(), 'governance-project-links-')); t.after(() => rm(root, { recursive: true, force: true }));
  const outside = await mkdtemp(join(tmpdir(), 'governance-outside-')); t.after(() => rm(outside, { recursive: true, force: true }));
  await mkdir(join(root, '.opencode')); await writeFile(join(outside, 'secret.md'), 'outside\n'); await symlink(join(outside, 'secret.md'), join(root, 'guide.md'));
  await writeFile(join(root, '.opencode/project.json'), JSON.stringify({ ...project, documents: [{ path: 'guide.md', purpose: 'Guidance' }] }));
  assert.match((await validateProject(root)).map((item) => item.message).join('\n'), /escapes repository/);
});

/** Proves issue-to-plan traceability and documentation obligations survive runtime and schema validation. */
test('structured issue and plan enforce stable unique IDs, references, and documentation impact', async () => {
  assert.deepEqual(validateContract('issue', issue), []);
  const issueDigest = contractDigest('issue', issue);
  const plan = {
    issueDigest, summary: 'Sort before rendering.',
    steps: [{ id: 'STEP-1', action: 'Add sorted rendering and regression coverage.', acceptanceScenarioIds: ['SCN-1'] }],
    validation: [{ stepId: 'STEP-1', commands: ['node --test test/result.test.mjs', 'npm run check'] }],
    documentation: { actions: ['Document renderResult ordering.'], external: [], rationale: 'Only declaration guidance is affected.' },
    risks: ['Ordering may affect snapshots.'], compatibility: ['Public signatures remain unchanged.'], rollback: 'Revert the rendering change.',
  };
  assert.deepEqual(validateContract('plan', plan, { issue }), []);
  assert.match(validateContract('plan', { ...plan, steps: [{ ...plan.steps[0], acceptanceScenarioIds: ['SCN-9'] }] }, { issue }).join('\n'), /missing scenario SCN-9/);
  assert.match(validateContract('plan', { ...plan, steps: [{ ...plan.steps[0], acceptanceScenarioIds: ['SCN-1', 'SCN-1'] }] }, { issue }).join('\n'), /references must be unique/);
  assert.match(validateContract('plan', { ...plan, steps: [{ ...plan.steps[0], acceptanceScenarioIds: ['scenario one'] }] }).join('\n'), /stable uppercase ID/);
  assert.match(validateContract('issue', { ...issue, requirements: [issue.requirements[0], issue.requirements[0]] }).join('\n'), /duplicate ID REQ-1/);
  assert.match(validateContract('issue', { ...issue, documentation: { declarations: [], external: [] } }).join('\n'), /rationale: required/);
  assert.match(validateContract('plan', { ...plan, documentation: { ...plan.documentation, actions: [7] } }).join('\n'), /non-empty strings/);
  assert.equal(canonicalJson({ ...issue, title: issue.title }), canonicalJson(issue));
  assert.match(renderIssue(issue), /## Acceptance scenarios[\s\S]*### SCN-1[\s\S]*Both outputs are byte-identical/);
  assert.match(renderIssue(issue), /## Documentation impact[\s\S]*renderResult ordering contract/);
  const issueSchema = JSON.parse(await readFile(new URL('../schemas/issue.schema.json', import.meta.url), 'utf8'));
  const planSchema = JSON.parse(await readFile(new URL('../schemas/plan.schema.json', import.meta.url), 'utf8'));
  assert.ok(issueSchema.required.includes('documentation'));
  assert.ok(planSchema.required.includes('documentation'));
  assert.ok(issueSchema.properties.projectTarget.required.includes('readyStatus'));
});

/** Prevents adversarial nested values from throwing instead of yielding deterministic diagnostics. */
test('contract validation is total for malformed collections', () => {
  /** These builders vary one issue collection at a time while preserving every unrelated valid field. */
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
    (bad) => ({ ...issue, documentation: bad }),
    (bad) => ({ ...issue, documentation: { ...issue.documentation, declarations: bad } }),
    (bad) => ({ ...issue, documentation: { ...issue.documentation, external: bad } }),
    (bad) => ({ ...issue, dependencies: bad }),
    (bad) => ({ ...issue, assumptions: bad }),
    (bad) => ({ ...issue, references: bad }),
  ];
  const issueDigest = contractDigest('issue', issue);
  const plan = { issueDigest, summary: 'Plan', steps: [{ id: 'STEP-1', action: 'Act', acceptanceScenarioIds: ['SCN-1'] }], validation: [{ stepId: 'STEP-1', commands: ['npm test'] }], documentation: { actions: [], external: [], rationale: 'No maintained documentation describes this internal test fixture.' }, risks: [], compatibility: [], rollback: 'Revert.' };
  /** These builders apply the same malformed-value corpus to plan-owned collections. */
  const planCases = [
    (bad) => ({ ...plan, steps: bad }),
    (bad) => ({ ...plan, steps: [{ ...plan.steps[0], acceptanceScenarioIds: bad }] }),
    (bad) => ({ ...plan, validation: bad }),
    (bad) => ({ ...plan, validation: [{ ...plan.validation[0], commands: bad }] }),
    (bad) => ({ ...plan, documentation: bad }),
    (bad) => ({ ...plan, documentation: { ...plan.documentation, actions: bad } }),
    (bad) => ({ ...plan, risks: bad }),
    (bad) => ({ ...plan, compatibility: bad }),
  ];
  const review = { subject: { kind: 'issue', digest: issueDigest }, context: { issueDigest }, verdict: 'PASS', findings: [] };
  const verification = { issueDigest, planDigest: digest, changeDigest: digest, status: 'PASS', commands: [{ command: 'npm test', cwd: '/repo', required: true, exitCode: 0, summary: 'Passed', testsOrTargets: ['tests'], skipped: [] }] };
  /** The unified matrix binds each builder to the runtime contract kind it is expected to diagnose. */
  const cases = [
    ...issueCases.map((make) => ['issue', make]),
    ...planCases.map((make) => ['plan', make]),
    ['review', (bad) => ({ ...review, subject: bad })],
    ['review', (bad) => ({ ...review, context: bad })],
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
  assert.doesNotThrow(() => validateContract(Symbol('kind'), Symbol('value')));
  assert.doesNotThrow(() => validateContract('issue', { ...issue, repository: Symbol('repository') }));
  assert.doesNotThrow(() => validateContract('review', { ...review, subject: { kind: 'issue', digest: Symbol('digest') } }));
  assert.doesNotThrow(() => validateContract('verification', { ...verification, changeDigest: Symbol('digest') }));
});

/** Guards verdict meaning and subject/context binding across runtime and schema implementations. */
test('review verdicts require structured findings with stable IDs', async () => {
  const issueDigest = contractDigest('issue', issue);
  const pass = { subject: { kind: 'issue', digest: issueDigest }, context: { issueDigest }, verdict: 'PASS', findings: [] };
  assert.deepEqual(validateContract('review', pass), []);
  const finding = { id: 'R1', severity: 'high', location: 'issue.requirements', evidence: 'Requirement is ambiguous.', impact: 'Two implementations are possible.', correction: 'State the ordering rule.' };
  assert.deepEqual(validateContract('review', { ...pass, verdict: 'CHANGES_REQUIRED', findings: [finding] }), []);
  assert.match(validateContract('review', { ...pass, verdict: 'PASS', findings: [finding] }).join('\n'), /PASS requires no findings/);
  assert.match(validateContract('review', { ...pass, verdict: 'BLOCKED', findings: [finding] }).join('\n'), /blocker finding/);
  const planDigest = `sha256:${'b'.repeat(64)}`;
  const planReview = { ...pass, subject: { kind: 'plan', digest: planDigest }, context: { issueDigest, planDigest } };
  assert.deepEqual(validateContract('review', planReview), []);
  assert.match(validateContract('review', { ...planReview, context: { issueDigest } }).join('\n'), /planDigest: required/);
  assert.match(validateContract('review', { ...planReview, subject: { kind: 'plan', digest } }).join('\n'), /must match/);
  assert.match(validateContract('review', { ...pass, context: { issueDigest, planDigest } }).join('\n'), /unknown property/);
  const fullContext = { issueDigest, planDigest, changeDigest: digest, verificationDigest: `sha256:${'c'.repeat(64)}` };
  assert.deepEqual(validateContract('review', { ...pass, subject: { kind: 'change', digest }, context: fullContext }), []);
  assert.match(validateContract('review', { ...pass, subject: { kind: 'verification', digest: fullContext.verificationDigest }, context: fullContext }).join('\n'), /invalid subject kind/);
  const schema = JSON.parse(await readFile(new URL('../schemas/review.schema.json', import.meta.url), 'utf8'));
  assert.deepEqual(schema.required, ['subject', 'context', 'verdict', 'findings']);
  assert.deepEqual(schema.oneOf.map((rule) => rule.properties.subject.properties.kind.const), ['issue', 'plan', 'change']);
  assert.deepEqual(schema.allOf.map((rule) => rule.if.properties.verdict.const), ['PASS', 'CHANGES_REQUIRED', 'BLOCKED']);
  assert.equal(schema.allOf[0].then.properties.findings.maxItems, 0);
  assert.equal(schema.allOf[2].then.properties.findings.contains.properties.severity.const, 'blocker');
});

/** Prevents PASS, FAIL, or BLOCKED labels from contradicting their recorded command evidence. */
test('verification status is derived from exact command evidence', async () => {
  const command = { command: 'npm run check', cwd: '/repo', required: true, exitCode: 0, summary: '15 tests passed', testsOrTargets: ['15 node tests', 'distribution validation'], skipped: [] };
  const base = { issueDigest: digest, planDigest: `sha256:${'b'.repeat(64)}`, changeDigest: `sha256:${'c'.repeat(64)}`, commands: [command] };
  assert.deepEqual(validateContract('verification', { ...base, status: 'PASS' }), []);
  assert.match(validateContract('verification', { ...base, status: 'PASS', commands: [{ ...command, skipped: ['integration'] }] }).join('\n'), /PASS requires/);
  assert.deepEqual(validateContract('verification', { ...base, status: 'FAIL', commands: [{ ...command, exitCode: 1, summary: 'One test failed' }] }), []);
  assert.match(validateContract('verification', { ...base, status: 'FAIL' }).join('\n'), /FAIL requires nonzero/);
  assert.deepEqual(validateContract('verification', { ...base, status: 'BLOCKED', commands: [{ ...command, exitCode: null, unavailable: 'CI service unavailable' }] }), []);
  assert.match(validateContract('verification', { ...base, status: 'BLOCKED' }).join('\n'), /BLOCKED requires/);
  const schema = JSON.parse(await readFile(new URL('../schemas/verification.schema.json', import.meta.url), 'utf8'));
  assert.deepEqual(schema.required, ['issueDigest', 'planDigest', 'changeDigest', 'status', 'commands']);
  assert.deepEqual(schema.allOf.map((rule) => rule.if.properties.status.const), ['PASS', 'FAIL', 'BLOCKED']);
  assert.equal(schema.allOf[0].then.properties.commands.items.properties.exitCode.const, 0);
  assert.equal(schema.allOf[1].then.properties.commands.contains.properties.exitCode.not.const, 0);
});

/** Guards change identity against abbreviated, malformed, or partially omitted Git object IDs. */
test('change boundaries require full immutable Git OIDs and digest both values', () => {
  const boundary = { baseCommit: 'a'.repeat(40), treeOid: 'b'.repeat(40) };
  assert.deepEqual(validateChangeBoundary(boundary), []);
  assert.equal(changeDigest({ treeOid: boundary.treeOid, baseCommit: boundary.baseCommit }), changeDigest(boundary));
  assert.notEqual(changeDigest({ ...boundary, baseCommit: 'c'.repeat(40) }), changeDigest(boundary));
  assert.notEqual(changeDigest({ ...boundary, treeOid: 'd'.repeat(40) }), changeDigest(boundary));
  assert.deepEqual(validateChangeBoundary({ baseCommit: 'a'.repeat(64), treeOid: 'b'.repeat(64) }), []);
  for (const malformed of [null, 7, {}, { ...boundary, baseCommit: 'A'.repeat(40) }, { ...boundary, treeOid: 'b'.repeat(39) }, { ...boundary, extra: true }]) {
    let diagnostics;
    assert.doesNotThrow(() => { diagnostics = validateChangeBoundary(malformed); });
    assert.ok(diagnostics.length > 0);
    assert.throws(() => changeDigest(malformed), /invalid change boundary/);
  }
});

/** Proves restart and blocker evidence reject undeclared fields while remaining canonically digestible. */
test('blocker and checkpoint contracts are closed, digestible, and schema-aligned', async () => {
  /** Bound fixture values isolate blocker/checkpoint semantics from unrelated issue validation. */
  const issueDigest = contractDigest('issue', issue);
  const blocker = { issueDigest, stage: 'ci', reason: 'Unavailable', evidence: ['CI timeout'], requiredAction: 'Restore CI.' };
  const checkpoint = { issueDigest, mode: 'issue', stage: 'blocked', repository: issue.repository, issueUrl: 'https://github.com/owner/repo/issues/1', rounds: { plan: 1, change: 2, ci: 0 }, blockerDigest: contractDigest('blocker', blocker), baseCommit: 'a'.repeat(40) };
  assert.deepEqual(validateContract('blocker', blocker), []);
  assert.deepEqual(validateContract('checkpoint', checkpoint), []);
  assert.match(validateContract('checkpoint', { ...checkpoint, mode: 'other' }).join('\n'), /mode/);
  assert.match(validateContract('checkpoint', { ...checkpoint, stage: 'other' }).join('\n'), /stage/);
  assert.match(validateContract('blocker', { ...blocker, extra: true }).join('\n'), /unknown property/);
  assert.match(validateContract('blocker', { ...blocker, evidence: [] }).join('\n'), /at least 1/);
  assert.match(validateContract('checkpoint', { ...checkpoint, rounds: { ...checkpoint.rounds, ci: -1 } }).join('\n'), /non-negative integer/);
  for (const malformed of [null, 7, [], { rounds: Symbol('rounds') }]) {
    assert.doesNotThrow(() => validateContract('blocker', malformed));
    assert.doesNotThrow(() => validateContract('checkpoint', malformed));
  }
  for (const name of ['blocker', 'checkpoint']) {
    const schema = JSON.parse(await readFile(new URL(`../schemas/${name}.schema.json`, import.meta.url), 'utf8'));
    assert.equal(schema.additionalProperties, false);
    assert.ok(schema.required.length > 0);
  }
});
