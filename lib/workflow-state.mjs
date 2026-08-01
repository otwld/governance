import { canonicalDigest, canonicalJson, contractDigest, validateContract } from './contracts.mjs';
import { inspectApprovalComments } from './governance-check.mjs';

/** Workflow links accept only canonical lowercase SHA-256 contract digests. */
const digestPattern = /^sha256:[a-f0-9]{64}$/;
/** The closed artifact roster limits persisted state to lifecycle contracts with known validators. */
const artifactKinds = ['plan', 'plan-review', 'verification', 'change-review', 'blocker', 'checkpoint'];
/** Ambiguous comment mutations always require remote reconciliation before retry. */
const inspectBeforeRetry = 'Inspect the issue comments for this idempotency key before any retry.';
/** Actor allow-lists use GitHub login syntax so provenance comparisons are well-defined. */
const loginPattern = /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,37}[A-Za-z0-9])?$/;

/** Protocol records exclude null and arrays before property access. */
function record(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

/** Redact credentials from a spawn exception. */
function safeError(error) {
  const message = (error instanceof Error ? error.message : String(error))
    .replace(/(authorization:\s*(?:bearer|token)\s+)\S+/gi, '$1[redacted]')
    .replace(/\b(?:gh[pousr]_[A-Za-z0-9_]{20,}|github_pat_[A-Za-z0-9_]+)\b/g, '[redacted]');
  return { name: error instanceof Error ? error.name : 'Error', message };
}

/** Parse an exact GitHub issue URL and bind it to a repository. */
function parseIssueUrl(url, repository) {
  if (typeof url !== 'string' || typeof repository !== 'string') return undefined;
  const match = /^https:\/\/github\.com\/([^/]+\/[^/]+)\/issues\/(\d+)$/.exec(url ?? '');
  return match && match[1].toLowerCase() === repository.toLowerCase() ? { repository: match[1], number: match[2] } : undefined;
}

/** Parse a returned comment URL and bind it to the original issue. */
function parseCommentUrl(url, repository, issueNumber) {
  if (typeof url !== 'string' || typeof repository !== 'string') return undefined;
  const match = /^https:\/\/github\.com\/([^/]+\/[^/]+)\/issues\/(\d+)#issuecomment-(\d+)$/.exec(url ?? '');
  return match && match[1].toLowerCase() === repository.toLowerCase() && match[2] === issueNumber ? { repository: match[1], number: match[2], commentId: match[3] } : undefined;
}

/** Validate an artifact and compute the digest its kind requires. */
function artifactDigest(kind, artifact) {
  /** Each marker kind selects one contract validator and the digest expected from that artifact. */
  if (kind === 'plan') {
    const errors = validateContract('plan', artifact);
    return { errors, expected: errors.length ? undefined : contractDigest('plan', artifact) };
  }
  if (kind === 'verification') {
    const errors = validateContract('verification', artifact);
    return { errors, expected: errors.length ? undefined : contractDigest('verification', artifact) };
  }
  if (kind === 'plan-review' || kind === 'change-review') {
    const errors = validateContract('review', artifact);
    /** The marker kind narrows the general review contract to its lifecycle stage. */
    const requiredKind = kind === 'plan-review' ? 'plan' : 'change';
    if (errors.length === 0 && artifact.subject.kind !== requiredKind) errors.push(`artifact.subject.kind: must be ${requiredKind}`);
    return { errors, expected: errors.length ? undefined : contractDigest('review', artifact) };
  }
  if (kind === 'blocker' || kind === 'checkpoint') {
    const errors = validateContract(kind, artifact);
    return { errors, expected: errors.length ? undefined : contractDigest(kind, artifact) };
  }
  return { errors: ['artifact: unsupported artifact kind'] };
}

/** Validate a case-insensitive actor allow-list used as the authority boundary for fetched comments. */
function trustedActorSet(value, diagnostics) {
  /** Case-folding prevents one GitHub identity from appearing twice in the authority set. */
  if (!Array.isArray(value) || value.length === 0 || value.some((actor) => typeof actor !== 'string' || !loginPattern.test(actor))) {
    diagnostics.push('trustedActors: must be a non-empty array of GitHub logins');
    return new Set();
  }
  const actors = new Set(value.map((actor) => actor.toLowerCase()));
  if (actors.size !== value.length) diagnostics.push('trustedActors: values must be unique ignoring case');
  return actors;
}

/** Render the only comment body accepted by the workflow-state publisher. */
export function renderWorkflowStateArtifact({ repository, issueUrl, artifactKind, artifact, digest, priorDigest }) {
  /** Identity excludes comment metadata so retries produce the same lookup key. */
  const identity = { repository, issueUrl, artifactKind, digest, ...(priorDigest === undefined ? {} : { priorDigest }) };
  /** The idempotency key binds lifecycle identity while omitting mutable comment metadata. */
  const idempotencyKey = canonicalDigest(identity).slice('sha256:'.length);
  const payload = { artifact, artifactKind, digest, idempotencyKey, ...(priorDigest === undefined ? {} : { priorDigest }), repository, issueUrl };
  /** Base64url prevents artifact text from terminating the hidden comment. */
  const encoded = Buffer.from(canonicalJson(payload), 'utf8').toString('base64url');
  /** One repeated marker frames the payload and detects truncation or cross-kind substitution. */
  const marker = `governance-workflow-state:${artifactKind}:${idempotencyKey}`;
  return { body: `<!-- ${marker}:begin\n${encoded}\n${marker}:end -->`, idempotencyKey };
}

/** Extract and authenticate the canonical structure of one workflow-state marker body. */
export function extractWorkflowStateArtifact(body, { repository, issueUrl } = {}) {
  if (typeof body !== 'string') return { matched: false, diagnostics: ['workflow state body: must be a string'] };
  if (!body.includes('governance-workflow-state:')) return { matched: false, diagnostics: [] };
  /** A full-body match prevents valid markers from blessing surrounding attacker-controlled prose. */
  const match = /^<!-- governance-workflow-state:([^:\n]+):([a-f0-9]{64}):begin\n([A-Za-z0-9_-]+)\ngovernance-workflow-state:\1:\2:end -->$/.exec(body);
  if (!match) return { matched: true, diagnostics: ['workflow state body: malformed marker'] };
  let payload;
  try {
    const decoded = Buffer.from(match[3], 'base64url');
    if (decoded.toString('base64url') !== match[3]) return { matched: true, diagnostics: ['workflow state body: payload must be canonical base64url'] };
    payload = JSON.parse(decoded.toString('utf8'));
  } catch {
    return { matched: true, diagnostics: ['workflow state body: payload must be valid JSON'] };
  }
  /** Closed payload fields and required fields are checked before artifact-specific binding. */
  const diagnostics = [];
  const fields = ['artifact', 'artifactKind', 'digest', 'idempotencyKey', 'priorDigest', 'repository', 'issueUrl'];
  const required = fields.filter((key) => key !== 'priorDigest');
  if (!record(payload)) return { matched: true, diagnostics: ['workflow state payload: must be an object'] };
  for (const key of Object.keys(payload)) if (!fields.includes(key)) diagnostics.push(`workflow state payload.${key}: unknown property`);
  for (const key of required) if (!(key in payload)) diagnostics.push(`workflow state payload.${key}: required`);
  if (!artifactKinds.includes(payload.artifactKind)) diagnostics.push('workflow state payload.artifactKind: invalid artifact kind');
  if (typeof payload.digest !== 'string' || !digestPattern.test(payload.digest)) diagnostics.push('workflow state payload.digest: invalid digest');
  if (payload.priorDigest !== undefined && (typeof payload.priorDigest !== 'string' || !digestPattern.test(payload.priorDigest))) diagnostics.push('workflow state payload.priorDigest: invalid digest');
  const checked = artifactKinds.includes(payload.artifactKind) ? artifactDigest(payload.artifactKind, payload.artifact) : { errors: [], expected: undefined };
  diagnostics.push(...checked.errors.map((message) => `workflow state payload.${message}`));
  if (checked.expected !== undefined && payload.digest !== checked.expected) diagnostics.push('workflow state payload.digest: does not match artifact');
  if (repository !== undefined && payload.repository?.toLowerCase?.() !== repository.toLowerCase()) diagnostics.push('workflow state payload.repository: does not match expected repository');
  if (issueUrl !== undefined && payload.issueUrl !== issueUrl) diagnostics.push('workflow state payload.issueUrl: does not match expected issue URL');
  if (payload.artifactKind !== match[1]) diagnostics.push('workflow state marker: artifact kind does not match payload');
  if (payload.idempotencyKey !== match[2]) diagnostics.push('workflow state marker: idempotency key does not match payload');
  if (diagnostics.length === 0) {
    const rendered = renderWorkflowStateArtifact(payload);
    if (rendered.idempotencyKey !== payload.idempotencyKey) diagnostics.push('workflow state payload.idempotencyKey: does not match identity');
    if (rendered.body !== body) diagnostics.push('workflow state body: does not match canonical rendering');
  }
  return diagnostics.length ? { matched: true, diagnostics } : { matched: true, diagnostics, payload };
}

/** Order fetched evidence by server timestamp and URL without locale-dependent collation. */
function compareComments(left, right) {
  const time = Date.parse(left.createdAt) - Date.parse(right.createdAt);
  if (time) return time;
  return Number(/#issuecomment-(\d+)$/.exec(left.commentUrl)?.[1]) - Number(/#issuecomment-(\d+)$/.exec(right.commentUrl)?.[1]);
}

/** Inspect trusted workflow comments as one approval-bound linear state chain. */
function inspectComments(comments, actors, repository, issueUrl) {
  /** Diagnostics include ignored authority violations without admitting their payloads. */
  const diagnostics = [];
  /** Invalid tracks trusted ambiguity separately from informational unauthorized-marker diagnostics. */
  let invalid = false;
  const approval = inspectApprovalComments(comments, { repository, issueUrl, trustedActors: [...actors] });
  diagnostics.push(...approval.diagnostics);
  if (approval.status !== 'valid') invalid = true;
  /** Trusted artifacts are sorted only after all remote metadata is validated. */
  const artifacts = [];
  for (const [index, comment] of comments.entries()) {
    const extracted = extractWorkflowStateArtifact(comment?.body, { repository, issueUrl });
    if (!extracted.matched) continue;
    const author = comment?.author?.login;
    if (typeof author !== 'string' || !actors.has(author.toLowerCase())) {
      diagnostics.push(`comments[${index}]: ignored workflow marker from unauthorized actor`);
      continue;
    }
    if (extracted.diagnostics.length) {
      invalid = true;
      diagnostics.push(...extracted.diagnostics.map((message) => `comments[${index}]: ${message}`));
      continue;
    }
    if (!parseCommentUrl(comment?.url, repository, parseIssueUrl(issueUrl, repository).number) || typeof comment.createdAt !== 'string' || Number.isNaN(Date.parse(comment.createdAt))) {
      invalid = true;
      diagnostics.push(`comments[${index}]: trusted marker requires issue-bound url and createdAt metadata`);
      continue;
    }
    artifacts.push({ ...extracted.payload, author, commentUrl: comment.url, createdAt: comment.createdAt, body: comment.body });
  }
  artifacts.sort(compareComments);
  /** Chain state records uniqueness and the latest digest for every resumable lifecycle binding. */
  const issueDigest = approval.record?.artifact.issueDigest;
  const digests = new Set();
  const keys = new Set();
  let previousDigest;
  let planDigest;
  let planReviewDigest;
  let planReviewVerdict;
  let verificationDigest;
  let verificationStatus;
  let changeDigest;
  let changeReviewDigest;
  let changeReviewVerdict;
  let blockerDigest;
  for (const [index, entry] of artifacts.entries()) {
    if (digests.has(entry.digest)) { invalid = true; diagnostics.push(`artifacts[${index}]: duplicate digest`); }
    if (keys.has(entry.idempotencyKey)) { invalid = true; diagnostics.push(`artifacts[${index}]: duplicate idempotency key`); }
    digests.add(entry.digest); keys.add(entry.idempotencyKey);
    if (index === 0 && entry.priorDigest !== undefined) { invalid = true; diagnostics.push('artifacts[0]: first artifact must not have priorDigest'); }
    if (index > 0 && entry.priorDigest !== previousDigest) { invalid = true; diagnostics.push(`artifacts[${index}]: priorDigest must equal immediately preceding digest`); }
    const artifact = entry.artifact;
    const artifactIssueDigest = entry.artifactKind.endsWith('-review') ? artifact?.context?.issueDigest : artifact?.issueDigest;
    if (artifactIssueDigest !== issueDigest) { invalid = true; diagnostics.push(`artifacts[${index}]: issueDigest does not match approval`); }
    if (entry.artifactKind === 'plan') {
      planDigest = entry.digest; planReviewDigest = undefined; planReviewVerdict = undefined; verificationDigest = undefined; verificationStatus = undefined; changeDigest = undefined; changeReviewDigest = undefined; changeReviewVerdict = undefined; blockerDigest = undefined;
    }
    else if (entry.artifactKind === 'plan-review') {
      if (!planDigest || artifact.subject.digest !== planDigest || artifact.context.planDigest !== planDigest) { invalid = true; diagnostics.push(`artifacts[${index}]: plan review does not match current plan`); }
      planReviewDigest = entry.digest; planReviewVerdict = artifact.verdict; verificationDigest = undefined; verificationStatus = undefined; changeDigest = undefined; changeReviewDigest = undefined; changeReviewVerdict = undefined; blockerDigest = undefined;
    } else if (entry.artifactKind === 'verification') {
      if (!planDigest || artifact.planDigest !== planDigest || planReviewVerdict !== 'PASS') { invalid = true; diagnostics.push(`artifacts[${index}]: verification requires a current PASS plan review`); }
      verificationDigest = entry.digest; verificationStatus = artifact.status; changeDigest = artifact.changeDigest; changeReviewDigest = undefined; changeReviewVerdict = undefined; blockerDigest = undefined;
    } else if (entry.artifactKind === 'change-review') {
      if (!verificationDigest || verificationStatus !== 'PASS' || artifact.context.planDigest !== planDigest || artifact.context.verificationDigest !== verificationDigest || artifact.context.changeDigest !== changeDigest || artifact.subject.digest !== changeDigest) { invalid = true; diagnostics.push(`artifacts[${index}]: change review requires current PASS verification and exact bindings`); }
      changeReviewDigest = entry.digest; changeReviewVerdict = artifact.verdict;
    } else if (entry.artifactKind === 'blocker') blockerDigest = entry.digest;
    else if (entry.artifactKind === 'checkpoint') {
      const bindings = [['planDigest', planDigest], ['planReviewDigest', planReviewDigest], ['changeDigest', changeDigest], ['verificationDigest', verificationDigest], ['changeReviewDigest', changeReviewDigest], ['blockerDigest', blockerDigest]];
      for (const [key, current] of bindings) if (artifact[key] !== undefined && artifact[key] !== current) { invalid = true; diagnostics.push(`artifacts[${index}]: checkpoint.${key} does not match current state`); }
      /** Stage labels cannot turn non-PASS review or verification evidence into forward progress. */
      const reviewedPlanStages = ['plan_reviewed', 'implementing', 'verified', 'change_reviewed', 'committed', 'pushed', 'pr_open', 'ci_green', 'merged', 'done'];
      const verifiedStages = ['verified', 'change_reviewed', 'committed', 'pushed', 'pr_open', 'ci_green', 'merged', 'done'];
      const reviewedChangeStages = ['change_reviewed', 'committed', 'pushed', 'pr_open', 'ci_green', 'merged', 'done'];
      if (reviewedPlanStages.includes(artifact.stage) && planReviewVerdict !== 'PASS') { invalid = true; diagnostics.push(`artifacts[${index}]: checkpoint stage requires a current PASS plan review`); }
      if (verifiedStages.includes(artifact.stage) && verificationStatus !== 'PASS') { invalid = true; diagnostics.push(`artifacts[${index}]: checkpoint stage requires current PASS verification`); }
      if (reviewedChangeStages.includes(artifact.stage) && changeReviewVerdict !== 'PASS') { invalid = true; diagnostics.push(`artifacts[${index}]: checkpoint stage requires a current PASS change review`); }
      if (artifact.repository !== repository || artifact.issueUrl !== issueUrl) { invalid = true; diagnostics.push(`artifacts[${index}]: checkpoint repository or issue URL mismatch`); }
    }
    previousDigest = entry.digest;
  }
  return { artifacts, diagnostics, invalid, approval: approval.record, head: artifacts.at(-1)?.digest ?? issueDigest, state: { planDigest, planReviewDigest, planReviewVerdict, verificationDigest, verificationStatus, changeDigest, changeReviewDigest, changeReviewVerdict, blockerDigest } };
}

/** Fetch issue comments without interpreting them before repository binding is confirmed. */
async function fetchIssueComments(input, spawn) {
  let outcome;
  try { outcome = await spawn(['gh', 'issue', 'view', input.issueUrl, '--repo', input.repository, '--json', 'comments,url']); }
  catch (error) { return { status: 'unknown', error: safeError(error) }; }
  if (!record(outcome) || !Number.isInteger(outcome.exitCode) || typeof outcome.stdout !== 'string') return { status: 'unknown', errors: ['GitHub issue view returned an invalid outcome'] };
  if (outcome.exitCode !== 0) return { status: 'failed', outcome };
  let remote;
  try { remote = JSON.parse(outcome.stdout); } catch { return { status: 'invalid', errors: ['GitHub response must be valid JSON'] }; }
  return !record(remote) || remote.url !== input.issueUrl || !Array.isArray(remote.comments) ? { status: 'invalid', errors: ['GitHub response must bind the requested issue and comments'] } : { status: 'succeeded', comments: remote.comments };
}

/** Preview or publish one contract-bound workflow artifact as an issue comment. */
export async function executeWorkflowState(input, spawn) {
  if (!record(input)) return { action: undefined, status: 'rejected', errors: ['input must be an object'] };
  /** Input errors accumulate before either remote reads or mutations are permitted. */
  const errors = [];
  if (!['preview', 'publish', 'inspect'].includes(input.action)) errors.push('action must be preview, publish, or inspect');
  if (typeof input.repository !== 'string' || !/^[^/\s]+\/[^/\s]+$/.test(input.repository)) errors.push('repository must be owner/name');
  const issue = errors.some((message) => message.startsWith('repository')) ? undefined : parseIssueUrl(input.issueUrl, input.repository);
  if (!issue) errors.push('issueUrl must belong to repository');
  if (input.action === 'inspect') {
    /** Inspection authenticates actors before fetching and interpreting durable comments. */
    const actors = trustedActorSet(input.trustedActors, errors);
    if (errors.length) return { action: 'inspect', status: 'rejected', errors };
    const fetched = await fetchIssueComments(input, spawn);
    if (fetched.status !== 'succeeded') return { action: 'inspect', ...fetched };
    const inspected = inspectComments(fetched.comments, actors, input.repository, input.issueUrl);
    return { action: 'inspect', status: inspected.invalid ? 'invalid' : 'inspected', ...inspected };
  }
  if (!artifactKinds.includes(input.artifactKind)) errors.push(`artifactKind must be one of ${artifactKinds.join(', ')}`);
  if (typeof input.digest !== 'string' || !digestPattern.test(input.digest)) errors.push('digest must be a canonical sha256 digest');
  if (input.priorDigest !== undefined && (typeof input.priorDigest !== 'string' || !digestPattern.test(input.priorDigest))) errors.push('priorDigest must be a canonical sha256 digest');
  /** Artifact validation independently recomputes the digest claimed by the caller. */
  const checked = artifactKinds.includes(input.artifactKind) ? artifactDigest(input.artifactKind, input.artifact) : { errors: [], expected: undefined };
  errors.push(...checked.errors);
  if (checked.expected !== undefined && input.digest !== checked.expected) errors.push('digest does not match artifact');
  if (errors.length) return { action: input.action, status: 'rejected', errors };
  const actors = trustedActorSet(input.trustedActors, errors);
  let userOutcome;
  try { userOutcome = await spawn(['gh', 'api', 'user', '--jq', '.login']); }
  catch (error) { return { action: input.action, status: 'unknown', error: safeError(error) }; }
  const login = userOutcome?.stdout?.trim();
  if (!record(userOutcome) || userOutcome.exitCode !== 0 || !actors.has(login?.toLowerCase())) return { action: input.action, status: 'rejected', errors: ['current GitHub actor is not trusted'] };
  const fetched = await fetchIssueComments(input, spawn);
  if (fetched.status !== 'succeeded') return { action: input.action, ...fetched };
  const current = inspectComments(fetched.comments, actors, input.repository, input.issueUrl);
  if (current.invalid) return { action: input.action, status: 'rejected', errors: current.diagnostics, current };
  const proposedBody = renderWorkflowStateArtifact(input).body;
  const proposedComment = { body: proposedBody, author: { login }, url: `${input.issueUrl}#issuecomment-9007199254740991`, createdAt: '9999-12-31T23:59:59.999Z' };
  const proposed = inspectComments([...fetched.comments, proposedComment], actors, input.repository, input.issueUrl);
  if (proposed.invalid) return { action: input.action, status: 'rejected', errors: proposed.diagnostics, current };
  /** Preview and publish share one canonical rendering and idempotency key. */
  const rendered = { body: proposedBody, idempotencyKey: renderWorkflowStateArtifact(input).idempotencyKey };
  if (input.action === 'preview') return { action: 'preview', status: 'ready', digest: input.digest, idempotencyKey: rendered.idempotencyKey, preview: rendered.body, next: inspectBeforeRetry };
  let outcome;
  try {
    outcome = await spawn(['gh', 'issue', 'comment', input.issueUrl, '--repo', input.repository, '--body', rendered.body]);
    if (!record(outcome) || !Number.isInteger(outcome.exitCode) || typeof outcome.stdout !== 'string' || typeof outcome.stderr !== 'string') throw new Error('command returned an invalid outcome');
  } catch (error) {
    return { action: 'publish', status: 'unknown', digest: input.digest, idempotencyKey: rendered.idempotencyKey, error: safeError(error), next: inspectBeforeRetry };
  }
  if (outcome.exitCode !== 0) return { action: 'publish', status: 'failed', digest: input.digest, idempotencyKey: rendered.idempotencyKey, outcome, next: inspectBeforeRetry };
  if (!parseCommentUrl(outcome.stdout, input.repository, issue.number)) return { action: 'publish', status: 'partial', digest: input.digest, idempotencyKey: rendered.idempotencyKey, outcome, next: inspectBeforeRetry };
  /** Postflight readback is authoritative for published identity, body, author, predecessor, and final head. */
  const postflight = await fetchIssueComments(input, spawn);
  if (postflight.status !== 'succeeded') return { action: 'publish', status: postflight.status === 'unknown' ? 'unknown' : 'partial', digest: input.digest, url: outcome.stdout, postflight, next: inspectBeforeRetry };
  const authoritative = inspectComments(postflight.comments, actors, input.repository, input.issueUrl);
  if (authoritative.invalid) return { action: 'publish', status: 'conflict', digest: input.digest, url: outcome.stdout, authoritative, next: inspectBeforeRetry };
  const published = authoritative.artifacts.find((entry) => entry.commentUrl === outcome.stdout);
  if (!published || published.digest !== input.digest || published.body !== rendered.body || published.author.toLowerCase() !== login.toLowerCase() || published.priorDigest !== input.priorDigest || authoritative.head !== input.digest) return { action: 'publish', status: 'partial', digest: input.digest, url: outcome.stdout, authoritative, next: inspectBeforeRetry };
  return { action: 'publish', status: 'published', digest: input.digest, idempotencyKey: rendered.idempotencyKey, url: outcome.stdout, next: inspectBeforeRetry };
}
