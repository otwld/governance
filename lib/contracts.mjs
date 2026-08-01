import { createHash } from 'node:crypto';

const record = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
const nonempty = (value) => typeof value === 'string' && value.trim() !== '';
const digestPattern = /^sha256:[a-f0-9]{64}$/;
const idPattern = /^[A-Z][A-Z0-9-]*$/;

function exact(value, allowed, required, path, errors) {
  if (!record(value)) {
    errors.push(`${path}: must be an object`);
    return false;
  }
  for (const key of Object.keys(value)) if (!allowed.includes(key)) errors.push(`${path}.${key}: unknown property`);
  for (const key of required) if (!(key in value)) errors.push(`${path}.${key}: required`);
  return true;
}

function string(value, path, errors) {
  if (!nonempty(value)) errors.push(`${path}: must be a non-empty string`);
}

function stringArray(value, path, errors, { min = 0 } = {}) {
  if (!Array.isArray(value) || value.length < min || value.some((item) => !nonempty(item))) {
    errors.push(`${path}: must be an array of non-empty strings${min ? ` with at least ${min} item(s)` : ''}`);
    return false;
  }
  return true;
}

function objectArray(value, path, errors, { min = 0 } = {}) {
  if (!Array.isArray(value) || value.length < min) {
    errors.push(`${path}: must be an array with at least ${min} item(s)`);
    return false;
  }
  return true;
}

function stableId(value, path, errors) {
  if (!idPattern.test(value ?? '')) errors.push(`${path}: must be a stable uppercase ID`);
}

function uniqueIds(items, path, errors) {
  if (!Array.isArray(items)) return;
  const seen = new Set();
  for (const [index, item] of items.entries()) {
    if (!record(item) || !nonempty(item.id)) continue;
    if (seen.has(item.id)) errors.push(`${path}[${index}].id: duplicate ID ${item.id}`);
    seen.add(item.id);
  }
}

function validateProjectTarget(value, path, errors) {
  if (!exact(value, ['owner', 'number', 'projectId', 'statusFieldId', 'readyOptionId'], ['owner', 'number', 'projectId', 'statusFieldId', 'readyOptionId'], path, errors)) return;
  if (!/^[A-Za-z0-9-]+$/.test(value.owner ?? '')) errors.push(`${path}.owner: must be a GitHub owner`);
  if (!Number.isInteger(value.number) || value.number < 1) errors.push(`${path}.number: must be a positive integer`);
  for (const key of ['projectId', 'statusFieldId', 'readyOptionId']) string(value[key], `${path}.${key}`, errors);
}

function validateIssue(value, errors) {
  const fields = ['repository', 'title', 'outcome', 'problemEvidence', 'requirements', 'scope', 'technicalDirection', 'acceptanceScenarios', 'validation', 'dependencies', 'assumptions', 'references', 'projectTarget'];
  const required = fields.filter((field) => field !== 'projectTarget');
  if (!exact(value, fields, required, 'issue', errors)) return;
  if (!/^[^/\s]+\/[^/\s]+$/.test(value.repository ?? '')) errors.push('issue.repository: must be owner/name');
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
  for (const key of ['dependencies', 'assumptions', 'references']) stringArray(value[key], `issue.${key}`, errors);
  if (value.projectTarget !== undefined) validateProjectTarget(value.projectTarget, 'issue.projectTarget', errors);
}

function validatePlan(value, errors, context) {
  const fields = ['issueDigest', 'summary', 'steps', 'validation', 'risks', 'compatibility', 'rollback'];
  if (!exact(value, fields, fields, 'plan', errors)) return;
  if (!digestPattern.test(value.issueDigest ?? '')) errors.push('plan.issueDigest: invalid digest');
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
  const validations = Array.isArray(value.validation) ? value.validation : [];
  const steps = Array.isArray(value.steps) ? value.steps : [];
  const validationIds = validations.map((item) => record(item) ? item.stepId : undefined);
  if (new Set(validationIds).size !== validationIds.length) errors.push('plan.validation: stepId values must be unique');
  const stepIds = new Set(steps.map((item) => record(item) ? item.id : undefined).filter(nonempty));
  for (const [index, id] of validationIds.entries()) if (!stepIds.has(id)) errors.push(`plan.validation[${index}].stepId: references missing step ${id}`);
  for (const id of stepIds) if (!validationIds.includes(id)) errors.push(`plan.validation: missing mapping for step ${id}`);
  stringArray(value.risks, 'plan.risks', errors);
  stringArray(value.compatibility, 'plan.compatibility', errors);
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

function validateReview(value, errors) {
  const fields = ['subjectKind', 'subjectDigest', 'verdict', 'findings'];
  if (!exact(value, fields, fields, 'review', errors)) return;
  if (!['issue', 'plan', 'change', 'verification'].includes(value.subjectKind)) errors.push('review.subjectKind: invalid subject kind');
  if (!digestPattern.test(value.subjectDigest ?? '')) errors.push('review.subjectDigest: invalid digest');
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
  const findings = Array.isArray(value.findings) ? value.findings : [];
  if (value.verdict === 'PASS' && findings.length !== 0) errors.push('review.findings: PASS requires no findings');
  if (value.verdict === 'CHANGES_REQUIRED' && findings.length === 0) errors.push('review.findings: CHANGES_REQUIRED requires findings');
  if (value.verdict === 'BLOCKED' && !findings.some((finding) => record(finding) && finding.severity === 'blocker')) errors.push('review.findings: BLOCKED requires a blocker finding');
}

function validateVerification(value, errors) {
  const fields = ['subjectDigest', 'changeDigest', 'status', 'commands'];
  if (!exact(value, fields, fields, 'verification', errors)) return;
  for (const key of ['subjectDigest', 'changeDigest']) if (!digestPattern.test(value[key] ?? '')) errors.push(`verification.${key}: invalid digest`);
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
  const commands = Array.isArray(value.commands) ? value.commands : [];
  if (value.status === 'PASS' && commands.some((item) => item?.exitCode !== 0 || item?.unavailable !== undefined || item?.skipped?.length)) errors.push('verification.commands: PASS requires exit 0 and no unavailable or skipped checks');
  if (value.status === 'FAIL' && !commands.some((item) => Number.isInteger(item?.exitCode) && item.exitCode !== 0)) errors.push('verification.commands: FAIL requires nonzero command evidence');
  if (value.status === 'BLOCKED' && !commands.some((item) => nonempty(item?.unavailable) || (item?.required && item?.skipped?.length))) errors.push('verification.commands: BLOCKED requires unavailable or skipped required-check evidence');
}

export function validateContract(kind, value, context = {}) {
  const errors = [];
  context = record(context) ? context : {};
  if (kind === 'issue') validateIssue(value, errors);
  else if (kind === 'plan') validatePlan(value, errors, context);
  else if (kind === 'review') validateReview(value, errors);
  else if (kind === 'verification') validateVerification(value, errors);
  else errors.push(`unknown contract kind: ${kind}`);
  return errors;
}

export function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (!record(value)) return value;
  return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonicalize(value[key])]));
}

export function canonicalJson(value) {
  return `${JSON.stringify(canonicalize(value))}\n`;
}

export function contractDigest(kind, value, context = {}) {
  const errors = validateContract(kind, value, context);
  if (errors.length) throw new Error(`invalid ${kind} contract: ${errors.join('; ')}`);
  return `sha256:${createHash('sha256').update(canonicalJson(value)).digest('hex')}`;
}

function bullets(items) {
  return items.length ? items.map((item) => `- ${item}`).join('\n') : '- None';
}

export function renderIssue(issue) {
  const errors = validateContract('issue', issue);
  if (errors.length) throw new Error(`invalid issue contract: ${errors.join('; ')}`);
  const evidence = issue.problemEvidence.map((item) => `- ${item.source}: ${item.conclusion}`).join('\n');
  const requirements = issue.requirements.map((item) => `- **${item.id}** ${item.text}`).join('\n');
  const scenarios = issue.acceptanceScenarios.map((item) => `### ${item.id}\n\n**Given** ${item.given}\n\n**When** ${item.when}\n\n**Then**\n${bullets(item.then)}`).join('\n\n');
  const target = issue.projectTarget ? `\n\n## Project target\n\n- Owner: ${issue.projectTarget.owner}\n- Number: ${issue.projectTarget.number}\n- Project ID: ${issue.projectTarget.projectId}\n- Status field ID: ${issue.projectTarget.statusFieldId}\n- Ready option ID: ${issue.projectTarget.readyOptionId}` : '';
  return `# ${issue.title}\n\n## Outcome\n\n${issue.outcome}\n\n## Problem evidence\n\n${evidence}\n\n## Requirements\n\n${requirements}\n\n## Scope\n\n### Included\n${bullets(issue.scope.included)}\n\n### Excluded\n${bullets(issue.scope.excluded)}\n\n## Technical direction\n\n### Decisions\n${bullets(issue.technicalDirection.decisions)}\n\n### Constraints\n${bullets(issue.technicalDirection.constraints)}\n\n### Discretion\n${bullets(issue.technicalDirection.discretion)}\n\n## Acceptance scenarios\n\n${scenarios}\n\n## Validation\n\n### Focused\n${bullets(issue.validation.focused)}\n\n### Required\n${bullets(issue.validation.required)}\n\n## Dependencies\n${bullets(issue.dependencies)}\n\n## Assumptions\n${bullets(issue.assumptions)}\n\n## References\n${bullets(issue.references)}${target}\n`;
}
