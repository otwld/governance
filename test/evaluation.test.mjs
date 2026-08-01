import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

/** Workflows with behavioral fixtures that are maintained by this distribution. */
const workflows = new Set(['change-boundary', 'deliver-issue', 'dependency-upgrade', 'governance-check', 'review-change', 'review-plan', 'shape-issue', 'systematic-debugging', 'verify-change', 'workflow-state']);
/** Dispositions that a governance evaluation may require. */
const dispositions = new Set(['PASS', 'CHANGES_REQUIRED', 'BLOCKED']);

/** Prevents structural fixture drift from masquerading as meaningful configured-model evidence. */
test('behavioral evaluation cases cover critical success and refusal paths', async () => {
  /** Parsed catalog is kept in source order for deterministic human execution. */
  const cases = JSON.parse(await readFile(new URL('../eval/cases.json', import.meta.url), 'utf8'));
  assert.ok(Array.isArray(cases));
  assert.ok(cases.length >= 18);
  /** Stable IDs prevent results from drifting when case prose changes. */
  const ids = new Set();
  for (const [index, evaluation] of cases.entries()) {
    assert.deepEqual(Object.keys(evaluation).sort(), ['expected', 'forbiddenActions', 'id', 'requiredEvidence', 'scenario', 'workflow'], `case ${index}`);
    assert.match(evaluation.id, /^[A-Z][A-Z0-9-]+$/);
    assert.ok(!ids.has(evaluation.id), evaluation.id);
    ids.add(evaluation.id);
    assert.ok(workflows.has(evaluation.workflow), evaluation.workflow);
    assert.ok(dispositions.has(evaluation.expected), evaluation.expected);
    assert.ok(typeof evaluation.scenario === 'string' && evaluation.scenario.trim() !== '');
    assert.ok(Array.isArray(evaluation.requiredEvidence) && evaluation.requiredEvidence.length > 0);
    assert.ok(Array.isArray(evaluation.forbiddenActions) && evaluation.forbiddenActions.length > 0);
  }
  for (const prefix of ['CHANGE-', 'DEBUG-', 'DEPENDENCY-', 'DOC-', 'ENQUEUE-', 'ISSUE-', 'PLAN-', 'QUEUE-', 'STATE-', 'TOOL-', 'VERIFY-']) assert.ok([...ids].some((id) => id.startsWith(prefix)), prefix);
  assert.ok(cases.some((evaluation) => evaluation.expected === 'PASS'));
  assert.ok(cases.some((evaluation) => evaluation.expected === 'CHANGES_REQUIRED'));
  assert.ok(cases.some((evaluation) => evaluation.expected === 'BLOCKED'));
});
