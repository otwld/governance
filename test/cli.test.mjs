import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
/** CLI invocations resolve the checked-in entry point rather than a PATH-installed binary. */
const cli = new URL('../bin/governance.mjs', import.meta.url);

/** Confirms the public CLI exposes only the supported deterministic command roster. */
function verifyHelpRoster() {
  const result = spawnSync(process.execPath, [cli.pathname, 'help'], { encoding: 'utf8' });
  assert.equal(result.status, 0);
  const commands = [...result.stdout.matchAll(/^  ([a-z][a-z-]+)(?: |$)/gm)].map((match) => match[1]);
  assert.deepEqual(commands, ['validate-distribution', 'validate-project', 'install-global', 'help']);
  assert.doesNotMatch(result.stdout, /skills-home/);
}

test('CLI help describes current deterministic commands', verifyHelpRoster);

/** Guards both validator entry points against packaging or project-context regressions. */
test('CLI validates this distribution and project', () => {
  for (const command of ['validate-distribution', 'validate-project']) {
    const result = spawnSync(process.execPath, [cli.pathname, command, new URL('..', import.meta.url).pathname], { encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr); assert.match(result.stdout, /Validation passed/);
  }
});

/** Prevents unsupported CLI input from being mistaken for a successful no-op. */
test('unknown command exits with usage error', () => {
  const result = spawnSync(process.execPath, [cli.pathname, 'unknown'], { encoding: 'utf8' });
  assert.equal(result.status, 2); assert.match(result.stderr, /Unknown command/);
});
