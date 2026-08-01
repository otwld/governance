import assert from 'node:assert/strict';
import test from 'node:test';
import { contractDigest, renderIssue } from '../lib/contracts.mjs';
import { executeIssueFactory } from '../lib/issue-factory.mjs';

const issue = {
  repository: 'OTWLD/governance', title: 'One outcome', outcome: 'The issue factory is safe.',
  problemEvidence: [{ source: 'lib/issue-factory.mjs', conclusion: 'Publication needs a reviewed structured contract.' }],
  requirements: [{ id: 'REQ-1', text: 'Publish only the reviewed issue.' }],
  scope: { included: ['Issue publication'], excluded: ['Pull requests'] },
  technicalDirection: { decisions: ['Use non-shell argv.'], constraints: ['Do not retry partial outcomes.'], discretion: [] },
  acceptanceScenarios: [{ id: 'SCN-1', given: 'A matching issue review', when: 'Publication runs', then: ['The exact rendered issue is submitted.'] }],
  validation: { focused: ['node --test test/issue-factory.test.mjs'], required: ['npm run check'] },
  dependencies: [], assumptions: [], references: [],
  projectTarget: { owner: 'OTWLD', number: 2, projectId: 'PVT_project', statusFieldId: 'PVTSSF_status', readyOptionId: 'ready-option' },
};
const digest = contractDigest('issue', issue);
const review = { subjectKind: 'issue', subjectDigest: digest, verdict: 'PASS', findings: [] };

test('preview is deterministic and publication requires a matching issue review', async () => {
  const preview = await executeIssueFactory({ action: 'preview', issue }, assert.fail);
  assert.equal(preview.digest, digest);
  assert.equal(preview.preview, renderIssue(issue));
  const planReview = { ...review, subjectKind: 'plan' };
  assert.equal((await executeIssueFactory({ action: 'publish', issue, digest, review: planReview }, assert.fail)).status, 'rejected');
});

test('publish uses one argv and rejects a URL from another repository', async () => {
  const calls = [];
  const published = await executeIssueFactory({ action: 'publish', issue, digest, review }, async (argv) => {
    calls.push(argv);
    return { argv, exitCode: 0, stdout: 'https://github.com/OTWLD/governance/issues/7', stderr: '' };
  });
  assert.equal(published.status, 'published');
  assert.deepEqual(calls[0], ['gh', 'issue', 'create', '--repo', issue.repository, '--title', issue.title, '--body', renderIssue(issue)]);
  const unrelated = await executeIssueFactory({ action: 'publish', issue, digest, review }, async (argv) => ({ argv, exitCode: 0, stdout: 'https://github.com/other/repo/issues/7', stderr: '' }));
  assert.equal(unrelated.status, 'partial');
});

test('enqueue uses only the approved target and sets the exact ready option', async () => {
  const calls = [];
  const result = await executeIssueFactory({ action: 'enqueue', issue, digest, review, issueUrl: 'https://github.com/OTWLD/governance/issues/7', project: { owner: 'other', number: 99 } }, async (argv) => {
    calls.push(argv);
    if (argv[2] === 'item-add') return { argv, exitCode: 0, stdout: '{"id":"PVTI_item"}', stderr: '' };
    return { argv, exitCode: 0, stdout: '', stderr: '' };
  });
  assert.equal(result.status, 'enqueued');
  assert.deepEqual(calls, [
    ['gh', 'project', 'item-add', '2', '--owner', 'OTWLD', '--url', 'https://github.com/OTWLD/governance/issues/7', '--format', 'json'],
    ['gh', 'project', 'item-edit', '--id', 'PVTI_item', '--project-id', 'PVT_project', '--field-id', 'PVTSSF_status', '--single-select-option-id', 'ready-option'],
  ]);
  const unrelated = await executeIssueFactory({ action: 'enqueue', issue, digest, review, issueUrl: 'https://github.com/other/repo/issues/7' }, assert.fail);
  assert.equal(unrelated.status, 'rejected');
});

test('enqueue reports a structured partial result after item creation', async () => {
  let calls = 0;
  const result = await executeIssueFactory({ action: 'enqueue', issue, digest, review, issueUrl: 'https://github.com/OTWLD/governance/issues/7' }, async (argv) => {
    calls += 1;
    return calls === 1 ? { argv, exitCode: 0, stdout: '{"id":"PVTI_item"}', stderr: '' } : { argv, exitCode: 1, stdout: '', stderr: 'denied' };
  });
  assert.equal(result.status, 'partial');
  assert.equal(result.stage, 'set-ready');
  assert.equal(result.itemId, 'PVTI_item');
  assert.equal(calls, 2);
});

test('spawn exceptions return stage-aware safe outcomes', async () => {
  const token = 'ghp_abcdefghijklmnopqrstuvwxyz123456';
  const published = await executeIssueFactory({ action: 'publish', issue, digest, review }, async () => { throw new Error(`stream failed ${token}`); });
  assert.equal(published.status, 'unknown');
  assert.equal(published.stage, 'publish');
  assert.match(published.next, /verify repository state before any retry/i);
  assert.doesNotMatch(JSON.stringify(published), new RegExp(token));

  const add = await executeIssueFactory({ action: 'enqueue', issue, digest, review, issueUrl: 'https://github.com/OTWLD/governance/issues/7' }, async () => { throw new Error('spawn unavailable'); });
  assert.equal(add.status, 'failed');
  assert.equal(add.stage, 'add-item');

  let calls = 0;
  const ready = await executeIssueFactory({ action: 'enqueue', issue, digest, review, issueUrl: 'https://github.com/OTWLD/governance/issues/7' }, async (argv) => {
    calls += 1;
    if (calls === 1) return { argv, exitCode: 0, stdout: '{"id":"PVTI_item"}', stderr: '' };
    throw new Error('response stream failed');
  });
  assert.equal(ready.status, 'partial');
  assert.equal(ready.stage, 'set-ready');
  assert.equal(ready.itemId, 'PVTI_item');
  assert.match(ready.next, /verify its status before any retry/i);
});
