import assert from 'node:assert/strict';
import test from 'node:test';
import { fetchProjectItems, projectSingleSelect } from '../lib/project-items.mjs';

/** Prevents truncated pages or duplicate cross-page IDs from becoming authoritative queue input. */
test('Project GraphQL pagination requires pageInfo and unique item IDs', async () => {
  /** Captured argv and the two-page response fixture jointly prove cursor omission then continuation. */
  const calls = [];
  /** The spawn double emits one unique item per page while preserving GraphQL pageInfo semantics. */
  const result = await fetchProjectItems({ id: 'PVT' }, async (argv) => {
    calls.push(argv);
    /** Page position selects both the next item identity and terminal continuation evidence. */
    const second = calls.length === 2;
    /** Node shape includes every field consumed later by queue normalization. */
    const nodes = [{ id: second ? 'I2' : 'I1', isArchived: false, type: 'ISSUE', content: { __typename: 'Issue', url: 'https://github.com/o/r/issues/1', repository: { nameWithOwner: 'o/r' } }, fieldValues: { nodes: [] } }];
    return { argv, exitCode: 0, stdout: JSON.stringify({ data: { node: { items: { nodes, pageInfo: { hasNextPage: !second, endCursor: second ? null : 'CURSOR' } } } } }), stderr: '' };
  });
  assert.equal(result.status, 'succeeded');
  assert.deepEqual(result.items.map((item) => item.id), ['I1', 'I2']);
  assert.doesNotMatch(calls[0].join(' '), /cursor=/);
  assert.match(calls[1].at(-1), /CURSOR/);
  /** The duplicate-ID adapter isolates the cross-page identity gate from pagination success. */
  const duplicate = await fetchProjectItems({ id: 'PVT' }, async (argv) => ({ argv, exitCode: 0, stdout: JSON.stringify({ data: { node: { items: { nodes: [{ id: 'I' }, { id: 'I' }], pageInfo: { hasNextPage: false, endCursor: null } } } } }), stderr: '' }));
  assert.equal(duplicate.status, 'invalid');
});

/** Guards status and priority lookup against mutable display names and absent field identities. */
test('single-select extraction binds immutable field IDs rather than display keys', () => {
  /** Two same-shaped field values prove selection is keyed by immutable field ID. */
  const item = { fieldValues: { nodes: [{ optionId: 'READY', name: 'Ready', field: { id: 'STATUS', name: 'Status' } }, { optionId: 'HIGH', name: 'High', field: { id: 'PRIORITY', name: 'Priority' } }] } };
  assert.deepEqual(projectSingleSelect(item, 'STATUS'), { optionId: 'READY', name: 'Ready', fieldName: 'Status' });
  assert.equal(projectSingleSelect(item, 'OTHER'), undefined);
});
