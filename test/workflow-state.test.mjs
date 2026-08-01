import assert from 'node:assert/strict';
import test from 'node:test';
import { canonicalDigest, contractDigest, renderApprovedIssueRecord } from '../lib/contracts.mjs';
import { executeWorkflowState, extractWorkflowStateArtifact, renderWorkflowStateArtifact } from '../lib/workflow-state.mjs';

/** Shared fixtures encode one valid approval-bound lifecycle against which chain failures are isolated. */
const repository = 'OTWLD/governance';
const issueUrl = 'https://github.com/OTWLD/governance/issues/17';
const issue = {
  repository, title: 'Workflow', outcome: 'Workflow state is durable.', problemEvidence: [{ source: 'test', conclusion: 'Chains require coverage.' }], requirements: [{ id: 'REQ-1', text: 'Validate chains.' }],
  scope: { included: ['State'], excluded: [] }, technicalDirection: { decisions: [], constraints: ['Use digests.'], discretion: [] }, acceptanceScenarios: [{ id: 'SCN-1', given: 'Artifacts', when: 'Inspected', then: ['One head is returned.'] }],
  validation: { focused: ['node --test test/workflow-state.test.mjs'], required: ['npm test'] }, documentation: { declarations: ['workflow chain'], external: [], rationale: 'Protocol declaration changes.' }, dependencies: [], assumptions: [], references: [],
};
const issueDigest = contractDigest('issue', issue);
const issueReview = { subject: { kind: 'issue', digest: issueDigest }, context: { issueDigest }, verdict: 'PASS', findings: [] };
const approval = renderApprovedIssueRecord(issue, issueReview);
const plan = { issueDigest, summary: 'Implement state.', steps: [{ id: 'STEP-1', action: 'Persist.', acceptanceScenarioIds: ['SCN-1'] }], validation: [{ stepId: 'STEP-1', commands: ['npm test'] }], documentation: { actions: ['Document state.'], external: [], rationale: 'Protocol changes.' }, risks: [], compatibility: [], rollback: 'Revert.' };
const planDigest = contractDigest('plan', plan);
const planReview = { subject: { kind: 'plan', digest: planDigest }, context: { issueDigest, planDigest }, verdict: 'PASS', findings: [] };
const planReviewDigest = contractDigest('review', planReview);
const changeDigest = `sha256:${'b'.repeat(64)}`;
const command = { command: 'npm test', cwd: '/repo', required: true, exitCode: 0, summary: 'Passed', testsOrTargets: ['tests'], skipped: [] };
const verification = { issueDigest, planDigest, changeDigest, status: 'PASS', commands: [command] };
const verificationDigest = contractDigest('verification', verification);
const changeReview = { subject: { kind: 'change', digest: changeDigest }, context: { issueDigest, planDigest, changeDigest, verificationDigest }, verdict: 'PASS', findings: [] };
const changeReviewDigest = contractDigest('review', changeReview);
const blocker = { issueDigest, stage: 'ci', reason: 'Unavailable', evidence: ['CI API timeout'], requiredAction: 'Restore CI.' };
const blockerDigest = contractDigest('blocker', blocker);
const checkpoint = { issueDigest, mode: 'issue', stage: 'verified', repository, issueUrl, rounds: { plan: 1, change: 1, ci: 1 }, planDigest, planReviewDigest, changeDigest, verificationDigest, changeReviewDigest };

/** Build trusted comment metadata for a canonical workflow payload. */
function comment(input, number, createdAt) {
  return { body: renderWorkflowStateArtifact(input).body, author: { login: 'trusted-bot' }, url: `${issueUrl}#issuecomment-${number}`, createdAt };
}

/** Return the canonical linear plan-to-change-review chain. */
function chain() {
  return [
    { repository, issueUrl, artifactKind: 'plan', artifact: plan, digest: planDigest },
    { repository, issueUrl, artifactKind: 'plan-review', artifact: planReview, digest: planReviewDigest, priorDigest: planDigest },
    { repository, issueUrl, artifactKind: 'verification', artifact: verification, digest: verificationDigest, priorDigest: planReviewDigest },
    { repository, issueUrl, artifactKind: 'change-review', artifact: changeReview, digest: changeReviewDigest, priorDigest: verificationDigest },
  ];
}

/** Serve trusted identity and current comments for preview/publish preflight. */
function preflight(comments, publishUrl) {
  /** Captured publication body lets the postflight view return the exact remote comment. */
  let publishedBody;
  return async (argv) => {
    if (argv[1] === 'api' && argv[2] === 'user') return { argv, exitCode: 0, stdout: 'trusted-bot', stderr: '' };
    if (argv[1] === 'issue' && argv[2] === 'view') {
      const remote = publishedBody ? [...comments, { body: publishedBody, author: { login: 'trusted-bot' }, url: publishUrl, createdAt: '2026-08-02T00:00:00Z' }] : comments;
      return { argv, exitCode: 0, stdout: JSON.stringify({ url: issueUrl, comments: remote }), stderr: '' };
    }
    if (argv[1] === 'issue' && argv[2] === 'comment') publishedBody = argv.at(-1);
    return { argv, exitCode: 0, stdout: publishUrl ?? `${issueUrl}#issuecomment-99`, stderr: '' };
  };
}

/** Guards marker round trips for every lifecycle artifact and keeps inspection independent of publish inputs. */
test('preview supports every current contract kind and inspect fields remain optional', async () => {
  const approvalComment = { body: approval, author: { login: 'trusted-bot' }, url: `${issueUrl}#issuecomment-1` };
  const checkpointAfterBlocker = { ...checkpoint, blockerDigest };
  const proposals = [...chain(), { repository, issueUrl, artifactKind: 'blocker', artifact: blocker, digest: blockerDigest, priorDigest: changeReviewDigest }, { repository, issueUrl, artifactKind: 'checkpoint', artifact: checkpointAfterBlocker, digest: contractDigest('checkpoint', checkpointAfterBlocker), priorDigest: blockerDigest }];
  const current = [approvalComment];
  for (const proposal of proposals) {
    const result = await executeWorkflowState({ action: 'preview', trustedActors: ['trusted-bot'], ...proposal }, preflight(current));
    assert.equal(result.status, 'ready');
    assert.deepEqual(extractWorkflowStateArtifact(result.preview, { repository, issueUrl }).payload.artifact, proposal.artifact);
    current.push(comment(proposal, current.length + 1, `2026-08-01T00:00:0${current.length}Z`));
  }
  const inspected = await executeWorkflowState({ action: 'inspect', repository, issueUrl, trustedActors: ['trusted-bot'] }, async (argv) => ({ argv, exitCode: 0, stdout: JSON.stringify({ url: issueUrl, comments: [{ body: approval, author: { login: 'trusted-bot' }, url: `${issueUrl}#issuecomment-1` }] }), stderr: '' }));
  assert.equal(inspected.status, 'inspected');
  assert.equal(inspected.head, issueDigest);
});

/** Proves remote comment order is normalized into one approval-bound lifecycle head. */
test('inspect authenticates approval and returns one ordered linear head', async () => {
  const comments = [{ body: approval, author: { login: 'trusted-bot' }, url: `${issueUrl}#issuecomment-1` }, ...chain().map((entry, index) => comment(entry, index + 2, `2026-08-01T00:00:0${index}Z`))];
  const result = await executeWorkflowState({ action: 'inspect', repository, issueUrl, trustedActors: ['trusted-bot'] }, async (argv) => ({ argv, exitCode: 0, stdout: JSON.stringify({ url: issueUrl, comments }), stderr: '' }));
  assert.equal(result.status, 'inspected');
  assert.equal(result.head, changeReviewDigest);
  assert.equal(result.artifacts.length, 4);
  assert.equal(result.approval.artifact.issueDigest, issueDigest);
});

/** Prevents malformed predecessor links and cross-contract bindings from forming a resumable state. */
test('inspect rejects orphan, branch, back-reference, and cross-bound artifacts', async () => {
  const baseApproval = { body: approval, author: { login: 'trusted-bot' }, url: `${issueUrl}#issuecomment-1` };
  const wrongPlanDigest = `sha256:${'f'.repeat(64)}`;
  const wrongPlanReview = { ...planReview, subject: { kind: 'plan', digest: wrongPlanDigest }, context: { issueDigest, planDigest: wrongPlanDigest } };
  const cases = [
    [comment({ ...chain()[0], priorDigest: issueDigest }, 2, '2026-08-01T00:00:00Z')],
    [comment(chain()[0], 2, '2026-08-01T00:00:00Z'), comment({ ...chain()[1], priorDigest: planDigest }, 3, '2026-08-01T00:00:01Z'), comment({ ...chain()[2], priorDigest: planDigest }, 4, '2026-08-01T00:00:02Z')],
    [comment(chain()[0], 2, '2026-08-01T00:00:00Z'), comment({ ...chain()[1], priorDigest: planReviewDigest }, 3, '2026-08-01T00:00:01Z')],
    [comment(chain()[0], 2, '2026-08-01T00:00:00Z'), comment({ ...chain()[1], artifact: wrongPlanReview, digest: contractDigest('review', wrongPlanReview) }, 3, '2026-08-01T00:00:01Z')],
    [comment(chain()[0], 2, '2026-08-01T00:00:00Z'), comment(chain()[0], 3, '2026-08-01T00:00:01Z')],
  ];
  for (const workflowComments of cases) {
    const result = await executeWorkflowState({ action: 'inspect', repository, issueUrl, trustedActors: ['trusted-bot'] }, async (argv) => ({ argv, exitCode: 0, stdout: JSON.stringify({ url: issueUrl, comments: [baseApproval, ...workflowComments] }), stderr: '' }));
    assert.equal(result.status, 'invalid');
  }
});

/** Distinguishes untrusted marker noise from ambiguity inside the trusted approval boundary. */
test('inspect ignores forged markers but blocks duplicate trusted approval records', async () => {
  const forged = { body: renderWorkflowStateArtifact(chain()[0]).body, author: { login: 'attacker' }, url: `${issueUrl}#issuecomment-2`, createdAt: '2026-08-01T00:00:00Z' };
  const trustedApproval = { body: approval, author: { login: 'trusted-bot' }, url: `${issueUrl}#issuecomment-1` };
  const ignored = await executeWorkflowState({ action: 'inspect', repository, issueUrl, trustedActors: ['trusted-bot'] }, async (argv) => ({ argv, exitCode: 0, stdout: JSON.stringify({ url: issueUrl, comments: [trustedApproval, forged] }), stderr: '' }));
  assert.equal(ignored.status, 'inspected');
  assert.match(ignored.diagnostics.join('\n'), /unauthorized/);
  const duplicate = await executeWorkflowState({ action: 'inspect', repository, issueUrl, trustedActors: ['trusted-bot'] }, async (argv) => ({ argv, exitCode: 0, stdout: JSON.stringify({ url: issueUrl, comments: [trustedApproval, { ...trustedApproval, url: `${issueUrl}#issuecomment-3` }] }), stderr: '' }));
  assert.equal(duplicate.status, 'invalid');
});

/** Prevents failed review gates or replacement plans from retaining stale downstream evidence. */
test('state transitions enforce PASS gates and reset downstream evidence', async () => {
  const changes = { ...planReview, verdict: 'CHANGES_REQUIRED', findings: [{ id: 'R1', severity: 'high', location: 'plan', evidence: 'Gap', impact: 'Unsafe', correction: 'Fix' }] };
  const changesDigest = contractDigest('review', changes);
  const approvalComment = { body: approval, author: { login: 'trusted-bot' }, url: `${issueUrl}#issuecomment-1` };
  const blockedComments = [approvalComment, comment(chain()[0], 2, '2026-08-01T00:00:00Z'), comment({ repository, issueUrl, artifactKind: 'plan-review', artifact: changes, digest: changesDigest, priorDigest: planDigest }, 3, '2026-08-01T00:00:01Z')];
  const denied = await executeWorkflowState({ action: 'preview', repository, issueUrl, trustedActors: ['trusted-bot'], ...chain()[2], priorDigest: changesDigest }, preflight(blockedComments));
  assert.equal(denied.status, 'rejected');
  const correctedArtifact = { ...verification, commands: [{ ...command, summary: 'Passed after correction' }] };
  const correctedDigest = contractDigest('verification', correctedArtifact);
  const correctedVerification = { repository, issueUrl, artifactKind: 'verification', artifact: correctedArtifact, digest: correctedDigest, priorDigest: changeReviewDigest };
  const full = [approvalComment, ...chain().map((entry, index) => comment(entry, index + 2, `2026-08-01T00:00:0${index}Z`)), comment(correctedVerification, 6, '2026-08-01T00:00:05Z')];
  const inspected = await executeWorkflowState({ action: 'inspect', repository, issueUrl, trustedActors: ['trusted-bot'] }, async (argv) => ({ argv, exitCode: 0, stdout: JSON.stringify({ url: issueUrl, comments: full }), stderr: '' }));
  assert.equal(inspected.status, 'inspected');
  assert.equal(inspected.state.changeReviewDigest, undefined);
  assert.equal(inspected.state.verificationDigest, correctedDigest);
  const replacementPlan = { ...plan, summary: 'Replacement plan.' };
  const replacementDigest = contractDigest('plan', replacementPlan);
  const reset = await executeWorkflowState({ action: 'inspect', repository, issueUrl, trustedActors: ['trusted-bot'] }, async (argv) => ({ argv, exitCode: 0, stdout: JSON.stringify({ url: issueUrl, comments: [...full, comment({ repository, issueUrl, artifactKind: 'plan', artifact: replacementPlan, digest: replacementDigest, priorDigest: correctedDigest }, 7, '2026-08-01T00:00:06Z')] }), stderr: '' }));
  assert.equal(reset.state.planDigest, replacementDigest);
  assert.equal(reset.state.planReviewDigest, undefined);
  assert.equal(reset.state.verificationDigest, undefined);
});

/** Guards deterministic chain order when server timestamps cannot distinguish adjacent comments. */
test('same-millisecond comments use numeric comment IDs for ordering', async () => {
  const timestamp = '2026-08-01T00:00:00.123Z';
  const comments = [
    { body: approval, author: { login: 'trusted-bot' }, url: `${issueUrl}#issuecomment-1` },
    comment(chain()[1], 10, timestamp),
    comment(chain()[0], 9, timestamp),
  ];
  const result = await executeWorkflowState({ action: 'inspect', repository, issueUrl, trustedActors: ['trusted-bot'] }, async (argv) => ({ argv, exitCode: 0, stdout: JSON.stringify({ url: issueUrl, comments }), stderr: '' }));
  assert.equal(result.status, 'inspected');
  assert.deepEqual(result.artifacts.map((artifact) => artifact.digest), [planDigest, planReviewDigest]);
});

/** Guards the fixed publication argv and preserves uncertainty when comment identity is unconfirmed. */
test('publish uses one fixed comment argv and classifies ambiguous outcomes', async () => {
  const input = chain()[0];
  const calls = [];
  const baseComments = [{ body: approval, author: { login: 'trusted-bot' }, url: `${issueUrl}#issuecomment-1` }];
  const runner = preflight(baseComments, `${issueUrl}#issuecomment-9`);
  const result = await executeWorkflowState({ action: 'publish', trustedActors: ['trusted-bot'], ...input }, async (argv) => { calls.push(argv); return runner(argv); });
  assert.equal(result.status, 'published');
  assert.deepEqual(calls.find((argv) => argv[2] === 'comment'), ['gh', 'issue', 'comment', issueUrl, '--repo', repository, '--body', renderWorkflowStateArtifact(input).body]);
  assert.equal((await executeWorkflowState({ action: 'publish', trustedActors: ['trusted-bot'], ...input }, preflight(baseComments, 'bad'))).status, 'partial');
});

/** Prevents unauthorized publication and non-linear successors from reaching comment mutation. */
test('preview and publish reject untrusted actors, second roots, and stale successors before mutation', async () => {
  const approvalComment = { body: approval, author: { login: 'trusted-bot' }, url: `${issueUrl}#issuecomment-1` };
  const currentPlan = comment(chain()[0], 2, '2026-08-01T00:00:00Z');
  const secondRoot = await executeWorkflowState({ action: 'preview', repository, issueUrl, trustedActors: ['trusted-bot'], ...chain()[0] }, preflight([approvalComment, currentPlan]));
  assert.equal(secondRoot.status, 'rejected');
  const stale = await executeWorkflowState({ action: 'preview', repository, issueUrl, trustedActors: ['trusted-bot'], ...chain()[1], priorDigest: issueDigest }, preflight([approvalComment, currentPlan]));
  assert.equal(stale.status, 'rejected');
  const untrusted = await executeWorkflowState({ action: 'preview', repository, issueUrl, trustedActors: ['trusted-bot'], ...chain()[0] }, async (argv) => argv[1] === 'api' ? { argv, exitCode: 0, stdout: 'attacker', stderr: '' } : assert.fail('issue view must not run'));
  assert.equal(untrusted.status, 'rejected');
});

/** Prevents publication success when a concurrent trusted successor has already advanced the head. */
test('publish postflight detects a concurrent trusted successor race', async () => {
  /** Stateful view and body bindings model preflight, mutation, and conflicting postflight evidence. */
  const input = chain()[0];
  const approvalComment = { body: approval, author: { login: 'trusted-bot' }, url: `${issueUrl}#issuecomment-1` };
  const successor = renderWorkflowStateArtifact(chain()[1]).body;
  let publishedBody;
  let views = 0;
  const result = await executeWorkflowState({ action: 'publish', trustedActors: ['trusted-bot'], ...input }, async (argv) => {
    if (argv[1] === 'api') return { argv, exitCode: 0, stdout: 'trusted-bot', stderr: '' };
    if (argv[2] === 'view') {
      views += 1;
      const comments = views === 1 ? [approvalComment] : [approvalComment, { body: publishedBody, author: { login: 'trusted-bot' }, url: `${issueUrl}#issuecomment-9`, createdAt: '2026-08-02T00:00:00Z' }, { body: successor, author: { login: 'trusted-bot' }, url: `${issueUrl}#issuecomment-10`, createdAt: '2026-08-02T00:00:01Z' }];
      return { argv, exitCode: 0, stdout: JSON.stringify({ url: issueUrl, comments }), stderr: '' };
    }
    publishedBody = argv.at(-1);
    return { argv, exitCode: 0, stdout: `${issueUrl}#issuecomment-9`, stderr: '' };
  });
  assert.equal(result.status, 'partial');
  assert.equal(result.authoritative.head, planReviewDigest);
});
