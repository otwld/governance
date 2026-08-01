import assert from 'node:assert/strict';
import test from 'node:test';
import { contractDigest, renderApprovedIssueRecord } from '../lib/contracts.mjs';
import { compareCommittedTree, executeGovernanceCheck, normalizeProjectItems, selectDeterministicQueue } from '../lib/governance-check.mjs';

/** Shared fixtures make approval provenance and queue selection independently reproducible. */
const repository = 'owner/repo';
const issueUrl = 'https://github.com/owner/repo/issues/9';
const issue = {
  repository, title: 'Check governance', outcome: 'Evidence is independently checked.',
  problemEvidence: [{ source: 'test', conclusion: 'Read-only checks need coverage.' }], requirements: [{ id: 'REQ-1', text: 'Validate evidence.' }],
  scope: { included: ['Checks'], excluded: [] }, technicalDirection: { decisions: [], constraints: ['Use argv.'], discretion: [] },
  acceptanceScenarios: [{ id: 'SCN-1', given: 'Evidence', when: 'Checked', then: ['Diagnostics are deterministic.'] }],
  validation: { focused: ['node --test test/governance-check.test.mjs'], required: ['npm test'] }, documentation: { declarations: ['governance_check'], external: [], rationale: 'Tool contract changes.' },
  dependencies: [], assumptions: [], references: [],
};
const issueDigest = contractDigest('issue', issue);
const review = { subject: { kind: 'issue', digest: issueDigest }, context: { issueDigest }, verdict: 'PASS', findings: [] };
const approvalBody = renderApprovedIssueRecord(issue, review);
const githubProject = {
  owner: 'owner', number: 1, id: 'PVT', statusFieldId: 'STATUS', statuses: { ready: 'Ready', active: 'Active', review: 'Review', done: 'Done', blocked: 'Blocked' },
  statusOptionIds: { ready: 'ready', active: 'active', review: 'review', done: 'done', blocked: 'blocked' }, priorityFieldId: 'PRIORITY',
  priorityOptions: [{ name: 'High', optionId: 'high' }, { name: 'Normal', optionId: 'normal' }], missingPriority: 'last', includeDrafts: false, includeArchived: false,
};
const project = { repository, trustedActors: ['trusted-bot'], commands: { verify: 'npm test' }, documents: [{ path: 'AGENTS.md', purpose: 'Instructions' }], githubProject, merge: { method: 'squash', automatic: false } };

/** Construct normalized queue evidence with stable defaults. */
function item(id, overrides = {}) {
  return { id, type: 'issue', archived: false, statusOptionId: 'ready', priorityOptionId: 'normal', projectOrder: 0, repository, issueUrl: `https://github.com/owner/repo/issues/${id}`, ...overrides };
}

/** Build one GraphQL Project item with field-ID-bound status and priority values. */
function projectNode(id = 'I1', url = issueUrl, { status = ['ready', 'Ready'], priority = ['high', 'High'], archived = false } = {}) {
  return { id, isArchived: archived, type: 'ISSUE', content: { __typename: 'Issue', url, repository: { nameWithOwner: repository } }, fieldValues: { nodes: [{ optionId: status[0], name: status[1], field: { id: 'STATUS', name: 'Status' } }, ...(priority ? [{ optionId: priority[0], name: priority[1], field: { id: 'PRIORITY', name: 'Priority' } }] : [])] } };
}

/** Prevents read-only checks from blessing invalid contract or committed-tree evidence with a digest. */
test('contract and supplied change checks return digests only for valid evidence', async () => {
  assert.equal((await executeGovernanceCheck({ action: 'contract', kind: 'issue', value: issue }, assert.fail)).digest, issueDigest);
  const boundary = { baseCommit: 'a'.repeat(40), treeOid: 'b'.repeat(40) };
  assert.equal((await executeGovernanceCheck({ action: 'change', ...boundary, committedTreeOid: boundary.treeOid }, assert.fail)).status, 'valid');
  assert.match(compareCommittedTree(boundary, 'c'.repeat(40)).join('\n'), /does not match/);
  assert.equal((await executeGovernanceCheck({ action: 'staged-change' }, assert.fail)).status, 'rejected');
});

/** Guards approval authority against forged and duplicate marker comments. */
test('approved issue inspection trusts exactly one authorized approval comment', async () => {
  const trusted = { body: approvalBody, author: { login: 'trusted-bot' }, url: `${issueUrl}#issuecomment-2` };
  const unauthorized = { body: approvalBody, author: { login: 'attacker' }, url: `${issueUrl}#issuecomment-1` };
  const calls = [];
  /** This GitHub double preserves both unauthorized noise and one valid approval for provenance checks. */
  const result = await executeGovernanceCheck({ action: 'approved-issue', repository, issueUrl, trustedActors: ['trusted-bot'] }, async (argv) => {
    calls.push(argv); return { argv, exitCode: 0, stdout: JSON.stringify({ url: issueUrl, comments: [unauthorized, trusted] }), stderr: '' };
  });
  assert.equal(result.status, 'valid');
  assert.match(result.diagnostics.join('\n'), /unauthorized/);
  assert.deepEqual(calls[0], ['gh', 'issue', 'view', issueUrl, '--repo', repository, '--json', 'comments,url']);
  const duplicate = await executeGovernanceCheck({ action: 'approved-issue', repository, issueUrl, trustedActors: ['trusted-bot'] }, async (argv) => ({ argv, exitCode: 0, stdout: JSON.stringify({ url: issueUrl, comments: [trusted, { ...trusted, url: `${issueUrl}#issuecomment-3` }] }), stderr: '' }));
  assert.equal(duplicate.status, 'invalid');
});

/** Prevents display-name normalization from accepting truncated or unknown Project state. */
test('queue normalization binds status and priority by field ID', () => {
  const normalized = normalizeProjectItems(project, [projectNode()]);
  assert.equal(normalized.status, 'valid');
  assert.deepEqual(normalized.items[0], item('I1', { issueUrl, priorityOptionId: 'high' }));
  const wrongField = projectNode(); wrongField.fieldValues.nodes[0].field.id = 'OTHER';
  assert.equal(normalizeProjectItems(project, [wrongField]).status, 'blocked');
  assert.equal(normalizeProjectItems(project, [projectNode('A', issueUrl, { archived: true })]).items[0].archived, true);
  const draft = { id: 'D', isArchived: false, type: 'DRAFT_ISSUE', content: { __typename: 'DraftIssue' }, fieldValues: { nodes: [] } };
  assert.equal(normalizeProjectItems(project, [draft]).status, 'valid');
  const archivedWithoutFields = projectNode('A', issueUrl, { archived: true }); archivedWithoutFields.fieldValues.nodes = [];
  assert.equal(normalizeProjectItems(project, [archivedWithoutFields]).status, 'valid');
  assert.equal(normalizeProjectItems(project, [{ id: 'X', isArchived: false, type: 'REDACTED', fieldValues: { nodes: [] } }]).status, 'blocked');
});

/** Guards deterministic ordering and the single-in-flight recovery invariant. */
test('pure queue selection excludes drafts and archives and resumes exactly one item', () => {
  const selected = selectDeterministicQueue(project, [item('3', { priorityOptionId: null }), item('2', { priorityOptionId: 'high', projectOrder: 2 }), item('1', { priorityOptionId: 'high', projectOrder: 1 })]);
  assert.equal(selected.item.id, '1');
  assert.equal(selectDeterministicQueue(project, [item('1', { statusOptionId: 'active' }), item('2', { statusOptionId: 'review' })]).status, 'blocked');
  const filtered = selectDeterministicQueue(project, [item('4', { type: 'draft', issueUrl: null }), item('5', { archived: true }), item('6')]);
  assert.equal(filtered.item.id, '6');
  assert.match(filtered.diagnostics.join('\n'), /draft.*ineligible|archived.*ineligible/);
});

/** Proves queue selection remains blocked until complete Project evidence and trusted issue approval agree. */
test('public queue action fetches a complete list then authenticates selected approval', async () => {
  const calls = [];
  /** The command double separates Project inventory evidence from issue-comment provenance. */
  const result = await executeGovernanceCheck({ action: 'queue', repository, trustedActors: ['trusted-bot'], project }, async (argv) => {
    calls.push(argv);
    if (argv[1] === 'api' && argv[2] === 'graphql') return { argv, exitCode: 0, stdout: JSON.stringify({ data: { node: { items: { nodes: [projectNode()], pageInfo: { hasNextPage: false, endCursor: null } } } } }), stderr: '' };
    return { argv, exitCode: 0, stdout: JSON.stringify({ url: issueUrl, comments: [{ body: approvalBody, author: { login: 'trusted-bot' }, url: `${issueUrl}#issuecomment-2` }] }), stderr: '' };
  });
  assert.equal(result.status, 'selected');
  assert.deepEqual(calls[0].slice(0, 3), ['gh', 'api', 'graphql']);
  const incomplete = await executeGovernanceCheck({ action: 'queue', repository, trustedActors: ['trusted-bot'], project }, async (argv) => ({ argv, exitCode: 0, stdout: JSON.stringify({ data: { node: { items: { nodes: [], pageInfo: { hasNextPage: true, endCursor: null } } } } }), stderr: '' }));
  assert.equal(incomplete.status, 'invalid');
});
