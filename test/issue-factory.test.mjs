import assert from 'node:assert/strict';
import test from 'node:test';
import { contractDigest, extractApprovedIssueRecord, renderApprovedIssueRecord, renderIssue } from '../lib/contracts.mjs';
import { executeIssueFactory } from '../lib/issue-factory.mjs';

/** Shared approval fixtures bind every publication path to one repository and reviewed Project target. */
const repository = 'OTWLD/governance';
const issueUrl = 'https://github.com/OTWLD/governance/issues/7';
const projectTarget = { owner: 'OTWLD', number: 2, projectId: 'PVT_project', statusFieldId: 'PVTSSF_status', readyOptionId: 'ready-option', readyStatus: 'Ready' };
const issue = {
  repository, title: 'One outcome', outcome: 'The issue factory is safe.', problemEvidence: [{ source: 'lib/issue-factory.mjs', conclusion: 'Publication needs provenance.' }],
  requirements: [{ id: 'REQ-1', text: 'Publish only the reviewed issue.' }], scope: { included: ['Issue publication'], excluded: ['Pull requests'] },
  technicalDirection: { decisions: ['Use non-shell argv.'], constraints: ['Do not retry partial outcomes.'], discretion: [] },
  acceptanceScenarios: [{ id: 'SCN-1', given: 'A matching issue review', when: 'Publication runs', then: ['Approval is a dedicated comment.'] }],
  validation: { focused: ['node --test test/issue-factory.test.mjs'], required: ['npm run check'] }, documentation: { declarations: ['Issue publication protocol'], external: [], rationale: 'The tool contract changes.' },
  dependencies: [], assumptions: [], references: [], projectTarget,
};
const digest = contractDigest('issue', issue);
const review = { subject: { kind: 'issue', digest }, context: { issueDigest: digest }, verdict: 'PASS', findings: [] };
const approvalComment = renderApprovedIssueRecord(issue, review);
const project = {
  repository, trustedActors: ['trusted-bot'], commands: { verify: 'npm test' }, documents: [{ path: 'AGENTS.md', purpose: 'Instructions' }], merge: { method: 'squash', automatic: false },
  githubProject: { owner: 'OTWLD', number: 2, id: 'PVT_project', statusFieldId: 'PVTSSF_status', statuses: { ready: 'Ready', active: 'Active', review: 'Review', done: 'Done', blocked: 'Blocked' }, statusOptionIds: { ready: 'ready-option', active: 'active', review: 'review', done: 'done', blocked: 'blocked' }, priorityFieldId: 'PRIORITY', priorityOptions: [{ name: 'High', optionId: 'high' }], missingPriority: 'last', includeDrafts: false, includeArchived: false },
};
const authority = { repository, trustedActors: ['trusted-bot'], project };

/** Return trusted approval metadata in the shape emitted by `gh issue view`. */
function approvalView(commentUrl = `${issueUrl}#issuecomment-5`) {
  return JSON.stringify({ url: issueUrl, comments: [{ body: approvalComment, author: { login: 'trusted-bot' }, url: commentUrl }] });
}

/** Build GraphQL Project evidence with status bound to the configured field ID. */
function projectNode(id, status = 'Ready') {
  return { id, isArchived: false, type: 'ISSUE', content: { __typename: 'Issue', url: issueUrl, repository: { nameWithOwner: repository } }, fieldValues: { nodes: [{ optionId: status === 'Ready' ? 'ready-option' : 'active', name: status, field: { id: 'PVTSSF_status', name: 'Status' } }] } };
}

/** Wrap nodes in one complete GraphQL Project connection. */
function projectPage(nodes) { return JSON.stringify({ data: { node: { items: { nodes, pageInfo: { hasNextPage: false, endCursor: null } } } } }); }

/** Guards the provenance envelope from leaking into editable human issue prose or crossing repositories. */
test('preview separates human issue prose from the exact hidden approval comment', async () => {
  const result = await executeIssueFactory({ action: 'preview', issue, review, ...authority }, assert.fail);
  assert.deepEqual(result.preview, { issueBody: renderIssue(issue), approvalComment });
  assert.doesNotMatch(result.preview.issueBody, /governance-approved-issue-record/);
  assert.deepEqual(extractApprovedIssueRecord(result.preview.approvalComment, { repository }).artifact.issue, issue);
  assert.equal((await executeIssueFactory({ action: 'preview', issue: { ...issue, repository: 'other/repo' }, review, ...authority }, assert.fail)).status, 'rejected');
});

/** Proves publication is not reported complete until the exact trusted approval comment is read back. */
test('publish creates human issue then confirms one trusted approval comment', async () => {
  const calls = [];
  /** This stateful GitHub double supplies distinct create, comment, and verification evidence. */
  const result = await executeIssueFactory({ action: 'publish', issue, review, digest, ...authority }, async (argv) => {
    calls.push(argv);
    if (argv[1] === 'api') return { argv, exitCode: 0, stdout: 'trusted-bot', stderr: '' };
    if (argv[2] === 'create') return { argv, exitCode: 0, stdout: issueUrl, stderr: '' };
    if (argv[2] === 'comment') return { argv, exitCode: 0, stdout: `${issueUrl}#issuecomment-5`, stderr: '' };
    return { argv, exitCode: 0, stdout: approvalView(), stderr: '' };
  });
  assert.equal(result.status, 'published');
  assert.deepEqual(calls, [
    ['gh', 'api', 'user', '--jq', '.login'],
    ['gh', 'issue', 'create', '--repo', repository, '--title', issue.title, '--body', renderIssue(issue)],
    ['gh', 'issue', 'comment', issueUrl, '--repo', repository, '--body', approvalComment],
    ['gh', 'issue', 'view', issueUrl, '--repo', repository, '--json', 'comments,url'],
  ]);
});

/** Prevents ambiguous post-creation failures from being flattened into safe-to-retry outcomes or leaking tokens. */
test('approval publication failures preserve the created issue and forbid blind retry', async () => {
  /** The first adapter models a known comment rejection after a successful issue mutation. */
  const failed = await executeIssueFactory({ action: 'publish', issue, review, digest, ...authority }, async (argv) => argv[1] === 'api' ? { argv, exitCode: 0, stdout: 'trusted-bot', stderr: '' } : argv[2] === 'create' ? { argv, exitCode: 0, stdout: issueUrl, stderr: '' } : { argv, exitCode: 1, stdout: '', stderr: 'denied' });
  assert.equal(failed.status, 'partial');
  assert.equal(failed.issueUrl, issueUrl);
  assert.match(failed.next, /inspect issue comments/i);
  const token = 'ghp_abcdefghijklmnopqrstuvwxyz123456';
  let calls = 0;
  /** The second adapter models an exception whose remote comment outcome cannot be known. */
  const unknown = await executeIssueFactory({ action: 'publish', issue, review, digest, ...authority }, async (argv) => { calls += 1; if (calls === 1) return { argv, exitCode: 0, stdout: 'trusted-bot', stderr: '' }; if (calls === 2) return { argv, exitCode: 0, stdout: issueUrl, stderr: '' }; throw new Error(token); });
  assert.equal(unknown.status, 'unknown');
  assert.doesNotMatch(JSON.stringify(unknown), new RegExp(token));
});

/** Guards issue creation behind a successful live trusted-actor preflight. */
test('publish authentication failures occur before issue creation', async () => {
  /** Captured calls and classified outcomes prove every authentication failure stops before creation. */
  const calls = [];
  const unauthorized = await executeIssueFactory({ action: 'publish', issue, review, digest, ...authority }, async (argv) => { calls.push(argv); return { argv, exitCode: 0, stdout: 'attacker', stderr: '' }; });
  assert.equal(unauthorized.status, 'rejected');
  assert.deepEqual(calls, [['gh', 'api', 'user', '--jq', '.login']]);
  const failed = await executeIssueFactory({ action: 'publish', issue, review, digest, ...authority }, async (argv) => ({ argv, exitCode: 1, stdout: '', stderr: 'denied' }));
  assert.equal(failed.status, 'failed');
  const unknown = await executeIssueFactory({ action: 'publish', issue, review, digest, ...authority }, async () => { throw new Error('offline'); });
  assert.equal(unknown.status, 'unknown');
});

/** Guards intake mutation with trusted approval and complete pre/post Project snapshots. */
test('enqueue authenticates approval and reads a complete Project before and after mutation', async () => {
  const calls = [];
  let projectReads = 0;
  /** This Project double transitions from absent to Ready only after the expected mutations. */
  const result = await executeIssueFactory({ action: 'enqueue', issue, review, digest, issueUrl, ...authority }, async (argv) => {
    calls.push(argv);
    if (argv[1] === 'issue') return { argv, exitCode: 0, stdout: approvalView(), stderr: '' };
    if (argv[2] === 'graphql') {
      projectReads += 1;
      const items = projectReads === 1 ? [] : [projectNode('PVTI_item')];
      return { argv, exitCode: 0, stdout: projectPage(items), stderr: '' };
    }
    if (argv[2] === 'item-add') return { argv, exitCode: 0, stdout: '{"id":"PVTI_item"}', stderr: '' };
    return { argv, exitCode: 0, stdout: '', stderr: '' };
  });
  assert.equal(result.status, 'enqueued');
  assert.equal(calls.filter((argv) => argv[2] === 'graphql').length, 2);
});

/** Prevents intake from resetting active work or acting on a truncated Project inventory. */
test('enqueue never resets an existing item and rejects incomplete Project reads', async () => {
  /** The adapters below model existing Active, existing Ready, and incomplete inventory boundaries. */
  const existing = await executeIssueFactory({ action: 'enqueue', issue, review, digest, issueUrl, ...authority }, async (argv) => {
    if (argv[1] === 'issue') return { argv, exitCode: 0, stdout: approvalView(), stderr: '' };
    return { argv, exitCode: 0, stdout: projectPage([projectNode('I', 'Active')]), stderr: '' };
  });
  assert.equal(existing.status, 'rejected');
  assert.match(existing.errors.join('\n'), /already has Project status Active/);
  const ready = await executeIssueFactory({ action: 'enqueue', issue, review, digest, issueUrl, ...authority }, async (argv) => argv[1] === 'issue' ? { argv, exitCode: 0, stdout: approvalView(), stderr: '' } : { argv, exitCode: 0, stdout: projectPage([projectNode('I')]), stderr: '' });
  assert.equal(ready.status, 'already-enqueued');
  const incomplete = await executeIssueFactory({ action: 'enqueue', issue, review, digest, issueUrl, ...authority }, async (argv) => argv[1] === 'issue' ? { argv, exitCode: 0, stdout: approvalView(), stderr: '' } : { argv, exitCode: 0, stdout: JSON.stringify({ data: { node: { items: { nodes: [], pageInfo: { hasNextPage: true, endCursor: null } } } } }), stderr: '' });
  assert.equal(incomplete.status, 'rejected');
  const archivedNode = projectNode('I'); archivedNode.isArchived = true;
  const archived = await executeIssueFactory({ action: 'enqueue', issue, review, digest, issueUrl, ...authority }, async (argv) => argv[1] === 'issue' ? { argv, exitCode: 0, stdout: approvalView(), stderr: '' } : { argv, exitCode: 0, stdout: projectPage([archivedNode]), stderr: '' });
  assert.equal(archived.status, 'rejected');
});

/** Prevents Ready readback from succeeding when the created Project item is no longer a live Issue. */
test('enqueue postflight rejects archived or draft Ready items', async () => {
  /** The stateful adapter archives only the post-mutation item to isolate readback validation. */
  let reads = 0;
  const result = await executeIssueFactory({ action: 'enqueue', issue, review, digest, issueUrl, ...authority }, async (argv) => {
    if (argv[1] === 'issue') return { argv, exitCode: 0, stdout: approvalView(), stderr: '' };
    if (argv[2] === 'graphql') {
      reads += 1;
      const node = projectNode('PVTI_item'); node.isArchived = true;
      return { argv, exitCode: 0, stdout: projectPage(reads === 1 ? [] : [node]), stderr: '' };
    }
    if (argv[2] === 'item-add') return { argv, exitCode: 0, stdout: '{"id":"PVTI_item"}', stderr: '' };
    return { argv, exitCode: 0, stdout: '', stderr: '' };
  });
  assert.equal(result.status, 'partial');
});
