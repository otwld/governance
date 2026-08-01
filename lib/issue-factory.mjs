import { contractDigest, renderIssue, validateContract } from './contracts.mjs';

function safeError(error) {
  const message = (error instanceof Error ? error.message : String(error))
    .replace(/(authorization:\s*(?:bearer|token)\s+)\S+/gi, '$1[redacted]')
    .replace(/\b(?:gh[pousr]_[A-Za-z0-9_]{20,}|github_pat_[A-Za-z0-9_]+)\b/g, '[redacted]');
  return { name: error instanceof Error ? error.name : 'Error', message };
}

async function invoke(spawn, argv) {
  const outcome = await spawn(argv);
  if (!outcome || typeof outcome !== 'object' || !Number.isInteger(outcome.exitCode) || typeof outcome.stdout !== 'string' || typeof outcome.stderr !== 'string') throw new Error('command returned an invalid outcome');
  return outcome;
}

function issueUrl(url, repository) {
  const match = /^https:\/\/github\.com\/([^/]+\/[^/]+)\/issues\/(\d+)$/.exec(url ?? '');
  return match && match[1].toLowerCase() === repository.toLowerCase() ? { repository: match[1], number: match[2] } : undefined;
}

function passingIssueReview(review, digest) {
  const errors = validateContract('review', review);
  if (errors.length || review?.subjectKind !== 'issue' || review?.verdict !== 'PASS' || review?.subjectDigest !== digest) {
    return [...errors, 'a matching PASS issue review is required'];
  }
  return [];
}

export async function executeIssueFactory(input, spawn) {
  const issueErrors = validateContract('issue', input.issue);
  if (issueErrors.length) return { action: input.action, status: 'rejected', errors: issueErrors };
  const digest = contractDigest('issue', input.issue);
  const body = renderIssue(input.issue);
  if (input.action === 'preview') return { action: 'preview', status: 'ready', digest, preview: body };
  if (input.digest !== digest) return { action: input.action, status: 'rejected', digest, errors: ['digest does not match the issue contract'] };
  const reviewErrors = passingIssueReview(input.review, digest);
  if (reviewErrors.length) return { action: input.action, status: 'rejected', digest, errors: reviewErrors };

  if (input.action === 'publish') {
    let outcome;
    try { outcome = await invoke(spawn, ['gh', 'issue', 'create', '--repo', input.issue.repository, '--title', input.issue.title, '--body', body]); }
    catch (error) { return { action: 'publish', status: 'unknown', stage: 'publish', digest, error: safeError(error), next: 'Publication may have reached GitHub; verify repository state before any retry.' }; }
    if (outcome.exitCode !== 0) return { action: 'publish', status: 'failed', stage: 'publish', digest, outcome };
    if (!issueUrl(outcome.stdout, input.issue.repository)) return { action: 'publish', status: 'partial', stage: 'publish', digest, outcome, next: 'Verify repository state before any retry.' };
    return { action: 'publish', status: 'published', digest, url: outcome.stdout };
  }

  if (input.action === 'enqueue') {
    if (!issueUrl(input.issueUrl, input.issue.repository)) return { action: 'enqueue', status: 'rejected', digest, errors: ['issueUrl must belong to issue.repository'] };
    const target = input.issue.projectTarget;
    if (!target) return { action: 'enqueue', status: 'rejected', digest, errors: ['issue.projectTarget is required for enqueue'] };
    let add;
    try { add = await invoke(spawn, ['gh', 'project', 'item-add', String(target.number), '--owner', target.owner, '--url', input.issueUrl, '--format', 'json']); }
    catch (error) { return { action: 'enqueue', status: 'failed', stage: 'add-item', digest, issueUrl: input.issueUrl, error: safeError(error), next: 'No Project item was confirmed; inspect Project state before retrying.' }; }
    if (add.exitCode !== 0) return { action: 'enqueue', status: 'failed', stage: 'add-item', digest, issueUrl: input.issueUrl, outcome: add };
    let itemId;
    try {
      const parsed = JSON.parse(add.stdout);
      itemId = parsed.id ?? parsed.item?.id;
    } catch {}
    if (typeof itemId !== 'string' || itemId.trim() === '') return { action: 'enqueue', status: 'partial', stage: 'add-item', digest, issueUrl: input.issueUrl, outcome: add, next: 'The item may exist; verify Project state before any retry.' };
    let setReady;
    try { setReady = await invoke(spawn, ['gh', 'project', 'item-edit', '--id', itemId, '--project-id', target.projectId, '--field-id', target.statusFieldId, '--single-select-option-id', target.readyOptionId]); }
    catch (error) { return { action: 'enqueue', status: 'partial', stage: 'set-ready', digest, issueUrl: input.issueUrl, itemId, outcomes: { add }, error: safeError(error), next: 'The item was added; verify its status before any retry.' }; }
    if (setReady.exitCode !== 0) return { action: 'enqueue', status: 'partial', stage: 'set-ready', digest, issueUrl: input.issueUrl, itemId, outcomes: { add, setReady }, next: 'The item was added but its ready status was not confirmed.' };
    return { action: 'enqueue', status: 'enqueued', digest, issueUrl: input.issueUrl, itemId, outcomes: { add, setReady } };
  }

  return { action: input.action, status: 'rejected', errors: ['action must be preview, publish, or enqueue'] };
}
