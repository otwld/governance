import { changeDigest, contractDigest, extractApprovedIssueRecord, validateChangeBoundary, validateContract } from './contracts.mjs';
import { validateProjectConfig } from './validation.mjs';
import { fetchProjectItems, projectSingleSelect } from './project-items.mjs';

/** Committed-tree comparisons require full lowercase Git object IDs, never abbreviations. */
const gitOidPattern = /^(?:[a-f0-9]{40}|[a-f0-9]{64})$/;

/** Protocol records exclude null and arrays before property access. */
function record(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

/** Prevent credentials in process exceptions from crossing the tool boundary. */
function safeError(error) {
  const message = (error instanceof Error ? error.message : String(error))
    .replace(/(authorization:\s*(?:bearer|token)\s+)\S+/gi, '$1[redacted]')
    .replace(/\b(?:gh[pousr]_[A-Za-z0-9_]{20,}|github_pat_[A-Za-z0-9_]+)\b/g, '[redacted]');
  return { name: error instanceof Error ? error.name : 'Error', message };
}

/** Require command adapters to preserve exit and stream evidence. */
async function invoke(spawn, argv) {
  const outcome = await spawn(argv);
  if (!record(outcome) || !Number.isInteger(outcome.exitCode) || typeof outcome.stdout !== 'string' || typeof outcome.stderr !== 'string') throw new Error('command returned an invalid outcome');
  return outcome;
}

/** Bind an issue or comment URL to the configured repository. */
function issueIdentity(url, repository) {
  if (typeof url !== 'string' || typeof repository !== 'string') return undefined;
  const match = /^https:\/\/github\.com\/([^/]+\/[^/]+)\/issues\/(\d+)(?:#issuecomment-(\d+))?$/.exec(url);
  return match && match[1].toLowerCase() === repository.toLowerCase() ? { repository: match[1], number: match[2], commentId: match[3] } : undefined;
}

/** Compare a reviewed tree with the tree later recorded by a commit. */
export function compareCommittedTree(boundary, committedTreeOid) {
  /** Boundary errors take precedence so a malformed reviewed tree cannot be compared as evidence. */
  const diagnostics = validateChangeBoundary(boundary);
  if (typeof committedTreeOid !== 'string' || !gitOidPattern.test(committedTreeOid)) diagnostics.push('committedTreeOid: must be a full lowercase SHA-1 or SHA-256 Git OID');
  else if (diagnostics.length === 0 && boundary.treeOid !== committedTreeOid) diagnostics.push('committedTreeOid: does not match change.treeOid');
  return diagnostics;
}

/** Authenticate exactly one approval record from trusted issue-comment metadata. */
export function inspectApprovalComments(comments, { repository, issueUrl, trustedActors }) {
  /** Actor normalization and trusted records are kept separate from ignored untrusted marker noise. */
  const diagnostics = [];
  const actors = new Set(trustedActors.map((actor) => actor.toLowerCase()));
  const trusted = [];
  for (const [index, comment] of comments.entries()) {
    const extracted = extractApprovedIssueRecord(comment?.body, { repository });
    if (!extracted.matched) continue;
    const author = comment?.author?.login;
    if (typeof author !== 'string' || !actors.has(author.toLowerCase())) {
      diagnostics.push(`comments[${index}]: ignored approval marker from unauthorized actor`);
      continue;
    }
    const identity = issueIdentity(comment?.url, repository);
    if (!identity || comment.url.split('#')[0] !== issueUrl) {
      diagnostics.push(`comments[${index}]: trusted approval comment URL does not match issue`);
      continue;
    }
    if (extracted.diagnostics.length) diagnostics.push(...extracted.diagnostics.map((message) => `comments[${index}]: ${message}`));
    else trusted.push({ artifact: extracted.artifact, author, commentUrl: comment.url });
  }
  if (trusted.length !== 1) diagnostics.push(`approval records: expected exactly one trusted valid record, found ${trusted.length}`);
  return diagnostics.some((message) => !message.includes('unauthorized actor')) ? { status: 'invalid', diagnostics, records: trusted } : { status: 'valid', diagnostics, record: trusted[0], records: trusted };
}

/** Fetch and authenticate approval provenance for one issue. */
export async function inspectApprovedIssue(input, spawn) {
  if (!issueIdentity(input.issueUrl, input.repository)) return { status: 'rejected', diagnostics: ['issueUrl: must belong to repository'] };
  /** The command outcome and decoded response remain available for precise failure classification. */
  let outcome;
  try { outcome = await invoke(spawn, ['gh', 'issue', 'view', input.issueUrl, '--repo', input.repository, '--json', 'comments,url']); }
  catch (error) { return { status: 'unknown', error: safeError(error), next: 'No trusted issue approval was confirmed.' }; }
  if (outcome.exitCode !== 0) return { status: 'failed', outcome };
  let remote;
  try { remote = JSON.parse(outcome.stdout); }
  catch { return { status: 'invalid', diagnostics: ['GitHub response: must be valid JSON'], outcome }; }
  if (!record(remote) || remote.url !== input.issueUrl || !Array.isArray(remote.comments)) return { status: 'invalid', diagnostics: ['GitHub response: must bind the requested issue and comments'], outcome };
  return inspectApprovalComments(remote.comments, input);
}

/** Convert GraphQL Project nodes into the queue's normalized contract by immutable field IDs. */
export function normalizeProjectItems(projectConfig, nodes) {
  if (!Array.isArray(nodes)) return { status: 'blocked', diagnostics: ['Project items: must be an array'] };
  const project = projectConfig.githubProject;
  const diagnostics = [];
  const items = nodes.map((item, index) => {
    const content = item?.content;
    const type = item?.type === 'ISSUE' || content?.__typename === 'Issue' ? 'issue' : item?.type === 'DRAFT_ISSUE' || content?.__typename === 'DraftIssue' ? 'draft' : undefined;
    const archived = item?.isArchived === true;
    if (type === 'draft' || archived) return { id: item?.id, type: type ?? 'issue', archived, statusOptionId: undefined, priorityOptionId: null, projectOrder: index, repository: content?.repository?.nameWithOwner ?? projectConfig.repository, issueUrl: content?.url ?? null };
    if (!type) {
      diagnostics.push(`items[${index}].content.type: unsupported item type`);
      return { id: item?.id, type, archived, statusOptionId: undefined, priorityOptionId: null, projectOrder: index, repository: projectConfig.repository, issueUrl: null };
    }
    const status = projectSingleSelect(item, project.statusFieldId);
    const priority = projectSingleSelect(item, project.priorityFieldId);
    const statusOptionId = status?.optionId;
    const priorityOptionId = priority?.optionId ?? null;
    if (!statusOptionId) diagnostics.push(`items[${index}].status: missing configured status field`);
    if (priority && !project.priorityOptions.some((option) => option.optionId === priority.optionId && option.name === priority.name)) diagnostics.push(`items[${index}].priority: unknown configured priority option`);
    return { id: item?.id, type, archived, statusOptionId, priorityOptionId, projectOrder: index, repository: content?.repository?.nameWithOwner ?? projectConfig.repository, issueUrl: content?.url ?? null };
  });
  return diagnostics.length ? { status: 'blocked', diagnostics } : { status: 'valid', items };
}

/** Order ready items by priority rank, Project order, then ASCII ID. */
function compareQueueItems(left, right, priorities, missingRank) {
  const leftPriority = left.priorityOptionId === null ? missingRank : priorities.get(left.priorityOptionId);
  const rightPriority = right.priorityOptionId === null ? missingRank : priorities.get(right.priorityOptionId);
  return leftPriority - rightPriority || left.projectOrder - right.projectOrder || (left.id < right.id ? -1 : left.id > right.id ? 1 : 0);
}

/** Select one normalized, non-draft, non-archived issue or resume one in-flight issue. */
export function selectDeterministicQueue(projectConfig, items) {
  /** Selection derives only from validated configuration and normalized item evidence. */
  const projectDiagnostics = validateProjectConfig(projectConfig).map(({ path, message }) => `${path}: ${message}`);
  if (projectDiagnostics.length) return { status: 'blocked', diagnostics: projectDiagnostics };
  const project = projectConfig.githubProject;
  if (!project || !Array.isArray(items)) return { status: 'blocked', diagnostics: ['queue: Project config and normalized items are required'] };
  /** Diagnostics distinguish ineligible entries from ambiguity that blocks the entire queue. */
  const diagnostics = [];
  const eligible = [];
  const priorities = new Map(project.priorityOptions.map(({ optionId }, index) => [optionId, index]));
  const statuses = new Set(Object.values(project.statusOptionIds));
  const ids = new Set();
  for (const [index, item] of items.entries()) {
    const path = `items[${index}]`;
    if (!record(item)) { diagnostics.push(`${path}: must be an object`); continue; }
    if (typeof item.id !== 'string' || item.id === '' || ids.has(item.id)) diagnostics.push(`${path}.id: must be non-empty and unique`); else ids.add(item.id);
    if (item.type !== 'issue') { diagnostics.push(`${path}: draft items are ineligible`); continue; }
    if (item.archived !== false) { diagnostics.push(`${path}: archived items are ineligible`); continue; }
    if (!statuses.has(item.statusOptionId)) diagnostics.push(`${path}.statusOptionId: unknown option ID`);
    if (item.priorityOptionId !== null && !priorities.has(item.priorityOptionId)) diagnostics.push(`${path}.priorityOptionId: unknown option ID`);
    if (!Number.isFinite(item.projectOrder) || item.projectOrder < 0) diagnostics.push(`${path}.projectOrder: must be non-negative`);
    if (item.repository !== projectConfig.repository || !issueIdentity(item.issueUrl, projectConfig.repository)) diagnostics.push(`${path}.issueUrl: must belong to project repository`);
    eligible.push(item);
  }
  const blocking = diagnostics.filter((message) => !/draft items are ineligible|archived items are ineligible/.test(message));
  if (blocking.length) return { status: 'blocked', diagnostics };
  /** In-flight work always outranks new Ready selection and must be unique. */
  const inFlight = eligible.filter((item) => [project.statusOptionIds.active, project.statusOptionIds.review].includes(item.statusOptionId));
  if (inFlight.length > 1) return { status: 'blocked', diagnostics: [...diagnostics, 'queue: multiple active or review items'] };
  if (inFlight.length === 1) return { status: 'resume', item: inFlight[0], diagnostics };
  /** Missing-priority policy is converted to a stable rank before Project-order tie breaking. */
  const missingRank = project.missingPriority === 'first' ? -1 : priorities.size;
  const ready = eligible.filter((item) => item.statusOptionId === project.statusOptionIds.ready).sort((left, right) => compareQueueItems(left, right, priorities, missingRank));
  return ready.length ? { status: 'selected', item: ready[0], diagnostics } : { status: 'empty', diagnostics };
}

/** Execute read-only contract, approval, change, and authoritative queue checks. */
export async function executeGovernanceCheck(input, spawn) {
  if (!record(input)) return { action: undefined, status: 'rejected', diagnostics: ['input: must be an object'] };
  if (input.action === 'contract') {
    /** Contract digests are returned only after kind-specific validation succeeds. */
    const diagnostics = validateContract(input.kind, input.value, input.context);
    return diagnostics.length ? { action: 'contract', status: 'invalid', diagnostics } : { action: 'contract', status: 'valid', diagnostics, digest: contractDigest(input.kind, input.value, input.context) };
  }
  if (input.action === 'change') {
    /** Supplied boundaries and optional committed trees share the same immutable digest contract. */
    const boundary = { baseCommit: input.baseCommit, treeOid: input.treeOid };
    const diagnostics = input.committedTreeOid === undefined ? validateChangeBoundary(boundary) : compareCommittedTree(boundary, input.committedTreeOid);
    return diagnostics.length ? { action: 'change', status: 'invalid', diagnostics } : { action: 'change', status: 'valid', diagnostics, boundary, digest: changeDigest(boundary) };
  }
  if (input.action === 'approved-issue') return { action: 'approved-issue', ...(await inspectApprovedIssue(input, spawn)) };
  if (input.action === 'queue') {
    /** Queue reads require a complete validated Project mapping before any remote request. */
    const projectDiagnostics = validateProjectConfig(input.project).map(({ path, message }) => `${path}: ${message}`);
    if (projectDiagnostics.length || !input.project.githubProject) return { action: 'queue', status: 'rejected', diagnostics: projectDiagnostics.length ? projectDiagnostics : ['project.githubProject: required'] };
    const project = input.project.githubProject;
    const fetched = await fetchProjectItems(project, spawn);
    if (fetched.status !== 'succeeded') return { action: 'queue', ...fetched };
    const normalized = normalizeProjectItems(input.project, fetched.items);
    if (normalized.status !== 'valid') return { action: 'queue', ...normalized };
    const selection = selectDeterministicQueue(input.project, normalized.items);
    if (!['selected', 'resume'].includes(selection.status)) return { action: 'queue', ...selection };
    const approval = await inspectApprovedIssue({ repository: input.repository, issueUrl: selection.item.issueUrl, trustedActors: input.trustedActors }, spawn);
    if (approval.status !== 'valid') return { action: 'queue', status: 'blocked', diagnostics: ['selected issue lacks one trusted approval record', ...(approval.diagnostics ?? [])], selection, approval };
    return { action: 'queue', ...selection, approval: approval.record };
  }
  return { action: input.action, status: 'rejected', diagnostics: ['action: must be contract, approved-issue, change, or queue'] };
}
