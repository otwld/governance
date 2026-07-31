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

  for (const name of ['orchestrator', 'implementer', 'reviewer', 'researcher', 'task-shaper']) {
    const defaultPermission = name === 'task-shaper' ? 'deny' : 'allow';
    const createIssuePermission = name === 'task-shaper' ? 'allow' : 'deny';
    await writeFile(
      join(root, 'agents', `${name}.md`),
      `---\ndescription: ${name} agent\nmode: ${['orchestrator', 'task-shaper'].includes(name) ? 'primary' : 'subagent'}\npermission:\n  "*": ${defaultPermission}\n  create_issue: ${createIssuePermission}\n---\n`,
    );
  }
  for (const name of ['orchestrate', 'orchestrate-loop', 'setup-project', 'review', 'shape-task']) {
    await writeFile(
      join(root, 'commands', `${name}.md`),
      `---\ndescription: ${name} command\nagent: ${name === 'review' ? 'reviewer' : name === 'shape-task' ? 'task-shaper' : 'orchestrator'}\n---\n`,
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
    ['orchestrator', 'primary'],
    ['implementer', 'subagent'],
    ['reviewer', 'subagent'],
    ['researcher', 'subagent'],
    ['task-shaper', 'primary'],
  ]);
  for (const [name, expectedMode] of agentModes) {
    const wrongMode = expectedMode === 'primary' ? 'subagent' : 'primary';
    const defaultPermission = name === 'task-shaper' ? 'deny' : 'allow';
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
  for (const name of ['orchestrator', 'implementer', 'reviewer', 'researcher', 'task-shaper']) {
    const mode = ['orchestrator', 'task-shaper'].includes(name) ? 'primary' : 'subagent';
    const expectedDefault = name === 'task-shaper' ? 'deny' : 'allow';
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

  for (const name of ['orchestrator', 'implementer', 'reviewer', 'researcher']) {
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
  for (const name of ['orchestrator', 'implementer', 'reviewer', 'researcher']) {
    const content = await readFile(new URL(`${name}.md`, agents), 'utf8');
    assert.match(content, /^permission:\n  "\*": allow$/m, name);
    assert.doesNotMatch(content, /:\s*(?:ask|"ask"|'ask')\s*$/m, name);
    assert.equal(effectiveToolPermission(config.permission, content, 'create_issue'), 'deny', name);
  }
  const taskShaper = await readFile(new URL('task-shaper.md', agents), 'utf8');
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

test('read-only remote discovery cannot be extended into remote mutation', async () => {
  const agents = new URL('../agents/', import.meta.url);
  for (const name of ['orchestrator', 'researcher', 'task-shaper']) {
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

  for (const name of ['orchestrator', 'reviewer', 'researcher']) {
    const content = await readFile(new URL(`${name}.md`, agents), 'utf8');
    for (const command of ['git diff', 'git show', 'git log']) {
      assert.match(content, new RegExp(`^    "${command}\\*--output\\*": deny$`, 'm'));
      assert.match(content, new RegExp(`^    "${command}\\*>\\*": deny$`, 'm'));
    }
  }
});
