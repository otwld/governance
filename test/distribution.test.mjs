import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { validateDistribution } from '../lib/validation.mjs';

async function distribution(t) {
  const root = await mkdtemp(join(tmpdir(), 'governance-distribution-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  await mkdir(join(root, 'agents'), { recursive: true });
  await mkdir(join(root, 'commands'), { recursive: true });
  await mkdir(join(root, 'skills', 'review'), { recursive: true });
  await mkdir(join(root, 'templates'), { recursive: true });
  await writeFile(
    join(root, 'templates/opencode.json'),
    JSON.stringify({
      default_agent: 'worker',
      skills: { paths: ['/workspace/example-skills'] },
    }),
  );
  return root;
}

async function productionDistribution(t) {
  const root = await mkdtemp(join(tmpdir(), 'governance-production-distribution-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  await mkdir(join(root, 'agents'), { recursive: true });
  await mkdir(join(root, 'commands'), { recursive: true });
  await mkdir(join(root, 'templates'), { recursive: true });

  for (const name of ['orchestrator', 'implementer', 'reviewer', 'researcher']) {
    await writeFile(
      join(root, 'agents', `${name}.md`),
      `---\ndescription: ${name} agent\nmode: ${name === 'orchestrator' ? 'primary' : 'subagent'}\npermission:\n  "*": deny\n---\n`,
    );
  }
  for (const name of ['orchestrate', 'orchestrate-loop', 'setup-project', 'review']) {
    await writeFile(
      join(root, 'commands', `${name}.md`),
      `---\ndescription: ${name} command\nagent: ${name === 'review' ? 'reviewer' : 'orchestrator'}\n---\n`,
    );
  }
  for (const name of [
    'dependency-upgrade',
    'nx-impact-analysis',
    'setup-node-project',
    'verify-change',
  ]) {
    await mkdir(join(root, 'skills', name), { recursive: true });
    await writeFile(
      join(root, 'skills', name, 'SKILL.md'),
      `---\nname: ${name}\ndescription: ${name} skill\n---\n`,
    );
  }
  await writeFile(
    join(root, 'templates/opencode.json'),
    JSON.stringify({
      default_agent: 'orchestrator',
      skills: { paths: ['/workspace/example-skills'] },
    }),
  );
  return root;
}

test('accepts valid distribution frontmatter', async (t) => {
  const root = await distribution(t);
  await writeFile(
    join(root, 'agents/worker.md'),
    '---\ndescription: Reviews focused changes\nmode: primary\npermission:\n  "*": deny\n---\n# Worker\n',
  );
  await writeFile(
    join(root, 'commands/review.md'),
    '---\ndescription: Run a focused review\nagent: worker\n---\nReview the change.\n',
  );
  await writeFile(
    join(root, 'skills/review/SKILL.md'),
    '---\nname: review\ndescription: Review a code change\n---\n# Review\n',
  );

  assert.deepEqual(await validateDistribution(root, { requireProductionAssets: false }), []);
});

test('reports missing frontmatter fields and a mismatched skill folder', async (t) => {
  const root = await distribution(t);
  await writeFile(join(root, 'agents/worker.md'), 'No frontmatter\n');
  await writeFile(
    join(root, 'commands/review.md'),
    '---\ndescription: Review a change\n---\n',
  );
  await writeFile(
    join(root, 'skills/review/SKILL.md'),
    '---\nname: Other Skill\ndescription: Review a change\n---\n',
  );

  const diagnostics = await validateDistribution(root, { requireProductionAssets: false });
  const output = diagnostics.map(({ path, message }) => `${path}: ${message}`).join('\n');
  assert.match(output, /agents\/worker\.md: missing opening frontmatter delimiter/);
  assert.match(output, /agents\/worker\.md: frontmatter field "description"/);
  assert.match(output, /commands\/review\.md: frontmatter field "agent"/);
  assert.match(output, /skill name "Other Skill" must match \/\^\[a-z0-9\]/);
  assert.match(output, /skill name "Other Skill" must match folder "review"/);
});

test('reports a skill folder without SKILL.md', async (t) => {
  const root = await distribution(t);
  await writeFile(
    join(root, 'agents/worker.md'),
    '---\ndescription: Reviews changes\nmode: primary\npermission:\n  "*": deny\n---\n',
  );
  await writeFile(
    join(root, 'commands/review.md'),
    '---\ndescription: Review a change\nagent: worker\n---\n',
  );
  await rm(join(root, 'skills/review'), { recursive: true });
  await mkdir(join(root, 'skills/empty'));

  assert.deepEqual(await validateDistribution(root, { requireProductionAssets: false }), [
    { path: 'skills/empty', message: 'missing SKILL.md' },
  ]);
});

test('reports missing distribution content', async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'governance-distribution-empty-'));
  t.after(() => rm(root, { recursive: true, force: true }));

  assert.deepEqual(await validateDistribution(root, { requireProductionAssets: false }), [
    { path: 'agents', message: 'no Markdown files found' },
    { path: 'commands', message: 'no Markdown files found' },
    { path: 'skills', message: 'directory does not exist' },
    { path: 'templates/opencode.json', message: 'file does not exist' },
  ]);
});

test('rejects an invalid agent mode and missing default deny', async (t) => {
  const root = await distribution(t);
  await writeFile(
    join(root, 'agents/worker.md'),
    '---\ndescription: Performs work\nmode: background\npermission:\n  read:\n    "*": deny\n---\n',
  );
  await writeFile(
    join(root, 'commands/review.md'),
    '---\ndescription: Review a change\nagent: worker\n---\n',
  );
  await writeFile(
    join(root, 'skills/review/SKILL.md'),
    '---\nname: review\ndescription: Review a change\n---\n',
  );

  const output = (await validateDistribution(root, { requireProductionAssets: false }))
    .map(({ path, message }) => `${path}: ${message}`)
    .join('\n');
  assert.match(output, /field "mode" must be primary, subagent, or all/);
  assert.match(output, /permission must be a block with explicit top-level "\*" set to deny/);
});

test('rejects commands that reference a missing agent file', async (t) => {
  const root = await distribution(t);
  await writeFile(
    join(root, 'agents/worker.md'),
    '---\ndescription: Performs work\nmode: primary\npermission:\n  "*": deny\n---\n',
  );
  await writeFile(
    join(root, 'commands/review.md'),
    '---\ndescription: Review a change\nagent: absent\n---\n',
  );
  await writeFile(
    join(root, 'skills/review/SKILL.md'),
    '---\nname: review\ndescription: Review a change\n---\n',
  );

  const output = (await validateDistribution(root, { requireProductionAssets: false }))
    .map(({ path, message }) => `${path}: ${message}`)
    .join('\n');
  assert.match(output, /field "agent" references missing agent "absent"/);
});

test('rejects invalid template composition and malformed template JSON', async (t) => {
  const root = await distribution(t);
  await writeFile(
    join(root, 'agents/worker.md'),
    '---\ndescription: Performs work\nmode: subagent\npermission:\n  "*": deny\n---\n',
  );
  await writeFile(
    join(root, 'commands/review.md'),
    '---\ndescription: Review a change\nagent: worker\n---\n',
  );
  await writeFile(
    join(root, 'skills/review/SKILL.md'),
    '---\nname: review\ndescription: Review a change\n---\n',
  );
  await writeFile(
    join(root, 'templates/opencode.json'),
    JSON.stringify({ default_agent: 'worker', skills: { paths: [' '] } }),
  );

  let output = (await validateDistribution(root, { requireProductionAssets: false }))
    .map(({ path, message }) => `${path}: ${message}`)
    .join('\n');
  assert.match(output, /default_agent: must reference an existing primary agent/);
  assert.match(output, /skills\.paths: must be a non-empty array of non-empty strings/);

  await writeFile(join(root, 'templates/opencode.json'), '{');
  output = (await validateDistribution(root, { requireProductionAssets: false }))
    .map(({ path, message }) => `${path}: ${message}`)
    .join('\n');
  assert.match(output, /templates\/opencode\.json: cannot parse JSON/);
});

test('requires the exact production asset composition by default', async (t) => {
  const root = await productionDistribution(t);
  assert.deepEqual(await validateDistribution(root), []);

  await rm(join(root, 'agents/reviewer.md'));
  await rm(join(root, 'commands/review.md'));
  await rm(join(root, 'skills/verify-change'), { recursive: true });

  assert.deepEqual(await validateDistribution(root), [
    { path: 'agents', message: 'missing required production agent "reviewer"' },
    { path: 'commands', message: 'missing required production command "review"' },
    { path: 'skills', message: 'missing required production skill "verify-change"' },
  ]);

  await writeFile(
    join(root, 'agents/worker.md'),
    '---\ndescription: extra agent\nmode: subagent\npermission:\n  "*": deny\n---\n',
  );
  const output = (await validateDistribution(root))
    .map(({ path, message }) => `${path}: ${message}`)
    .join('\n');
  assert.match(output, /agents\/worker: unexpected production agent name "worker"/);
});

test('requires exact production agent modes and command mappings', async (t) => {
  const root = await productionDistribution(t);
  const agentModes = new Map([
    ['orchestrator', 'primary'],
    ['implementer', 'subagent'],
    ['reviewer', 'subagent'],
    ['researcher', 'subagent'],
  ]);
  for (const [name, expectedMode] of agentModes) {
    const wrongMode = expectedMode === 'primary' ? 'subagent' : 'primary';
    const file = join(root, 'agents', `${name}.md`);
    await writeFile(
      file,
      `---\ndescription: ${name} agent\nmode: ${wrongMode}\npermission:\n  "*": deny\n---\n`,
    );
    const output = (await validateDistribution(root))
      .map(({ path, message }) => `${path}: ${message}`)
      .join('\n');
    assert.match(
      output,
      new RegExp(`agents/${name}\\.md: production agent "${name}" must use mode "${expectedMode}"`),
      name,
    );
    await writeFile(
      file,
      `---\ndescription: ${name} agent\nmode: ${expectedMode}\npermission:\n  "*": deny\n---\n`,
    );
  }

  const commandAgents = new Map([
    ['orchestrate', 'orchestrator'],
    ['orchestrate-loop', 'orchestrator'],
    ['setup-project', 'orchestrator'],
    ['review', 'reviewer'],
  ]);
  for (const [name, expectedAgent] of commandAgents) {
    const wrongAgent = expectedAgent === 'orchestrator' ? 'reviewer' : 'orchestrator';
    const file = join(root, 'commands', `${name}.md`);
    await writeFile(
      file,
      `---\ndescription: ${name} command\nagent: ${wrongAgent}\n---\n`,
    );
    const output = (await validateDistribution(root))
      .map(({ path, message }) => `${path}: ${message}`)
      .join('\n');
    assert.match(
      output,
      new RegExp(`commands/${name}\\.md: production command "${name}" must use agent "${expectedAgent}"`),
      name,
    );
    await writeFile(
      file,
      `---\ndescription: ${name} command\nagent: ${expectedAgent}\n---\n`,
    );
  }
  assert.deepEqual(await validateDistribution(root), []);
});

function bashPermissionRules(content) {
  const bash = content.slice(content.indexOf('  bash:\n'), content.indexOf('  external_directory:\n'));
  return [...bash.matchAll(/^    "(.*)": (allow|deny)$/gm)].map(([, pattern, action]) => ({
    pattern,
    action,
  }));
}

function effectiveBashPermission(rules, command) {
  let result = 'deny';
  for (const { pattern, action } of rules) {
    const expression = pattern
      .replace(/[.+?^${}()|[\]\\]/g, '\\$&')
      .replaceAll('*', '.*');
    if (new RegExp(`^${expression}$`).test(command)) result = action;
  }
  return result;
}

test('production verification permissions allow only safe ordered command families', async () => {
  const agents = new URL('../agents/', import.meta.url);
  const implementer = await readFile(new URL('implementer.md', agents), 'utf8');
  const reviewer = await readFile(new URL('reviewer.md', agents), 'utf8');
  const implementerRules = bashPermissionRules(implementer);
  const reviewerRules = bashPermissionRules(reviewer);

  for (const broadAllow of ['npm run *', 'pnpm run *', 'yarn *', 'bun run *']) {
    assert.equal(
      implementerRules.some(({ pattern, action }) => pattern === broadAllow && action === 'allow'),
      false,
      broadAllow,
    );
    assert.equal(
      reviewerRules.some(({ pattern, action }) => pattern === broadAllow && action === 'allow'),
      false,
      broadAllow,
    );
  }

  const deniedCommands = ['npm run format'];
  for (const manager of ['npm', 'pnpm', 'yarn', 'bun']) {
    for (const operation of ['publish', 'deploy', 'release']) {
      deniedCommands.push(`${manager} ${operation}`, `${manager} run ${operation}`);
    }
  }
  deniedCommands.push(
    'npm exec jest',
    'npx jest',
    'pnpm exec jest',
    'pnpm dlx jest',
    'yarn exec git push',
    'yarn dlx jest',
    'bunx jest',
  );
  for (const command of deniedCommands) {
    assert.equal(effectiveBashPermission(implementerRules, command), 'deny', command);
    assert.equal(effectiveBashPermission(reviewerRules, command), 'deny', command);
  }
  assert.equal(effectiveBashPermission(reviewerRules, 'yarn lint --fix'), 'deny');

  for (const script of ['test', 'lint', 'typecheck', 'check', 'validate', 'build', 'ci', 'verify']) {
    for (const prefix of ['npm run', 'pnpm run', 'yarn', 'yarn run', 'bun run']) {
      const command = `${prefix} ${script}:ci -- --coverage`;
      assert.equal(effectiveBashPermission(implementerRules, command), 'allow', command);
      assert.equal(effectiveBashPermission(reviewerRules, command), 'allow', command);
    }
  }

  const nxRunners = ['nx', 'npx nx', 'pnpm nx', 'pnpm exec nx', 'yarn nx', 'bunx nx'];
  for (const runner of nxRunners) {
    for (const command of ['affected', 'run-many', 'test', 'lint', 'build']) {
      const invocation = `${runner} ${command} --configuration=ci`;
      assert.equal(effectiveBashPermission(implementerRules, invocation), 'allow', invocation);
    }
    for (const command of ['show projects --affected', 'show project api --json', '--version', '--help']) {
      const invocation = `${runner} ${command}`;
      assert.equal(effectiveBashPermission(implementerRules, invocation), 'allow', invocation);
    }
    assert.equal(effectiveBashPermission(implementerRules, `${runner} deploy app`), 'deny', runner);
  }
});

test('production non-editing agents retain exact pushes and shell write protections', async () => {
  const agents = new URL('../agents/', import.meta.url);
  const orchestrator = await readFile(new URL('orchestrator.md', agents), 'utf8');
  const pushAllows = orchestrator
    .split('\n')
    .filter((line) => line.includes('"git push') && line.endsWith(': allow'));

  assert.deepEqual(pushAllows, [
    '    "git push origin HEAD": allow',
    '    "git push -u origin HEAD": allow',
  ]);
  assert.match(orchestrator, /^    "git push\*": deny$/m);
  for (const pattern of [
    'git push * -f*',
    'git switch -C *',
    'git rebase * -i*',
  ]) {
    assert.match(
      orchestrator,
      new RegExp(`^    "${pattern.replaceAll('*', '\\*')}": deny$`, 'm'),
    );
  }

  for (const name of ['orchestrator', 'reviewer', 'researcher']) {
    const content = await readFile(new URL(`${name}.md`, agents), 'utf8');
    for (const command of ['git diff', 'git show', 'git log']) {
      assert.match(content, new RegExp(`^    "${command}\\*--output\\*": deny$`, 'm'));
      assert.match(content, new RegExp(`^    "${command}\\*>\\*": deny$`, 'm'));
    }
  }
});
