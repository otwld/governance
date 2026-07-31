import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { validateDistribution } from '../lib/validation.mjs';

const productionIssueFields = [
  ['outcome', true],
  ['problem-evidence', true],
  ['requirements', true],
  ['included-scope', true],
  ['out-of-scope', false],
  ['technical-direction', true],
  ['repository-context', true],
  ['acceptance-scenarios', true],
  ['validation', true],
  ['dependencies-readiness', true],
  ['assumptions', false],
  ['references', false],
];

function productionIssueForm() {
  return [
    'name: Agent implementation task',
    'description: Define one implementation-ready outcome',
    'labels: []',
    'body:',
    ...productionIssueFields.flatMap(([id, required]) => [
      '  - type: textarea',
      `    id: ${id}`,
      '    attributes:',
      `      label: ${id}`,
      ...(required ? ['    validations:', '      required: true'] : []),
    ]),
    '',
  ].join('\n');
}

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
  await mkdir(join(root, 'tools'), { recursive: true });
  await mkdir(join(root, 'templates'), { recursive: true });
  await mkdir(join(root, 'templates', '.github', 'ISSUE_TEMPLATE'), { recursive: true });

  for (const name of ['brainstormer', 'orchestrator', 'implementer', 'reviewer', 'researcher', 'task-shaper']) {
    const defaultPermission = ['brainstormer', 'researcher', 'task-shaper'].includes(name) ? 'deny' : 'allow';
    const createIssuePermission = name === 'task-shaper' ? 'allow' : 'deny';
    await writeFile(
      join(root, 'agents', `${name}.md`),
      `---\ndescription: ${name} agent\nmode: ${['brainstormer', 'orchestrator', 'task-shaper'].includes(name) ? 'primary' : 'subagent'}\npermission:\n  "*": ${defaultPermission}\n  create_issue: ${createIssuePermission}\n---\n`,
    );
  }
  for (const name of ['brainstorm', 'orchestrate', 'orchestrate-loop', 'setup-project', 'review', 'shape-task']) {
    await writeFile(
      join(root, 'commands', `${name}.md`),
      `---\ndescription: ${name} command\nagent: ${name === 'brainstorm' ? 'brainstormer' : name === 'review' ? 'reviewer' : name === 'shape-task' ? 'task-shaper' : 'orchestrator'}\n---\n`,
    );
  }
  await writeFile(join(root, 'tools', 'create_issue.js'), 'export default {};\n');
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
      permission: { create_issue: 'deny' },
      skills: { paths: ['/workspace/example-skills'] },
    }),
  );
  await writeFile(
    join(root, 'templates', '.github', 'ISSUE_TEMPLATE', 'agent-task.yml'),
    productionIssueForm(),
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

  const agentFile = join(root, 'agents/worker.md');
  const agent = await readFile(agentFile, 'utf8');
  await writeFile(agentFile, agent.replace('"*": deny', '"*": allow'));
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

test('rejects an invalid agent mode and missing default permission action', async (t) => {
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
  assert.match(output, /permission must be a block with an explicit top-level "\*" action/);
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
  await rm(join(root, 'tools/create_issue.js'));
  await rm(join(root, 'skills/verify-change'), { recursive: true });

  assert.deepEqual(await validateDistribution(root), [
    { path: 'agents', message: 'missing required production agent "reviewer"' },
    { path: 'commands', message: 'missing required production command "review"' },
    { path: 'tools', message: 'missing required production tool "create_issue"' },
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

test('rejects missing or renamed brainstorm production assets', async (t) => {
  const root = await productionDistribution(t);
  await rm(join(root, 'agents/brainstormer.md'));
  await writeFile(
    join(root, 'agents/idea-explorer.md'),
    '---\ndescription: renamed brainstormer\nmode: primary\npermission:\n  "*": deny\n  create_issue: deny\n---\n',
  );
  await rm(join(root, 'commands/brainstorm.md'));
  await writeFile(
    join(root, 'commands/idea-session.md'),
    '---\ndescription: renamed brainstorm command\nagent: idea-explorer\n---\n',
  );

  const output = (await validateDistribution(root))
    .map(({ path, message }) => `${path}: ${message}`)
    .join('\n');
  assert.match(output, /missing required production agent "brainstormer"/);
  assert.match(output, /agents\/idea-explorer: unexpected production agent name "idea-explorer"/);
  assert.match(output, /missing required production command "brainstorm"/);
  assert.match(output, /commands\/idea-session: unexpected production command name "idea-session"/);
});

test('requires the exact non-empty production custom tool source', async (t) => {
  const root = await productionDistribution(t);
  const toolFile = join(root, 'tools', 'create_issue.js');
  await writeFile(toolFile, ' \n');

  assert.deepEqual(await validateDistribution(root), [
    { path: 'tools/create_issue.js', message: 'production tool source must not be empty' },
  ]);

  await writeFile(toolFile, 'export default {};\n');
  await writeFile(join(root, 'tools', 'other.js'), 'export default {};\n');
  assert.deepEqual(await validateDistribution(root), [
    { path: 'tools/other', message: 'unexpected production tool name "other"' },
  ]);
});

test('requires exact production agent modes and command mappings', async (t) => {
  const root = await productionDistribution(t);
  const agentModes = new Map([
    ['brainstormer', 'primary'],
    ['orchestrator', 'primary'],
    ['implementer', 'subagent'],
    ['reviewer', 'subagent'],
    ['researcher', 'subagent'],
    ['task-shaper', 'primary'],
  ]);
  for (const [name, expectedMode] of agentModes) {
    const wrongMode = expectedMode === 'primary' ? 'subagent' : 'primary';
    const defaultPermission = ['brainstormer', 'researcher', 'task-shaper'].includes(name) ? 'deny' : 'allow';
    const createIssuePermission = name === 'task-shaper' ? 'allow' : 'deny';
    const file = join(root, 'agents', `${name}.md`);
    await writeFile(
      file,
      `---\ndescription: ${name} agent\nmode: ${wrongMode}\npermission:\n  "*": ${defaultPermission}\n  create_issue: ${createIssuePermission}\n---\n`,
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
      `---\ndescription: ${name} agent\nmode: ${expectedMode}\npermission:\n  "*": ${defaultPermission}\n  create_issue: ${createIssuePermission}\n---\n`,
    );
  }

  const commandAgents = new Map([
    ['brainstorm', 'brainstormer'],
    ['orchestrate', 'orchestrator'],
    ['orchestrate-loop', 'orchestrator'],
    ['setup-project', 'orchestrator'],
    ['review', 'reviewer'],
    ['shape-task', 'task-shaper'],
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

  await writeFile(
    join(root, 'templates/opencode.json'),
    JSON.stringify({
      default_agent: 'task-shaper',
      permission: { create_issue: 'deny' },
      skills: { paths: ['/workspace/example-skills'] },
    }),
  );
  assert.deepEqual(await validateDistribution(root), [
    {
      path: 'templates/opencode.json.default_agent',
      message: 'production default agent must be "orchestrator"',
    },
  ]);
  await writeFile(
    join(root, 'templates/opencode.json'),
    JSON.stringify({
      default_agent: 'orchestrator',
      permission: { create_issue: 'deny' },
      skills: { paths: ['/workspace/example-skills'] },
    }),
  );
  assert.deepEqual(await validateDistribution(root), []);
});

test('requires no-prompt permission actions for every production agent', async (t) => {
  const root = await productionDistribution(t);
  for (const name of ['brainstormer', 'orchestrator', 'implementer', 'reviewer', 'researcher', 'task-shaper']) {
    const mode = ['brainstormer', 'orchestrator', 'task-shaper'].includes(name) ? 'primary' : 'subagent';
    const expectedDefault = ['brainstormer', 'researcher', 'task-shaper'].includes(name) ? 'deny' : 'allow';
    const wrongDefault = expectedDefault === 'allow' ? 'deny' : 'allow';
    const createIssuePermission = name === 'task-shaper' ? 'allow' : 'deny';
    const file = join(root, 'agents', `${name}.md`);

    await writeFile(
      file,
      `---\ndescription: ${name} agent\nmode: ${mode}\npermission:\n  "*": ${wrongDefault}\n  create_issue: ${createIssuePermission}\n---\n`,
    );
    assert.deepEqual(await validateDistribution(root), [
      {
        path: `agents/${name}.md`,
        message: `production agent "${name}" must set top-level "*" permission to ${expectedDefault}`,
      },
    ], name);

    await writeFile(
      file,
      `---\ndescription: ${name} agent\nmode: ${mode}\npermission:\n  "*": ${expectedDefault}\n  create_issue: ${createIssuePermission}\n  bash:\n    "*": allow\n    "dangerous *": "ask"\n---\n`,
    );
    assert.deepEqual(await validateDistribution(root), [
      {
        path: `agents/${name}.md`,
        message: `production agent "${name}" permission must not contain ask actions`,
      },
    ], `${name} quoted ask`);

    await writeFile(
      file,
      `---\ndescription: ${name} agent\nmode: ${mode}\npermission:\n  "*": ${expectedDefault}\n  create_issue: ${createIssuePermission}\n  bash:\n    "*": allow\n    "dangerous *": ask\n---\n`,
    );
    assert.deepEqual(await validateDistribution(root), [
      {
        path: `agents/${name}.md`,
        message: `production agent "${name}" permission must not contain ask actions`,
      },
    ], name);

    await writeFile(
      file,
      `---\ndescription: ${name} agent\nmode: ${mode}\npermission:\n  "*": ${expectedDefault}\n  create_issue: ${createIssuePermission}\n---\n`,
    );
  }
  assert.deepEqual(await validateDistribution(root), []);
});

test('enforces the global deny and sole task-shaper create_issue override', async (t) => {
  const root = await productionDistribution(t);
  const templateFile = join(root, 'templates/opencode.json');
  const template = JSON.parse(await readFile(templateFile, 'utf8'));

  for (const permission of [undefined, { create_issue: 'allow' }]) {
    const changed = { ...template };
    if (permission === undefined) delete changed.permission;
    else changed.permission = permission;
    await writeFile(templateFile, JSON.stringify(changed));
    assert.deepEqual(await validateDistribution(root), [
      {
        path: 'templates/opencode.json.permission.create_issue',
        message: 'production template must set global create_issue permission to deny',
      },
    ]);
  }
  await writeFile(templateFile, JSON.stringify(template));

  for (const name of ['brainstormer', 'orchestrator', 'implementer', 'reviewer', 'researcher']) {
    const file = join(root, 'agents', `${name}.md`);
    const content = await readFile(file, 'utf8');
    await writeFile(file, content.replace('  create_issue: deny', '  create_issue: allow'));
    assert.deepEqual(await validateDistribution(root), [
      {
        path: `agents/${name}.md`,
        message: `production agent "${name}" must explicitly set create_issue permission to deny and resolve it to deny`,
      },
    ], name);
    await writeFile(file, content);
  }

  const orchestratorFile = join(root, 'agents/orchestrator.md');
  const orchestrator = await readFile(orchestratorFile, 'utf8');
  await writeFile(orchestratorFile, orchestrator.replace('  create_issue: deny\n', ''));
  assert.deepEqual(await validateDistribution(root), [
    {
      path: 'agents/orchestrator.md',
      message: 'production agent "orchestrator" must explicitly set create_issue permission to deny and resolve it to deny',
    },
  ]);
  await writeFile(orchestratorFile, orchestrator);

  const taskShaperFile = join(root, 'agents/task-shaper.md');
  const taskShaper = await readFile(taskShaperFile, 'utf8');
  await writeFile(taskShaperFile, taskShaper.replace('  create_issue: allow', '  create_issue: deny'));
  assert.deepEqual(await validateDistribution(root), [
    {
      path: 'agents/task-shaper.md',
      message: 'production agent "task-shaper" must explicitly set create_issue permission to allow and resolve it to allow',
    },
  ]);
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

function effectiveToolPermission(globalPermission, content, tool) {
  let action = globalPermission?.['*'];
  action = globalPermission?.[tool] ?? action;
  const defaultAction = /^permission:\n  "\*": (allow|deny)$/m.exec(content)?.[1];
  assert.ok(defaultAction, 'agent must define a top-level permission default');
  action = defaultAction;
  const escapedTool = tool.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`^  ${escapedTool}: (allow|deny)$`, 'm').exec(content)?.[1] ?? action;
}

test('production verification permissions allow only safe ordered command families', async () => {
  const agents = new URL('../agents/', import.meta.url);
  const implementer = await readFile(new URL('implementer.md', agents), 'utf8');
  const reviewer = await readFile(new URL('reviewer.md', agents), 'utf8');
  const implementerRules = bashPermissionRules(implementer);
  const reviewerRules = bashPermissionRules(reviewer);

  assert.equal(effectiveBashPermission(implementerRules, 'node custom-check.mjs'), 'allow');
  assert.equal(effectiveBashPermission(reviewerRules, 'node custom-check.mjs'), 'deny');

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

  assert.equal(effectiveBashPermission(implementerRules, 'npm run format'), 'allow');
  assert.equal(effectiveBashPermission(reviewerRules, 'npm run format'), 'deny');
  const deniedCommands = [];
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

test('production agents use no-prompt defaults while preserving read-only shell boundaries', async () => {
  const agents = new URL('../agents/', import.meta.url);
  const config = JSON.parse(
    await readFile(new URL('../templates/opencode.json', import.meta.url), 'utf8'),
  );
  for (const name of ['orchestrator', 'implementer', 'reviewer']) {
    const content = await readFile(new URL(`${name}.md`, agents), 'utf8');
    assert.match(content, /^permission:\n  "\*": allow$/m, name);
    assert.doesNotMatch(content, /:\s*(?:ask|"ask"|'ask')\s*$/m, name);
    assert.equal(effectiveToolPermission(config.permission, content, 'create_issue'), 'deny', name);
  }
  const taskShaper = await readFile(new URL('task-shaper.md', agents), 'utf8');
  const researcher = await readFile(new URL('researcher.md', agents), 'utf8');
  assert.match(researcher, /^permission:\n  "\*": deny$/m);
  assert.doesNotMatch(researcher, /:\s*(?:ask|"ask"|'ask')\s*$/m);
  assert.equal(effectiveToolPermission(config.permission, researcher, 'create_issue'), 'deny');
  assert.match(taskShaper, /^permission:\n  "\*": deny$/m);
  assert.doesNotMatch(taskShaper, /:\s*(?:ask|"ask"|'ask')\s*$/m);
  assert.equal(effectiveToolPermission(config.permission, taskShaper, 'custom_plugin_mutate'), 'deny');
  assert.equal(effectiveToolPermission(config.permission, taskShaper, 'mcp_github_create_issue'), 'deny');

  const orchestratorRules = bashPermissionRules(
    await readFile(new URL('orchestrator.md', agents), 'utf8'),
  );
  const implementerRules = bashPermissionRules(
    await readFile(new URL('implementer.md', agents), 'utf8'),
  );
  const reviewerRules = bashPermissionRules(
    await readFile(new URL('reviewer.md', agents), 'utf8'),
  );
  const researcherRules = bashPermissionRules(
    await readFile(new URL('researcher.md', agents), 'utf8'),
  );
  const taskShaperRules = bashPermissionRules(
    taskShaper,
  );

  assert.equal(effectiveBashPermission(orchestratorRules, 'node custom-tool.mjs'), 'allow');
  assert.equal(effectiveBashPermission(implementerRules, 'node custom-tool.mjs'), 'allow');
  assert.equal(effectiveBashPermission(reviewerRules, 'node custom-tool.mjs'), 'deny');
  assert.deepEqual(researcherRules, [{ pattern: '*', action: 'deny' }]);
  assert.equal(effectiveBashPermission(researcherRules, 'node custom-tool.mjs'), 'deny');
  assert.equal(effectiveBashPermission(taskShaperRules, 'node custom-tool.mjs'), 'deny');
  assert.equal(effectiveBashPermission(orchestratorRules, 'git reset --hard'), 'deny');
  assert.equal(effectiveBashPermission(implementerRules, 'git push origin HEAD'), 'deny');
});

test('task-shaper is primary but non-default and permits only structured issue creation', async () => {
  const taskShaper = await readFile(new URL('../agents/task-shaper.md', import.meta.url), 'utf8');
  const command = await readFile(new URL('../commands/shape-task.md', import.meta.url), 'utf8');
  const config = JSON.parse(
    await readFile(new URL('../templates/opencode.json', import.meta.url), 'utf8'),
  );
  const rules = bashPermissionRules(taskShaper);

  assert.match(taskShaper, /^mode: primary$/m);
  assert.equal(config.default_agent, 'orchestrator');
  assert.deepEqual(config.permission, { create_issue: 'deny' });
  assert.match(command, /^agent: task-shaper$/m);
  assert.match(taskShaper, /^  edit: deny$/m);
  assert.match(taskShaper, /^  question: allow$/m);
  assert.match(taskShaper, /^  webfetch: deny$/m);
  assert.match(taskShaper, /^  websearch: deny$/m);
  assert.match(taskShaper, /^  skill: deny$/m);
  assert.match(taskShaper, /^  lsp: deny$/m);
  assert.match(taskShaper, /^    researcher: allow$/m);
  assert.doesNotMatch(taskShaper, /^    (?:implementer|reviewer): allow$/m);
  assert.equal(effectiveToolPermission(config.permission, taskShaper, 'create_issue'), 'allow');
  assert.equal(effectiveToolPermission(config.permission, taskShaper, 'custom_plugin_mutate'), 'deny');

  assert.equal(effectiveBashPermission(rules, 'git status --short'), 'allow');
  assert.equal(effectiveBashPermission(rules, 'gh issue list --state all'), 'allow');
  for (const invocation of [
    'git add README.md',
    'git commit -m change',
    'git push origin HEAD',
    "gh issue create --repo 'OTWLD/governance' --title 'One' --body 'Body'",
    'gh issue create --repo OTWLD/governance --title unquoted --body unquoted',
    'gh issue edit 1 --title changed',
    'gh issue comment 1 --body note',
    'gh issue close 1',
    'gh pr create --title change',
    'gh project item-edit --id item',
    'gh repo edit --enable-issues=false',
    'node custom-tool.mjs',
  ]) {
    assert.equal(effectiveBashPermission(rules, invocation), 'deny', invocation);
  }
});

test('brainstormer is a non-default read-only primary with bounded research delegation', async () => {
  const brainstormer = await readFile(new URL('../agents/brainstormer.md', import.meta.url), 'utf8');
  const command = await readFile(new URL('../commands/brainstorm.md', import.meta.url), 'utf8');
  const config = JSON.parse(
    await readFile(new URL('../templates/opencode.json', import.meta.url), 'utf8'),
  );
  const rules = bashPermissionRules(brainstormer);

  assert.match(brainstormer, /^mode: primary$/m);
  assert.equal(config.default_agent, 'orchestrator');
  assert.match(command, /^agent: brainstormer$/m);
  assert.match(brainstormer, /^permission:\n  "\*": deny$/m);
  assert.doesNotMatch(brainstormer, /:\s*(?:ask|"ask"|'ask')\s*$/m);
  assert.match(brainstormer, /^  edit: deny$/m);
  assert.match(brainstormer, /^  todowrite: deny$/m);
  assert.match(brainstormer, /^  question: allow$/m);
  assert.match(brainstormer, /^  webfetch: deny$/m);
  assert.match(brainstormer, /^  websearch: deny$/m);
  assert.match(brainstormer, /^  skill: deny$/m);
  assert.match(brainstormer, /^  lsp: deny$/m);
  assert.match(brainstormer, /^  task:\n    "\*": deny\n    researcher: allow$/m);
  assert.doesNotMatch(brainstormer, /^    (?:implementer|reviewer): allow$/m);
  assert.equal(effectiveToolPermission(config.permission, brainstormer, 'create_issue'), 'deny');
  assert.equal(effectiveToolPermission(config.permission, brainstormer, 'todowrite'), 'deny');
  assert.equal(effectiveToolPermission(config.permission, brainstormer, 'custom_plugin_mutate'), 'deny');

  assert.deepEqual(rules, [{ pattern: '*', action: 'deny' }]);
  assert.equal(rules.some(({ action }) => action === 'allow'), false);
  // OpenCode may permission-check compound input as separate commands. With no
  // allow rule, both every parsed component and an unparsed fallback deny.
  for (const invocation of [
    'git status',
    'git branch --show-current',
    'git diff',
    'git log',
    'git show',
    'git push origin HEAD',
    'gh issue list --state all',
    'governance validate-project /workspace/example',
    'git status; git push origin HEAD',
    'git status && git push origin HEAD',
    'git status || git push origin HEAD',
    'git status | write-helper',
    'git status > status.txt',
    'write-helper',
  ]) {
    assert.equal(effectiveBashPermission(rules, invocation), 'deny', invocation);
  }
});

test('researcher permits named research capabilities without shell or LSP execution', async () => {
  const researcher = await readFile(new URL('../agents/researcher.md', import.meta.url), 'utf8');
  const config = JSON.parse(
    await readFile(new URL('../templates/opencode.json', import.meta.url), 'utf8'),
  );
  const rules = bashPermissionRules(researcher);

  assert.match(researcher, /^permission:\n  "\*": deny$/m);
  assert.match(researcher, /^  read:\n    "\*": allow\n    "\*\.env": deny\n    "\*\.env\.\*": deny\n    "\*\.env\.example": allow$/m);
  for (const tool of ['glob', 'grep', 'list', 'webfetch', 'websearch', 'skill']) {
    assert.equal(effectiveToolPermission(config.permission, researcher, tool), 'allow', tool);
  }
  assert.match(researcher, /^  lsp: deny$/m);
  for (const tool of [
    'edit',
    'task',
    'question',
    'lsp',
    'create_issue',
    'custom_plugin_mutate',
    'mcp_github_create_issue',
  ]) {
    assert.equal(effectiveToolPermission(config.permission, researcher, tool), 'deny', tool);
  }
  assert.match(researcher, /^  external_directory:\n    "\*": deny\n    "~\/\.local\/share\/opencode\/tool-output\/\*\*": allow\n    "\/tmp\/opencode\/\*\*": allow$/m);
  assert.match(researcher, /native file tools, including tool-output reads/i);
  assert.match(researcher, /native web tools for external research/i);
  assert.match(researcher, /skills only for procedural guidance/i);
  assert.match(researcher, /never .*use shell commands or LSP/i);
  assert.deepEqual(rules, [{ pattern: '*', action: 'deny' }]);
  assert.equal(rules.some(({ action }) => action === 'allow'), false);
  // The catch-all denies every command OpenCode derives from compound input; no
  // raw separator pattern is relied upon as a parser boundary.
  for (const invocation of [
    'git status',
    'git branch --show-current',
    'git diff',
    'git log',
    'git show HEAD',
    'git remote -v',
    'gh issue view 1',
    'node research.mjs',
    'curl https://example.com',
    'git status; gh issue view 1',
    'git diff > result.patch',
    'gh issue view 1 | write-helper',
    'write-helper',
  ]) {
    assert.equal(effectiveBashPermission(rules, invocation), 'deny', invocation);
  }
});

test('brainstorm prompt enforces staged exploration, explicit selection, and exploratory handoff', async () => {
  const brainstormer = await readFile(new URL('../agents/brainstormer.md', import.meta.url), 'utf8');
  const command = await readFile(new URL('../commands/brainstorm.md', import.meta.url), 'utf8');
  const retentionContracts = new Map([
    ['agents/brainstormer.md', brainstormer],
    ['commands/brainstorm.md', command],
    ['README.md', await readFile(new URL('../README.md', import.meta.url), 'utf8')],
    ['docs/design.md', await readFile(new URL('../docs/design.md', import.meta.url), 'utf8')],
    ['docs/implementation-plan.md', await readFile(new URL('../docs/implementation-plan.md', import.meta.url), 'utf8')],
    ['docs/operations.md', await readFile(new URL('../docs/operations.md', import.meta.url), 'utf8')],
    ['docs/roadmap.md', await readFile(new URL('../docs/roadmap.md', import.meta.url), 'utf8')],
  ]);

  for (const phrase of [
    'Frame the problem before proposing solutions',
    'Explore` for broad possibilities',
    'Ask exactly one material question per turn',
    'After roughly five questions',
    'impact times uncertainty',
    'Diverge before converging',
    'two to four genuinely distinct candidate directions',
    'measurable, implementation-independent observable outcome',
    'Compare every candidate against those criteria before recommending one',
    'Pressure-test the preferred direction',
    'Never translate a recommendation into a selection',
    'Verified Evidence` and `Hypotheses`',
    'rabbit holes, no-gos',
    'Selected Concept Brief',
    'Exploratory only - not an implementation task, approval to build, or published issue',
  ]) {
    assert.match(brainstormer, new RegExp(phrase), phrase);
  }
  assert.match(brainstormer, /selecting one direction, another divergence round.*researching first, deferring, rejecting the premise, or deciding not to build/i);
  for (const posture of ['expand', 'selectively expand', 'hold', 'reduce']) {
    assert.match(brainstormer, new RegExp(`\\b${posture}\\b`), posture);
  }
  assert.match(brainstormer, /For every substantive brainstorm.*state both the best-fit exploration mode and ambition posture/i);
  assert.match(brainstormer, /the user may override either/i);
  assert.match(brainstormer, /trivial session may skip this ceremony only when it ends without substantive synthesis/i);
  assert.match(brainstormer, /reflect the chosen ambition posture in candidate scope and comparison wherever it is material/i);
  assert.match(brainstormer, /`Exploration Mode and Ambition Posture`.*including any user override/i);
  assert.match(brainstormer, /current-repository issue, pull request, or other GitHub metadata.*delegate one bounded read-only question with repository or source scope and stopping criteria/i);
  assert.match(brainstormer, /researcher is the sole GitHub and web research path/i);
  assert.match(brainstormer, /`Status`: `candidates`, `selected`, `research-needed`, `deferred`, `rejected-premise`, or `do-not-build`/i);
  assert.match(brainstormer, /`rejected-premise` when the problem framing or premise is invalid.*`do-not-build` when the problem is valid but does not justify a build/i);
  for (const section of [
    'Status',
    'Exploration Mode and Ambition Posture',
    'Problem',
    'Verified Evidence',
    'Hypotheses',
    'Appetite and Constraints',
    'User Decision or Current Owner',
    'Disclaimer',
  ]) {
    assert.match(brainstormer, new RegExp(`Every status[\\s\\S]*\`${section}\``), section);
  }
  assert.match(brainstormer, /`candidates`: include `Candidate Directions`.*`Comparison`.*`Recommendation`.*`Pressure Test`.*Do not include a `Selected Concept Brief` or `Next Step`/i);
  assert.match(brainstormer, /`selected`: include all four convergence sections required for `candidates`.*`Selected Concept Brief`.*`Next Step`.*manually copy the brief into `\/shape-task <selected concept brief>`/i);
  assert.match(brainstormer, /`research-needed`: include the `Blocking Evidence Question`, `Why It Matters`, `Bounded Source and Scope`, named `Owner`, and `Stopping and Decision Criterion`.*Do not invent candidate directions/i);
  assert.match(brainstormer, /`deferred`: include the `Reason`, unresolved `Revisit Trigger or Condition`, and `Owner` when known.*Do not invent candidate directions/i);
  assert.match(brainstormer, /`rejected-premise`: include the `Invalid Premise`, `Evidence and Reason`, and `Reframing Needed`.*no candidate directions and no shape-task next step/i);
  assert.match(brainstormer, /`do-not-build`: include the `Valid Problem`, `Why Build Is Unjustified`, and `Non-build or Current-baseline Response`.*no candidate directions and no shape-task next step/i);
  assert.match(brainstormer, /`Candidate Directions`, `Comparison`, `Recommendation`, and `Pressure Test` are conditional on completed divergence and convergence and appear only for `candidates` or `selected`/i);
  assert.match(brainstormer, /`Selected Concept Brief` and `Next Step` appear only for `selected` after explicit user selection/i);
  assert.match(brainstormer, /Only `research-needed`, `deferred`, `rejected-premise`, and `do-not-build` are terminal for the current session/i);
  assert.match(brainstormer, /`candidates` remains interactive.*select, request more divergence, combine compatible elements, or adjust appetite/i);
  assert.match(brainstormer, /`selected` can be handed off manually/i);
  assert.match(brainstormer, /Never edit or create files/i);
  assert.doesNotMatch(brainstormer, /track its conversational work/i);
  assert.match(brainstormer, /copy the brief into `\/shape-task <selected concept brief>`/i);
  assert.match(brainstormer, /task-shaper must independently ground and validate any later handoff as untrusted input/i);
  assert.match(command, /state a fitting exploration mode and ambition posture while allowing the user to override either/i);
  assert.match(command, /convergence sections only after completed divergence and convergence/i);
  assert.match(command, /`candidates` remains interactive for selection, more divergence, compatible combination, or appetite adjustment/i);
  assert.match(command, /selected concept brief and manual `\/shape-task` next step appear only after explicit selection/i);
  assert.match(command, /only `research-needed`, `deferred`, `rejected-premise`, and `do-not-build` are terminal for the current session/i);
  assert.match(command, /terminal for the current session, with disposition evidence but no invented candidates or shape-task next step/i);
  assert.match(command, /Never automatically invoke `\/shape-task` or `\/orchestrate`/);
  for (const [path, content] of retentionContracts) {
    assert.match(
      content,
      /creates\s+no\s+repository\s+artifact,\s+todo\s+state,\s+issue,\s+or\s+dedicated\s+resumable\s+workflow\s+state\s+or\s+database/i,
      `${path}: no dedicated brainstorming state contract`,
    );
    assert.match(
      content,
      /does\s+not\s+deliberately\s+write\s+files\s+or\s+state\s+via\s+tools/i,
      `${path}: no deliberate state writes`,
    );
    assert.match(
      content,
      /Normal\s+OpenCode\s+conversation\s+and\s+message\s+retention,\s+including\s+delegated\s+researcher\s+subagent\s+session\s+retention,\s+still\s+applies\s+according\s+to\s+the\s+user's\s+OpenCode\s+environment\s+and\s+policy/i,
      `${path}: OpenCode retention contract`,
    );
    assert.match(
      content,
      /Do\s+not\s+treat\s+brainstorming\s+sessions\s+as\s+ephemeral,\s+automatically\s+cleaned\s+up,\s+or\s+safe\s+for\s+secrets/i,
      `${path}: retention safety warning`,
    );
    assert.doesNotMatch(content, /persists no session state/i, `${path}: obsolete literal promise`);
  }
  assert.match(
    retentionContracts.get('docs/roadmap.md'),
    /dedicated\s+or\s+persistent\s+resumable\s+brainstorming\s+workflow\s+state\s+or\s+databases\.\s+Normal\s+OpenCode\s+runtime\s+session\s+history\s+is\s+not\s+part\s+of\s+this\s+deferral/is,
  );
});

test('read-only remote discovery cannot be extended into remote mutation', async () => {
  const agents = new URL('../agents/', import.meta.url);
  for (const name of ['orchestrator', 'task-shaper']) {
    const rules = bashPermissionRules(await readFile(new URL(`${name}.md`, agents), 'utf8'));
    assert.equal(effectiveBashPermission(rules, 'git remote -v'), 'allow', name);
    for (const command of [
      'git remote add upstream https://example.com/upstream.git',
      'git remote remove origin',
      'git remote set-url origin https://example.com/repository.git',
      'git remote -v add upstream https://example.com/upstream.git',
      'git remote -v remove origin',
      'git remote -v set-url origin https://example.com/repository.git',
    ]) {
      assert.equal(effectiveBashPermission(rules, command), 'deny', `${name}: ${command}`);
    }
  }
});

test('current-branch discovery cannot be extended with branch mutation arguments', async () => {
  const agents = new URL('../agents/', import.meta.url);
  for (const name of ['orchestrator', 'implementer', 'reviewer', 'task-shaper']) {
    const rules = bashPermissionRules(await readFile(new URL(`${name}.md`, agents), 'utf8'));
    assert.equal(effectiveBashPermission(rules, 'git branch --show-current'), 'allow', name);
    for (const command of [
      'git branch --show-current -m renamed',
      'git branch --show-current -d obsolete',
      'git branch --show-current --delete obsolete',
    ]) {
      assert.equal(effectiveBashPermission(rules, command), 'deny', `${name}: ${command}`);
    }
  }
});

test('validates issue contract field requiredness, uniqueness, and title prefix', async (t) => {
  const root = await productionDistribution(t);
  const file = join(root, 'templates', '.github', 'ISSUE_TEMPLATE', 'agent-task.yml');
  const original = await readFile(file, 'utf8');

  await writeFile(file, `title: "[Agent] "\n${original}`);
  let output = (await validateDistribution(root))
    .map(({ path, message }) => `${path}: ${message}`)
    .join('\n');
  assert.match(output, /title: must not define an automatic title prefix/);

  await writeFile(
    file,
    original
      .replace('      required: true', '      required: false')
      .replace(/\n  - type: textarea\n    id: references[\s\S]*$/, '\n  - type: textarea\n    id: outcome\n    attributes:\n      label: duplicate\n'),
  );
  output = (await validateDistribution(root))
    .map(({ path, message }) => `${path}: ${message}`)
    .join('\n');
  assert.match(output, /body\.outcome: field id must be unique/);
  assert.match(output, /body\.outcome: field must be required/);
  assert.match(output, /missing required contract field "references"/);
});

test('requires one top-level body sequence and rejects contract fields outside it', async (t) => {
  const root = await productionDistribution(t);
  const file = join(root, 'templates', '.github', 'ISSUE_TEMPLATE', 'agent-task.yml');
  const original = await readFile(file, 'utf8');
  const cases = [
    [original.replace('body:', 'fields:'), /must define exactly one top-level "body" key/],
    [original.replace('body:\n', 'body: {}\n'), /body: must be a block sequence/],
    [`body:\n${original}`, /must define exactly one top-level "body" key/],
    [
      `${original}outside:\n  - type: textarea\n    id: outcome\n`,
      /contract fields must be inside the top-level "body" sequence/,
    ],
  ];

  for (const [content, expected] of cases) {
    await writeFile(file, content);
    const output = (await validateDistribution(root))
      .map(({ path, message }) => `${path}: ${message}`)
      .join('\n');
    assert.match(output, expected);
  }
});

test('production prompts enforce complete shaped handoffs and precedence', async () => {
  const agents = new URL('../agents/', import.meta.url);
  const orchestrator = await readFile(new URL('orchestrator.md', agents), 'utf8');
  const implementer = await readFile(new URL('implementer.md', agents), 'utf8');
  const reviewer = await readFile(new URL('reviewer.md', agents), 'utf8');
  const taskShaper = await readFile(new URL('task-shaper.md', agents), 'utf8');

  for (const phrase of [
    'repository root',
    'current branch, base, and whether the branch is published',
    'working-tree boundary',
    'unrelated changes',
    'workflow stage',
    'review and CI evidence',
    'configured verification command verbatim',
    'whether dependency installation is authorized',
    'prohibitions on commit, push',
  ]) {
    assert.match(orchestrator, new RegExp(phrase), phrase);
  }
  assert.match(orchestrator, /issue number or URL is only a lookup key/i);
  assert.match(orchestrator, /never hand an agent a bare issue reference/i);
  assert.match(implementer, /product behavior, scope, non-goals, compatibility requirements.*binding/i);
  assert.match(implementer, /Internal implementation choices.*remain your discretion/i);
  assert.match(reviewer, /complete shaped contract/i);
  assert.match(orchestrator, /full contract, not only a summary/i);
  assert.match(taskShaper, /search open and closed issues for duplicate or materially overlapping outcomes/i);
  assert.match(taskShaper, /Present the exact repository, title, and complete body/i);
  assert.match(taskShaper, /Any draft change invalidates prior approval/i);
});

test('implementer denies bare and argument forms of every prohibited Git mutation', async () => {
  const implementer = await readFile(new URL('../agents/implementer.md', import.meta.url), 'utf8');
  const rules = bashPermissionRules(implementer);
  const prohibitedGit = new Map([
    ['add', 'file.txt'],
    ['commit', '-m change'],
    ['push', 'origin HEAD'],
    ['pull', '--ff-only'],
    ['fetch', 'origin'],
    ['switch', 'feature'],
    ['checkout', 'feature'],
    ['merge', 'feature'],
    ['rebase', 'main'],
    ['reset', '--hard'],
    ['restore', 'file.txt'],
    ['clean', '-fd'],
    ['stash', 'push'],
    ['tag', 'v1.0.0'],
  ]);

  for (const [operation, args] of prohibitedGit) {
    assert.equal(effectiveBashPermission(rules, `git ${operation}`), 'deny', `git ${operation}`);
    assert.equal(
      effectiveBashPermission(rules, `git ${operation} ${args}`),
      'deny',
      `git ${operation} ${args}`,
    );
  }
  for (const command of ['git status', 'git diff', 'git log', 'git show']) {
    assert.equal(effectiveBashPermission(rules, command), 'allow', command);
  }
  for (const command of ['git branch feature', 'git branch -m renamed']) {
    assert.equal(effectiveBashPermission(rules, command), 'deny', command);
  }
  assert.equal(effectiveBashPermission(rules, 'git branch --show-current'), 'allow');
});

test('orchestrator denies direct destructive shell boundaries while preserving workflow actions', async () => {
  const orchestrator = await readFile(new URL('../agents/orchestrator.md', import.meta.url), 'utf8');
  const rules = bashPermissionRules(orchestrator);

  for (const command of [
    'git branch -D obsolete',
    'git checkout feature',
    'git restore file.txt',
    'git reset --hard',
    'git clean -fd',
    'git stash push',
    'git tag -d v1.0.0',
    'gh repo archive owner/repo',
    'npm publish',
    'terraform -chdir=infra apply',
    'terraform -chdir=infra destroy',
    'rm -rf build',
    'sudo npm install',
  ]) {
    assert.equal(effectiveBashPermission(rules, command), 'deny', command);
  }
  for (const manager of ['npm', 'pnpm', 'yarn', 'bun']) {
    for (const operation of ['publish', 'release', 'deploy']) {
      for (const command of [`${manager} ${operation}`, `${manager} run ${operation}`]) {
        assert.equal(effectiveBashPermission(rules, command), 'deny', command);
      }
    }
  }

  assert.equal(effectiveBashPermission(rules, 'git push origin HEAD'), 'allow');
  assert.equal(effectiveBashPermission(rules, 'git push -u origin HEAD'), 'allow');
  assert.equal(effectiveBashPermission(rules, 'gh pr merge --squash 123'), 'allow');
  assert.equal(effectiveBashPermission(rules, 'git status'), 'allow');
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

  for (const name of ['orchestrator', 'reviewer']) {
    const content = await readFile(new URL(`${name}.md`, agents), 'utf8');
    for (const command of ['git diff', 'git show', 'git log']) {
      assert.match(content, new RegExp(`^    "${command}\\*--output\\*": deny$`, 'm'));
      assert.match(content, new RegExp(`^    "${command}\\*>\\*": deny$`, 'm'));
    }
  }

  const brainstormer = await readFile(new URL('brainstormer.md', agents), 'utf8');
  for (const command of ['git diff', 'git show', 'git log']) {
    assert.doesNotMatch(brainstormer, new RegExp(`^    "${command}\\*`, 'm'));
  }
});
