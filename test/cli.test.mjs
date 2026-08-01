import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
const cli = new URL('../bin/governance.mjs', import.meta.url);

test('CLI help describes current deterministic commands', () => {
  const result = spawnSync(process.execPath, [cli.pathname, 'help'], { encoding: 'utf8' });
  assert.equal(result.status, 0); assert.match(result.stdout, /validate-distribution/); assert.match(result.stdout, /validate-project/); assert.match(result.stdout, /install-global/); assert.doesNotMatch(result.stdout, /skills-home/);
});

test('CLI validates this distribution and project', () => {
  for (const command of ['validate-distribution', 'validate-project']) {
    const result = spawnSync(process.execPath, [cli.pathname, command, new URL('..', import.meta.url).pathname], { encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr); assert.match(result.stdout, /Validation passed/);
  }
});

test('unknown command exits with usage error', () => {
  const result = spawnSync(process.execPath, [cli.pathname, 'unknown'], { encoding: 'utf8' });
  assert.equal(result.status, 2); assert.match(result.stderr, /Unknown command/);
});
