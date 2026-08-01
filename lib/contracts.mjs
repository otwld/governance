import { createHash } from 'node:crypto';

/** Treat only plain record-like containers as safe for contract property traversal. */
const record = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
/** Enforce contract text as meaningful content rather than merely a string value. */
const nonempty = (value) => typeof value === 'string' && value.trim() !== '';
/** Canonical digests are lowercase SHA-256 values with an explicit algorithm prefix. */
const digestPattern = /^sha256:[a-f0-9]{64}$/;
/** Stable IDs remain human-readable and insensitive to prose or array reordering. */
const idPattern = /^[A-Z][A-Z0-9-]*$/;
/** Change boundaries require full lowercase Git object IDs to avoid ambiguous abbreviations. */
const gitOidPattern = /^(?:[a-f0-9]{40}|[a-f0-9]{64})$/;
/** Dedicated approval-record comments keep provenance separate from editable issue prose. */
const approvedRecordBegin = '<!-- governance-approved-issue-record:begin';
const approvedRecordEnd = 'governance-approved-issue-record:end -->';

/** Enforce closed contract objects while preserving deterministic, multi-error diagnostics. */
function exact(value, allowed, required, path, errors) {
  if (!record(value)) {
    errors.push(`${path}: must be an object`);
    return false;
  }
  for (const key of Object.keys(value)) if (!allowed.includes(key)) errors.push(`${path}.${key}: unknown property`);
  for (const key of required) if (!(key in value)) errors.push(`${path}.${key}: required`);
  return true;
}

/** Attach the shared meaningful-text failure to its precise contract path. */
function string(value, path, errors) {
  if (!nonempty(value)) errors.push(`${path}: must be a non-empty string`);
}

/** Validate a text collection without permitting empty evidence entries. */
function stringArray(value, path, errors, { min = 0 } = {}) {
  if (!Array.isArray(value) || value.length < min || value.some((item) => !nonempty(item))) {
    errors.push(`${path}: must be an array of non-empty strings${min ? ` with at least ${min} item(s)` : ''}`);
    return false;
  }
  return true;
}

/** Establish a safe iterable container before nested object validation proceeds. */
function objectArray(value, path, errors, { min = 0 } = {}) {
  if (!Array.isArray(value) || value.length < min) {
    errors.push(`${path}: must be an array with at least ${min} item(s)`);
    return false;
  }
  return true;
}

/** Stable uppercase IDs keep cross-contract references independent of display prose. */
function stableId(value, path, errors) {
  if (typeof value !== 'string' || !idPattern.test(value)) errors.push(`${path}: must be a stable uppercase ID`);
}

/** Diagnose duplicate IDs without letting malformed neighboring entries abort validation. */
function uniqueIds(items, path, errors) {
  /** The set is the independent uniqueness oracle for otherwise order-preserving diagnostics. */
  if (!Array.isArray(items)) return;
  const seen = new Set();
  for (const [index, item] of items.entries()) {
    if (!record(item) || !nonempty(item.id)) continue;
    if (seen.has(item.id)) errors.push(`${path}[${index}].id: duplicate ID ${item.id}`);
    seen.add(item.id);
  }
}

/** The issue-embedded Project target freezes the exact intake destination reviewed before publication. */
function validateProjectTarget(value, path, errors) {
  /** Project target fields form one immutable handoff from reviewed issue to intake mutation. */
  const fields = ['owner', 'number', 'projectId', 'statusFieldId', 'readyOptionId', 'readyStatus'];
  if (!exact(value, fields, fields, path, errors)) return;
  if (typeof value.owner !== 'string' || !/^[A-Za-z0-9-]+$/.test(value.owner)) errors.push(`${path}.owner: must be a GitHub owner`);
  if (!Number.isInteger(value.number) || value.number < 1) errors.push(`${path}.number: must be a positive integer`);
  for (const key of ['projectId', 'statusFieldId', 'readyOptionId', 'readyStatus']) string(value[key], `${path}.${key}`, errors);
}

/** Documentation impact must state changed surfaces, external effects, and the reason for that scope. */
function validateDocumentation(value, path, actionKey, errors) {
  /** Every impact decision must cover changed declarations/actions, external docs, and rationale. */
  const fields = [actionKey, 'external', 'rationale'];
  if (!exact(value, fields, fields, path, errors)) return;
  stringArray(value[actionKey], `${path}.${actionKey}`, errors);
  stringArray(value.external, `${path}.external`, errors);
  string(value.rationale, `${path}.rationale`, errors);
}

/** Issue approval requires complete evidence, scope, traceable scenarios, validation, and documentation impact. */
function validateIssue(value, errors) {
  /** The closed field roster keeps issue approval independent of object insertion order. */
  const fields = ['repository', 'title', 'outcome', 'problemEvidence', 'requirements', 'scope', 'technicalDirection', 'acceptanceScenarios', 'validation', 'documentation', 'dependencies', 'assumptions', 'references', 'projectTarget'];
  const required = fields.filter((field) => field !== 'projectTarget');
  if (!exact(value, fields, required, 'issue', errors)) return;
  if (typeof value.repository !== 'string' || !/^[^/\s]+\/[^/\s]+$/.test(value.repository)) errors.push('issue.repository: must be owner/name');
  string(value.title, 'issue.title', errors);
  string(value.outcome, 'issue.outcome', errors);
  if (objectArray(value.problemEvidence, 'issue.problemEvidence', errors, { min: 1 })) for (const [index, item] of value.problemEvidence.entries()) {
    const path = `issue.problemEvidence[${index}]`;
    if (exact(item, ['source', 'conclusion'], ['source', 'conclusion'], path, errors)) {
      string(item.source, `${path}.source`, errors);
      string(item.conclusion, `${path}.conclusion`, errors);
    }
  }
  if (objectArray(value.requirements, 'issue.requirements', errors, { min: 1 })) for (const [index, item] of value.requirements.entries()) {
    const path = `issue.requirements[${index}]`;
    if (exact(item, ['id', 'text'], ['id', 'text'], path, errors)) {
      stableId(item.id, `${path}.id`, errors);
      string(item.text, `${path}.text`, errors);
    }
  }
  uniqueIds(value.requirements, 'issue.requirements', errors);
  if (exact(value.scope, ['included', 'excluded'], ['included', 'excluded'], 'issue.scope', errors)) {
    stringArray(value.scope.included, 'issue.scope.included', errors, { min: 1 });
    stringArray(value.scope.excluded, 'issue.scope.excluded', errors);
  }
  if (exact(value.technicalDirection, ['decisions', 'constraints', 'discretion'], ['decisions', 'constraints', 'discretion'], 'issue.technicalDirection', errors)) {
    stringArray(value.technicalDirection.decisions, 'issue.technicalDirection.decisions', errors);
    stringArray(value.technicalDirection.constraints, 'issue.technicalDirection.constraints', errors, { min: 1 });
    stringArray(value.technicalDirection.discretion, 'issue.technicalDirection.discretion', errors);
  }
  if (objectArray(value.acceptanceScenarios, 'issue.acceptanceScenarios', errors, { min: 1 })) for (const [index, item] of value.acceptanceScenarios.entries()) {
    const path = `issue.acceptanceScenarios[${index}]`;
    if (exact(item, ['id', 'given', 'when', 'then'], ['id', 'given', 'when', 'then'], path, errors)) {
      stableId(item.id, `${path}.id`, errors);
      string(item.given, `${path}.given`, errors);
      string(item.when, `${path}.when`, errors);
      stringArray(item.then, `${path}.then`, errors, { min: 1 });
    }
  }
  uniqueIds(value.acceptanceScenarios, 'issue.acceptanceScenarios', errors);
  if (exact(value.validation, ['focused', 'required'], ['focused', 'required'], 'issue.validation', errors)) {
    stringArray(value.validation.focused, 'issue.validation.focused', errors);
    stringArray(value.validation.required, 'issue.validation.required', errors, { min: 1 });
  }
  validateDocumentation(value.documentation, 'issue.documentation', 'declarations', errors);
  for (const key of ['dependencies', 'assumptions', 'references']) stringArray(value[key], `issue.${key}`, errors);
  if (value.projectTarget !== undefined) validateProjectTarget(value.projectTarget, 'issue.projectTarget', errors);
}

/** Plans must map every step to validation and, when supplied, to real issue acceptance scenarios. */
function validatePlan(value, errors, context) {
  /** Plan fields and derived ID sets preserve bidirectional step-to-validation traceability. */
  const fields = ['issueDigest', 'summary', 'steps', 'validation', 'documentation', 'risks', 'compatibility', 'rollback'];
  if (!exact(value, fields, fields, 'plan', errors)) return;
  if (typeof value.issueDigest !== 'string' || !digestPattern.test(value.issueDigest)) errors.push('plan.issueDigest: invalid digest');
  string(value.summary, 'plan.summary', errors);
  if (objectArray(value.steps, 'plan.steps', errors, { min: 1 })) for (const [index, item] of value.steps.entries()) {
    const path = `plan.steps[${index}]`;
    if (exact(item, ['id', 'action', 'acceptanceScenarioIds'], ['id', 'action', 'acceptanceScenarioIds'], path, errors)) {
      stableId(item.id, `${path}.id`, errors);
      string(item.action, `${path}.action`, errors);
      if (stringArray(item.acceptanceScenarioIds, `${path}.acceptanceScenarioIds`, errors, { min: 1 })) {
        for (const [referenceIndex, reference] of item.acceptanceScenarioIds.entries()) stableId(reference, `${path}.acceptanceScenarioIds[${referenceIndex}]`, errors);
        if (new Set(item.acceptanceScenarioIds).size !== item.acceptanceScenarioIds.length) errors.push(`${path}.acceptanceScenarioIds: references must be unique`);
      }
    }
  }
  uniqueIds(value.steps, 'plan.steps', errors);
  if (objectArray(value.validation, 'plan.validation', errors, { min: 1 })) for (const [index, item] of value.validation.entries()) {
    const path = `plan.validation[${index}]`;
    if (exact(item, ['stepId', 'commands'], ['stepId', 'commands'], path, errors)) {
      stableId(item.stepId, `${path}.stepId`, errors);
      stringArray(item.commands, `${path}.commands`, errors, { min: 1 });
    }
  }
  /** Empty fallbacks preserve total cross-reference validation after shape errors. */
  const validations = Array.isArray(value.validation) ? value.validation : [];
  const steps = Array.isArray(value.steps) ? value.steps : [];
  const validationIds = validations.map((item) => record(item) ? item.stepId : undefined);
  if (new Set(validationIds).size !== validationIds.length) errors.push('plan.validation: stepId values must be unique');
  const stepIds = new Set(steps.map((item) => record(item) ? item.id : undefined).filter(nonempty));
  for (const [index, id] of validationIds.entries()) if (!stepIds.has(id)) errors.push(`plan.validation[${index}].stepId: references missing step ${id}`);
  for (const id of stepIds) if (!validationIds.includes(id)) errors.push(`plan.validation: missing mapping for step ${id}`);
  stringArray(value.risks, 'plan.risks', errors);
  stringArray(value.compatibility, 'plan.compatibility', errors);
  validateDocumentation(value.documentation, 'plan.documentation', 'actions', errors);
  string(value.rollback, 'plan.rollback', errors);
  if (context.issue) {
    const issueErrors = validateContract('issue', context.issue);
    if (issueErrors.length === 0) {
      if (value.issueDigest !== contractDigest('issue', context.issue)) errors.push('plan.issueDigest: does not match issue');
      const scenarioIds = new Set(context.issue.acceptanceScenarios.map((item) => item.id));
      for (const [stepIndex, step] of steps.entries()) if (record(step) && Array.isArray(step.acceptanceScenarioIds)) for (const scenarioId of step.acceptanceScenarioIds) if (!scenarioIds.has(scenarioId)) errors.push(`plan.steps[${stepIndex}].acceptanceScenarioIds: references missing scenario ${scenarioId}`);
    }
  }
}

/** Review subjects select the exact digest context needed to prevent approval reuse across lifecycle stages. */
function validateReviewBinding(value, errors) {
  /** Subject kind selects the exact digest context needed to prevent cross-stage review reuse. */
  if (!exact(value.subject, ['kind', 'digest'], ['kind', 'digest'], 'review.subject', errors)) return;
  const kinds = ['issue', 'plan', 'change'];
  if (!kinds.includes(value.subject.kind)) errors.push('review.subject.kind: invalid subject kind');
  if (typeof value.subject.digest !== 'string' || !digestPattern.test(value.subject.digest)) errors.push('review.subject.digest: invalid digest');
  const requiredByKind = {
    issue: ['issueDigest'],
    plan: ['issueDigest', 'planDigest'],
    change: ['issueDigest', 'planDigest', 'changeDigest', 'verificationDigest'],
  };
  const required = requiredByKind[value.subject.kind] ?? [];
  if (!exact(value.context, required, required, 'review.context', errors)) return;
  for (const key of required) if (typeof value.context[key] !== 'string' || !digestPattern.test(value.context[key])) errors.push(`review.context.${key}: invalid digest`);
  const subjectKey = { issue: 'issueDigest', plan: 'planDigest', change: 'changeDigest' }[value.subject.kind];
  if (subjectKey && value.context[subjectKey] !== value.subject.digest) errors.push(`review.context.${subjectKey}: must match review.subject.digest`);
}

/** Review verdicts are accepted only when their structured findings carry the matching evidence semantics. */
function validateReview(value, errors) {
  /** The closed review shape keeps findings and verdict evidence within one subject boundary. */
  const fields = ['subject', 'context', 'verdict', 'findings'];
  if (!exact(value, fields, fields, 'review', errors)) return;
  validateReviewBinding(value, errors);
  if (!['PASS', 'CHANGES_REQUIRED', 'BLOCKED'].includes(value.verdict)) errors.push('review.verdict: invalid verdict');
  if (objectArray(value.findings, 'review.findings', errors)) for (const [index, item] of value.findings.entries()) {
    const path = `review.findings[${index}]`;
    if (exact(item, ['id', 'severity', 'location', 'evidence', 'impact', 'correction'], ['id', 'severity', 'location', 'evidence', 'impact', 'correction'], path, errors)) {
      stableId(item.id, `${path}.id`, errors);
      if (!['low', 'medium', 'high', 'blocker'].includes(item.severity)) errors.push(`${path}.severity: invalid severity`);
      for (const key of ['location', 'evidence', 'impact', 'correction']) string(item[key], `${path}.${key}`, errors);
    }
  }
  uniqueIds(value.findings, 'review.findings', errors);
  /** Malformed findings remain diagnosable without making verdict checks throw. */
  const findings = Array.isArray(value.findings) ? value.findings : [];
  if (value.verdict === 'PASS' && findings.length !== 0) errors.push('review.findings: PASS requires no findings');
  if (value.verdict === 'CHANGES_REQUIRED' && findings.length === 0) errors.push('review.findings: CHANGES_REQUIRED requires findings');
  if (value.verdict === 'BLOCKED' && !findings.some((finding) => record(finding) && finding.severity === 'blocker')) errors.push('review.findings: BLOCKED requires a blocker finding');
}

/** Verification status must be derivable from complete command outcomes, targets, skips, and availability. */
function validateVerification(value, errors) {
  /** Verification fields bind command outcomes to one issue, plan, and immutable change. */
  const fields = ['issueDigest', 'planDigest', 'changeDigest', 'status', 'commands'];
  if (!exact(value, fields, fields, 'verification', errors)) return;
  for (const key of ['issueDigest', 'planDigest', 'changeDigest']) if (typeof value[key] !== 'string' || !digestPattern.test(value[key])) errors.push(`verification.${key}: invalid digest`);
  if (!['PASS', 'FAIL', 'BLOCKED'].includes(value.status)) errors.push('verification.status: invalid status');
  if (objectArray(value.commands, 'verification.commands', errors, { min: 1 })) for (const [index, item] of value.commands.entries()) {
    const path = `verification.commands[${index}]`;
    if (exact(item, ['command', 'cwd', 'required', 'exitCode', 'summary', 'testsOrTargets', 'skipped', 'unavailable'], ['command', 'cwd', 'required', 'exitCode', 'summary', 'testsOrTargets', 'skipped'], path, errors)) {
      string(item.command, `${path}.command`, errors);
      string(item.cwd, `${path}.cwd`, errors);
      if (typeof item.required !== 'boolean') errors.push(`${path}.required: must be a boolean`);
      if (item.exitCode !== null && !Number.isInteger(item.exitCode)) errors.push(`${path}.exitCode: must be an integer or null`);
      string(item.summary, `${path}.summary`, errors);
      stringArray(item.testsOrTargets, `${path}.testsOrTargets`, errors, { min: 1 });
      stringArray(item.skipped, `${path}.skipped`, errors);
      if (item.unavailable !== undefined) string(item.unavailable, `${path}.unavailable`, errors);
    }
  }
  /** Verdict semantics still run after malformed command containers are diagnosed. */
  const commands = Array.isArray(value.commands) ? value.commands : [];
  if (value.status === 'PASS' && commands.some((item) => !record(item) || item.exitCode !== 0 || item.unavailable !== undefined || (Array.isArray(item.skipped) && item.skipped.length > 0))) errors.push('verification.commands: PASS requires exit 0 and no unavailable or skipped checks');
  if (value.status === 'FAIL' && !commands.some((item) => record(item) && Number.isInteger(item.exitCode) && item.exitCode !== 0)) errors.push('verification.commands: FAIL requires nonzero command evidence');
  if (value.status === 'BLOCKED' && !commands.some((item) => record(item) && (nonempty(item.unavailable) || (item.required === true && Array.isArray(item.skipped) && item.skipped.length > 0)))) errors.push('verification.commands: BLOCKED requires unavailable or skipped required-check evidence');
}

/** Durable blockers require observed evidence and an exact human action before workflow resumption. */
function validateBlocker(value, errors) {
  /** Blocker fields require both observed evidence and a concrete human recovery action. */
  const fields = ['issueDigest', 'stage', 'reason', 'evidence', 'requiredAction'];
  if (!exact(value, fields, fields, 'blocker', errors)) return;
  if (typeof value.issueDigest !== 'string' || !digestPattern.test(value.issueDigest)) errors.push('blocker.issueDigest: invalid digest');
  for (const key of ['stage', 'reason', 'requiredAction']) string(value[key], `blocker.${key}`, errors);
  stringArray(value.evidence, 'blocker.evidence', errors, { min: 1 });
}

/** Restart checkpoints bind stage and optional artifact references to one repository issue. */
function validateCheckpoint(value, errors) {
  /** Required and optional checkpoint bindings distinguish resumable identity from stage evidence. */
  const required = ['issueDigest', 'mode', 'stage', 'repository', 'issueUrl', 'rounds'];
  const optional = ['planDigest', 'changeDigest', 'verificationDigest', 'planReviewDigest', 'changeReviewDigest', 'projectItemId', 'baseCommit', 'branch', 'headCommit', 'pullRequestUrl', 'blockerDigest'];
  if (!exact(value, [...required, ...optional], required, 'checkpoint', errors)) return;
  for (const key of ['issueDigest', 'planDigest', 'changeDigest', 'verificationDigest', 'planReviewDigest', 'changeReviewDigest', 'blockerDigest']) if (value[key] !== undefined && (typeof value[key] !== 'string' || !digestPattern.test(value[key]))) errors.push(`checkpoint.${key}: invalid digest`);
  for (const key of ['baseCommit', 'headCommit']) if (value[key] !== undefined && (typeof value[key] !== 'string' || !gitOidPattern.test(value[key]))) errors.push(`checkpoint.${key}: invalid Git OID`);
  if (!['issue', 'project'].includes(value.mode)) errors.push('checkpoint.mode: must be issue or project');
  /** The closed lifecycle stage roster prevents checkpoints from inventing unsupported recovery positions. */
  const stages = ['selected', 'active', 'planned', 'plan_reviewed', 'implementing', 'verified', 'change_reviewed', 'committed', 'pushed', 'pr_open', 'ci_green', 'merged', 'done', 'blocked'];
  if (!stages.includes(value.stage)) errors.push('checkpoint.stage: invalid lifecycle stage');
  for (const key of ['projectItemId', 'branch', 'pullRequestUrl']) if (value[key] !== undefined) string(value[key], `checkpoint.${key}`, errors);
  if (typeof value.repository !== 'string' || !/^[^/\s]+\/[^/\s]+$/.test(value.repository)) errors.push('checkpoint.repository: must be owner/name');
  /** URL parsing independently proves the checkpoint issue belongs to its declared repository. */
  const issueMatch = typeof value.issueUrl === 'string' ? /^https:\/\/github\.com\/([^/]+\/[^/]+)\/issues\/\d+$/.exec(value.issueUrl) : undefined;
  if (!issueMatch || typeof value.repository !== 'string' || issueMatch[1].toLowerCase() !== value.repository.toLowerCase()) errors.push('checkpoint.issueUrl: must belong to checkpoint.repository');
  if (exact(value.rounds, ['plan', 'change', 'ci'], ['plan', 'change', 'ci'], 'checkpoint.rounds', errors)) for (const key of ['plan', 'change', 'ci']) if (!Number.isInteger(value.rounds[key]) || value.rounds[key] < 0) errors.push(`checkpoint.rounds.${key}: must be a non-negative integer`);
}

/** Dispatch contract validation without allowing malformed external input to throw. */
export function validateContract(kind, value, context = {}) {
  /** Diagnostic insertion order is stable because callers persist and compare it. */
  const errors = [];
  context = record(context) ? context : {};
  if (kind === 'issue') validateIssue(value, errors);
  else if (kind === 'plan') validatePlan(value, errors, context);
  else if (kind === 'review') validateReview(value, errors);
  else if (kind === 'verification') validateVerification(value, errors);
  else if (kind === 'blocker') validateBlocker(value, errors);
  else if (kind === 'checkpoint') validateCheckpoint(value, errors);
  else errors.push(`unknown contract kind: ${String(kind)}`);
  return errors;
}

/** Canonical ordering removes object insertion order while preserving semantically ordered arrays. */
export function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (!record(value)) return value;
  return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonicalize(value[key])]));
}

/** Newline-terminated canonical JSON is the byte representation used by persisted digests. */
export function canonicalJson(value) {
  return `${JSON.stringify(canonicalize(value))}\n`;
}

/** Canonical SHA-256 makes equivalent object insertion orders share one stable identity. */
export function canonicalDigest(value) {
  return `sha256:${createHash('sha256').update(canonicalJson(value)).digest('hex')}`;
}

/** Contract digests are unavailable until every kind-specific and contextual invariant passes. */
export function contractDigest(kind, value, context = {}) {
  /** Digesting is forbidden until all kind-specific and cross-contract invariants pass. */
  const errors = validateContract(kind, value, context);
  if (errors.length) throw new Error(`invalid ${kind} contract: ${errors.join('; ')}`);
  return canonicalDigest(value);
}

/** A change boundary is exactly one full base commit and one full staged tree OID. */
export function validateChangeBoundary(value) {
  /** Boundary diagnostics are deterministic protocol output. */
  const errors = [];
  if (!exact(value, ['baseCommit', 'treeOid'], ['baseCommit', 'treeOid'], 'change', errors)) return errors;
  for (const key of ['baseCommit', 'treeOid']) if (typeof value[key] !== 'string' || !gitOidPattern.test(value[key])) errors.push(`change.${key}: must be a full lowercase SHA-1 or SHA-256 Git OID`);
  return errors;
}

/** Change identity binds both base history and staged content so neither can drift independently. */
export function changeDigest(value) {
  const errors = validateChangeBoundary(value);
  if (errors.length) throw new Error(`invalid change boundary: ${errors.join('; ')}`);
  return canonicalDigest(value);
}

/** Human issue rendering represents an empty collection explicitly rather than omitting evidence. */
function bullets(items) {
  return items.length ? items.map((item) => `- ${item}`).join('\n') : '- None';
}

/** Issue prose remains editable and readable while deriving from the same validated approval subject. */
export function renderIssue(issue) {
  /** Rendering derives all prose sections from one validated issue to prevent approval drift. */
  const errors = validateContract('issue', issue);
  if (errors.length) throw new Error(`invalid issue contract: ${errors.join('; ')}`);
  const evidence = issue.problemEvidence.map((item) => `- ${item.source}: ${item.conclusion}`).join('\n');
  const requirements = issue.requirements.map((item) => `- **${item.id}** ${item.text}`).join('\n');
  const scenarios = issue.acceptanceScenarios.map((item) => `### ${item.id}\n\n**Given** ${item.given}\n\n**When** ${item.when}\n\n**Then**\n${bullets(item.then)}`).join('\n\n');
  const target = issue.projectTarget ? `\n\n## Project target\n\n- Owner: ${issue.projectTarget.owner}\n- Number: ${issue.projectTarget.number}\n- Project ID: ${issue.projectTarget.projectId}\n- Status field ID: ${issue.projectTarget.statusFieldId}\n- Ready option ID: ${issue.projectTarget.readyOptionId}\n- Ready status: ${issue.projectTarget.readyStatus}` : '';
  return `# ${issue.title}\n\n## Outcome\n\n${issue.outcome}\n\n## Problem evidence\n\n${evidence}\n\n## Requirements\n\n${requirements}\n\n## Scope\n\n### Included\n${bullets(issue.scope.included)}\n\n### Excluded\n${bullets(issue.scope.excluded)}\n\n## Technical direction\n\n### Decisions\n${bullets(issue.technicalDirection.decisions)}\n\n### Constraints\n${bullets(issue.technicalDirection.constraints)}\n\n### Discretion\n${bullets(issue.technicalDirection.discretion)}\n\n## Acceptance scenarios\n\n${scenarios}\n\n## Validation\n\n### Focused\n${bullets(issue.validation.focused)}\n\n### Required\n${bullets(issue.validation.required)}\n\n## Documentation impact\n\n### Declarations\n${bullets(issue.documentation.declarations)}\n\n### External\n${bullets(issue.documentation.external)}\n\n### Rationale\n${issue.documentation.rationale}\n\n## Dependencies\n${bullets(issue.dependencies)}\n\n## Assumptions\n${bullets(issue.assumptions)}\n\n## References\n${bullets(issue.references)}${target}\n`;
}

/** The approval envelope binds a PASS review and its digest to the exact issue digest. */
function approvedIssueArtifact(issue, review) {
  /** Independent issue and review digests make every approval binding recomputable after retrieval. */
  const issueDigest = contractDigest('issue', issue);
  const reviewErrors = validateContract('review', review);
  if (reviewErrors.length || review?.subject?.kind !== 'issue' || review?.verdict !== 'PASS' || review?.subject?.digest !== issueDigest || review?.context?.issueDigest !== issueDigest) {
    throw new Error(`invalid issue review: ${[...reviewErrors, 'a matching PASS issue review is required'].join('; ')}`);
  }
  const reviewDigest = contractDigest('review', review);
  /** The outer digest detects any change to either contract or either independently checkable digest. */
  const approved = { issue, issueDigest, review, reviewDigest };
  return { ...approved, approvedDigest: canonicalDigest(approved) };
}

/** Hidden canonical provenance remains separate from editable issue prose and recomputable after retrieval. */
export function renderApprovedIssueRecord(issue, review) {
  /** Canonical base64url keeps the hidden provenance payload byte-stable and marker-safe. */
  const artifact = approvedIssueArtifact(issue, review);
  const encoded = Buffer.from(canonicalJson(artifact), 'utf8').toString('base64url');
  return `${approvedRecordBegin}\n${encoded}\n${approvedRecordEnd}`;
}

/** Marker recognition is separated from full digest verification so malformed approvals cannot be ignored. */
export function extractApprovedIssueRecord(body, { repository } = {}) {
  /** Extraction retains marker recognition separately from validity so malformed authority cannot be ignored. */
  if (typeof body !== 'string' || !body.includes('governance-approved-issue-record:')) return { matched: false, diagnostics: [] };
  const match = /^<!-- governance-approved-issue-record:begin\n([A-Za-z0-9_-]+)\ngovernance-approved-issue-record:end -->$/.exec(body);
  if (!match) return { matched: true, diagnostics: ['approved issue record: malformed marker'] };
  let artifact;
  try {
    const decoded = Buffer.from(match[1], 'base64url');
    if (decoded.toString('base64url') !== match[1]) return { matched: true, diagnostics: ['approved issue record: payload must be canonical base64url'] };
    artifact = JSON.parse(decoded.toString('utf8'));
  } catch {
    return { matched: true, diagnostics: ['approved issue record: payload must be valid JSON'] };
  }
  /** All binding failures accumulate before a record can cross the trust boundary. */
  const diagnostics = [];
  if (!exact(artifact, ['issue', 'issueDigest', 'review', 'reviewDigest', 'approvedDigest'], ['issue', 'issueDigest', 'review', 'reviewDigest', 'approvedDigest'], 'approvedIssue', diagnostics)) return { matched: true, diagnostics };
  const issueErrors = validateContract('issue', artifact.issue);
  const reviewErrors = validateContract('review', artifact.review);
  diagnostics.push(...issueErrors.map((message) => `approvedIssue.${message}`), ...reviewErrors.map((message) => `approvedIssue.${message}`));
  if (issueErrors.length === 0 && artifact.issueDigest !== contractDigest('issue', artifact.issue)) diagnostics.push('approvedIssue.issueDigest: does not match issue');
  if (reviewErrors.length === 0 && artifact.reviewDigest !== contractDigest('review', artifact.review)) diagnostics.push('approvedIssue.reviewDigest: does not match review');
  if (reviewErrors.length === 0 && (artifact.review.subject.kind !== 'issue' || artifact.review.verdict !== 'PASS' || artifact.review.subject.digest !== artifact.issueDigest || artifact.review.context.issueDigest !== artifact.issueDigest)) diagnostics.push('approvedIssue.review: must be a matching PASS issue review');
  if (repository !== undefined && (typeof repository !== 'string' || artifact.issue?.repository?.toLowerCase() !== repository.toLowerCase())) diagnostics.push('approvedIssue.issue.repository: does not match expected repository');
  const approved = { issue: artifact.issue, issueDigest: artifact.issueDigest, review: artifact.review, reviewDigest: artifact.reviewDigest };
  if (artifact.approvedDigest !== canonicalDigest(approved)) diagnostics.push('approvedIssue.approvedDigest: does not match approval');
  if (diagnostics.length === 0 && renderApprovedIssueRecord(artifact.issue, artifact.review) !== body) diagnostics.push('approved issue record: does not match canonical rendering');
  return diagnostics.length ? { matched: true, diagnostics } : { matched: true, diagnostics, artifact };
}
