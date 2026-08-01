import { canonicalJson, contractDigest, renderApprovedIssueRecord, renderIssue, validateContract } from './contracts.mjs';
import { inspectApprovedIssue } from './governance-check.mjs';
import { fetchProjectItems, projectSingleSelect } from './project-items.mjs';

/** Prevent credentials in remote failures from crossing the tool boundary. */
function safeError(error) {
  const message = (error instanceof Error ? error.message : String(error))
    .replace(/(authorization:\s*(?:bearer|token)\s+)\S+/gi, '$1[redacted]')
    .replace(/\b(?:gh[pousr]_[A-Za-z0-9_]{20,}|github_pat_[A-Za-z0-9_]+)\b/g, '[redacted]');
  return { name: error instanceof Error ? error.name : 'Error', message };
}

/** Require process adapters to preserve exit and stream evidence. */
async function invoke(spawn, argv) {
  const outcome = await spawn(argv);
  if (!outcome || typeof outcome !== 'object' || !Number.isInteger(outcome.exitCode) || typeof outcome.stdout !== 'string' || typeof outcome.stderr !== 'string') throw new Error('command returned an invalid outcome');
  return outcome;
}

/** Bind issue and issue-comment URLs to one repository. */
function parseIssueUrl(url, repository, allowComment = false) {
  if (typeof url !== 'string' || typeof repository !== 'string') return undefined;
  const match = /^https:\/\/github\.com\/([^/]+\/[^/]+)\/issues\/(\d+)(?:#issuecomment-(\d+))?$/.exec(url);
  if (!match || match[1].toLowerCase() !== repository.toLowerCase() || (!allowComment && match[3])) return undefined;
  return { repository: match[1], number: match[2], commentId: match[3] };
}

/** Require a PASS review bound to the exact issue digest. */
function passingIssueReview(review, digest) {
  const errors = validateContract('review', review);
  return errors.length || review?.subject?.kind !== 'issue' || review?.verdict !== 'PASS' || review?.subject?.digest !== digest || review?.context?.issueDigest !== digest ? [...errors, 'a matching PASS issue review is required'] : [];
}

/** Require a live GraphQL Issue item bound to the configured repository and exact URL. */
function validProjectIssue(item, project, repository, issueUrl) {
  return item?.type === 'ISSUE' && item?.isArchived === false && item?.content?.__typename === 'Issue' && item.content.url === issueUrl && item.content.repository?.nameWithOwner === repository && projectSingleSelect(item, project.statusFieldId) !== undefined;
}

/** Preview, publish, or enqueue one issue under authority derived from project context. */
export async function executeIssueFactory(input, spawn) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return { action: undefined, status: 'rejected', errors: ['input must be an object'] };
  if (typeof input.repository !== 'string' || input.issue?.repository !== input.repository) return { action: input.action, status: 'rejected', errors: ['issue.repository must match project repository'] };
  /** Validation, digest, and review evidence establish the immutable publication subject. */
  const issueErrors = validateContract('issue', input.issue);
  if (issueErrors.length) return { action: input.action, status: 'rejected', errors: issueErrors };
  const digest = contractDigest('issue', input.issue);
  const reviewErrors = passingIssueReview(input.review, digest);
  if (reviewErrors.length) return { action: input.action, status: 'rejected', digest, errors: reviewErrors };
  /** Human prose and machine approval are rendered separately from the same validated contracts. */
  const issueBody = renderIssue(input.issue);
  const approvalComment = renderApprovedIssueRecord(input.issue, input.review);
  if (input.action === 'preview') return { action: 'preview', status: 'ready', digest, preview: { issueBody, approvalComment } };
  if (input.digest !== digest) return { action: input.action, status: 'rejected', digest, errors: ['digest does not match the issue contract'] };

  if (input.action === 'publish') {
    /** Authentication and mutation outcomes remain stage-bound so failures never imply a safe retry. */
    let actor;
    try { actor = await invoke(spawn, ['gh', 'api', 'user', '--jq', '.login']); }
    catch (error) { return { action: 'publish', status: 'unknown', stage: 'authenticate', digest, error: safeError(error) }; }
    if (actor.exitCode !== 0) return { action: 'publish', status: 'failed', stage: 'authenticate', digest, outcome: actor };
    /** The live GitHub login must independently match configured publication authority. */
    const login = actor.stdout.trim();
    if (!/^[A-Za-z0-9](?:[A-Za-z0-9-]{0,37}[A-Za-z0-9])?$/.test(login) || !Array.isArray(input.trustedActors) || !input.trustedActors.some((trusted) => typeof trusted === 'string' && trusted.toLowerCase() === login.toLowerCase())) return { action: 'publish', status: 'rejected', stage: 'authenticate', digest, errors: ['current GitHub actor is not trusted'] };
    let create;
    try { create = await invoke(spawn, ['gh', 'issue', 'create', '--repo', input.repository, '--title', input.issue.title, '--body', issueBody]); }
    catch (error) { return { action: 'publish', status: 'unknown', stage: 'create-issue', digest, error: safeError(error), next: 'Inspect repository issues before any retry.' }; }
    if (create.exitCode !== 0) return { action: 'publish', status: 'failed', stage: 'create-issue', digest, outcome: create };
    const issueUrl = create.stdout;
    if (!parseIssueUrl(issueUrl, input.repository)) return { action: 'publish', status: 'partial', stage: 'create-issue', digest, outcome: create, next: 'Inspect repository issues before any retry.' };
    let comment;
    try { comment = await invoke(spawn, ['gh', 'issue', 'comment', issueUrl, '--repo', input.repository, '--body', approvalComment]); }
    catch (error) { return { action: 'publish', status: 'unknown', stage: 'publish-approval', digest, issueUrl, outcomes: { create }, error: safeError(error), next: 'Inspect issue comments before any retry.' }; }
    if (comment.exitCode !== 0) return { action: 'publish', status: 'partial', stage: 'publish-approval', digest, issueUrl, outcomes: { create, comment }, next: 'Inspect issue comments before any retry.' };
    if (!parseIssueUrl(comment.stdout, input.repository, true)?.commentId || !comment.stdout.startsWith(`${issueUrl}#`)) return { action: 'publish', status: 'partial', stage: 'publish-approval', digest, issueUrl, outcomes: { create, comment }, next: 'Inspect issue comments before any retry.' };
    const approval = await inspectApprovedIssue({ repository: input.repository, issueUrl, trustedActors: input.trustedActors }, spawn);
    if (approval.status !== 'valid' || approval.record.commentUrl !== comment.stdout) return { action: 'publish', status: approval.status === 'unknown' ? 'unknown' : 'partial', stage: 'verify-approval', digest, issueUrl, outcomes: { create, comment }, approval, next: 'Inspect issue comments before any retry.' };
    return { action: 'publish', status: 'published', digest, issueUrl, approvalUrl: comment.stdout };
  }

  if (input.action === 'enqueue') {
    if (!parseIssueUrl(input.issueUrl, input.repository)) return { action: 'enqueue', status: 'rejected', digest, errors: ['issueUrl must belong to project repository'] };
    /** Reviewed target and validated project mapping must be byte-equivalent before intake mutation. */
    const project = input.project?.githubProject;
    const target = input.issue.projectTarget;
    if (!project || !target) return { action: 'enqueue', status: 'rejected', digest, errors: ['Project configuration and issue.projectTarget are required'] };
    const expectedTarget = { owner: project.owner, number: project.number, projectId: project.id, statusFieldId: project.statusFieldId, readyOptionId: project.statusOptionIds.ready, readyStatus: project.statuses.ready };
    if (canonicalJson(target) !== canonicalJson(expectedTarget)) return { action: 'enqueue', status: 'rejected', digest, errors: ['issue.projectTarget does not match project configuration'] };
    /** Remote approval is reauthenticated immediately before Project state is considered. */
    const approval = await inspectApprovedIssue({ repository: input.repository, issueUrl: input.issueUrl, trustedActors: input.trustedActors }, spawn);
    if (approval.status !== 'valid' || approval.record.artifact.issueDigest !== digest || canonicalJson(approval.record.artifact.issue) !== canonicalJson(input.issue)) return { action: 'enqueue', status: 'rejected', digest, errors: ['issue does not match one trusted approval record'], approval };
    /** Complete preflight inventory prevents duplicate items and status resets. */
    const before = await fetchProjectItems(project, spawn);
    if (before.status !== 'succeeded') return { action: 'enqueue', status: before.status === 'unknown' ? 'unknown' : 'rejected', stage: 'preflight-project', digest, before };
    const existing = before.items.filter((item) => item?.content?.url === input.issueUrl);
    if (existing.length > 1) return { action: 'enqueue', status: 'rejected', digest, errors: ['multiple Project items reference issueUrl'] };
    if (existing.length === 1) {
      if (!validProjectIssue(existing[0], project, input.repository, input.issueUrl)) return { action: 'enqueue', status: 'rejected', digest, errors: ['existing Project item is archived, draft, or repository-mismatched'] };
      const status = projectSingleSelect(existing[0], project.statusFieldId);
      return status?.optionId === project.statusOptionIds.ready ? { action: 'enqueue', status: 'already-enqueued', digest, issueUrl: input.issueUrl, itemId: existing[0].id } : { action: 'enqueue', status: 'rejected', digest, errors: [`issue already has Project status ${status?.name ?? 'unknown'}`] };
    }
    /** Add, status mutation, and readback outcomes remain stage-separated for safe recovery. */
    let add;
    try { add = await invoke(spawn, ['gh', 'project', 'item-add', String(project.number), '--owner', project.owner, '--url', input.issueUrl, '--format', 'json']); }
    catch (error) { return { action: 'enqueue', status: 'unknown', stage: 'add-item', digest, error: safeError(error), next: 'Inspect complete Project state before retrying.' }; }
    if (add.exitCode !== 0) return { action: 'enqueue', status: 'failed', stage: 'add-item', digest, outcome: add };
    let itemId;
    try { const parsed = JSON.parse(add.stdout); itemId = parsed.id ?? parsed.item?.id; } catch {}
    if (typeof itemId !== 'string' || itemId === '') return { action: 'enqueue', status: 'partial', stage: 'add-item', digest, outcome: add, next: 'Inspect complete Project state before retrying.' };
    let setReady;
    try { setReady = await invoke(spawn, ['gh', 'project', 'item-edit', '--id', itemId, '--project-id', project.id, '--field-id', project.statusFieldId, '--single-select-option-id', project.statusOptionIds.ready]); }
    catch (error) { return { action: 'enqueue', status: 'partial', stage: 'set-ready', digest, issueUrl: input.issueUrl, itemId, outcomes: { add }, error: safeError(error), next: 'Inspect complete Project state before retrying.' }; }
    if (setReady.exitCode !== 0) return { action: 'enqueue', status: 'partial', stage: 'set-ready', digest, issueUrl: input.issueUrl, itemId, outcomes: { add, setReady } };
    /** Readback is the only evidence that the new item reached the reviewed Ready status. */
    const after = await fetchProjectItems(project, spawn);
    const confirmed = after.status === 'succeeded' && after.items.some((item) => item?.id === itemId && validProjectIssue(item, project, input.repository, input.issueUrl) && projectSingleSelect(item, project.statusFieldId)?.optionId === project.statusOptionIds.ready);
    return confirmed ? { action: 'enqueue', status: 'enqueued', digest, issueUrl: input.issueUrl, itemId, outcomes: { add, setReady } } : { action: 'enqueue', status: 'partial', stage: 'verify-ready', digest, issueUrl: input.issueUrl, itemId, outcomes: { add, setReady, verify: after }, next: 'Inspect complete Project state before retrying.' };
  }
  return { action: input.action, status: 'rejected', errors: ['action must be preview, publish, or enqueue'] };
}
