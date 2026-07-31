import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { access, mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import process from 'node:process';
import test from 'node:test';

const cli = new URL('../bin/governance.mjs', import.meta.url);

async function writeProductionDistribution(root) {
  await mkdir(join(root, 'agents'), { recursive: true });
  await mkdir(join(root, 'commands'), { recursive: true });
  await mkdir(join(root, 'tools'), { recursive: true });
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
  const fields = [
    ['outcome', true], ['problem-evidence', true], ['requirements', true],
    ['included-scope', true], ['out-of-scope', false], ['technical-direction', true],
    ['repository-context', true], ['acceptance-scenarios', true], ['validation', true],
    ['dependencies-readiness', true], ['assumptions', false], ['references', false],
  ];
  await writeFile(
    join(root, 'templates', '.github', 'ISSUE_TEMPLATE', 'agent-task.yml'),
    ['name: Task', 'description: Task contract', 'body:', ...fields.flatMap(([id, required]) => [
      '  - type: textarea', `    id: ${id}`, '    attributes:', `      label: ${id}`,
      ...(required ? ['    validations:', '      required: true'] : []),
    ]), ''].join('\n'),
  );
}

test('help exits successfully', () => {
  const result = spawnSync(process.execPath, [cli.pathname, 'help'], { encoding: 'utf8' });
  assert.equal(result.status, 0);
  assert.match(result.stdout, /validate-distribution/);
  assert.match(result.stdout, /install-global/);
  assert.match(result.stdout, /agents, commands, tools, and skills/);
  assert.doesNotMatch(result.stdout, /create-approved-issue/);
  assert.equal(result.stderr, '');
});

test('install-global is a dry run unless --apply is provided', async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'governance-cli-install-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const configHome = join(root, 'config');
  const skillsHome = join(root, 'skills');

  const result = spawnSync(
    process.execPath,
    [
      cli.pathname,
      'install-global',
      '--config-home',
      configHome,
      '--skills-home',
      skillsHome,
    ],
    { encoding: 'utf8' },
  );

  assert.equal(result.status, 0);
  assert.match(result.stdout, /Planned writes:/);
  assert.match(result.stdout, /no changes made/);
  assert.equal(result.stderr, '');
  await assert.rejects(access(configHome), { code: 'ENOENT' });
  await assert.rejects(access(skillsHome), { code: 'ENOENT' });
});

test('install-global reports conflicts with a nonzero exit and writes nothing', async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'governance-cli-conflict-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const configHome = join(root, 'config');
  const skillsHome = join(root, 'skills');
  await mkdir(join(configHome, 'agents'), { recursive: true });
  await writeFile(join(configHome, 'agents', 'implementer.md'), 'local customization\n');

  const result = spawnSync(
    process.execPath,
    [
      cli.pathname,
      'install-global',
      '--config-home',
      configHome,
      '--skills-home',
      skillsHome,
      '--apply',
    ],
    { encoding: 'utf8' },
  );

  assert.equal(result.status, 1);
  assert.match(result.stderr, /Conflict:.*implementer\.md/);
  assert.match(result.stderr, /no files were written/);
  await assert.rejects(access(join(configHome, 'commands')), { code: 'ENOENT' });
  await assert.rejects(access(skillsHome), { code: 'ENOENT' });
});

test('outer command errors use precise command failure wording', () => {
  const result = spawnSync(process.execPath, [cli.pathname, 'install-global', '--unknown'], {
    encoding: 'utf8',
  });

  assert.equal(result.status, 2);
  assert.equal(result.stdout, '');
  assert.equal(
    result.stderr,
    'Command failed: unknown install-global option: --unknown\n',
  );
});

test('validation errors produce a nonzero exit', async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'governance-cli-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  await mkdir(join(root, '.opencode'));
  await writeFile(
    join(root, '.opencode/project.json'),
    JSON.stringify({
      version: 1,
      commands: { verify: 'npm test' },
      documents: [{ path: 'missing.md', purpose: 'Missing guidance' }],
      merge: { method: 'squash', automatic: false },
    }),
  );

  const result = spawnSync(process.execPath, [cli.pathname, 'validate-project', root], {
    encoding: 'utf8',
  });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /referenced document does not exist: missing\.md/);
  assert.match(result.stderr, /Validation failed with 1 error/);
});

test('validate-project CLI rejects repeated GitHub Project statuses', async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'governance-cli-project-statuses-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  await mkdir(join(root, '.opencode'));
  await writeFile(join(root, 'AGENTS.md'), '# Guidance\n');
  await writeFile(
    join(root, '.opencode/project.json'),
    JSON.stringify({
      version: 1,
      commands: { verify: 'npm test' },
      documents: [{ path: 'AGENTS.md', purpose: 'Agent guidance' }],
      githubProject: {
        owner: 'example',
        number: 1,
        statuses: {
          ready: 'Ready',
          active: 'Ready',
          review: 'Review',
          done: 'Done',
          blocked: 'Blocked',
        },
      },
      merge: { method: 'squash', automatic: false },
    }),
  );

  const result = spawnSync(process.execPath, [cli.pathname, 'validate-project', root], {
    encoding: 'utf8',
  });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /statuses\.active: must differ from status "ready"/);
  assert.match(result.stderr, /Validation failed with 1 error/);
});

test('distribution CLI requires production composition while retaining reference checks', async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'governance-cli-distribution-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  await writeProductionDistribution(root);
  await rm(join(root, 'agents/reviewer.md'));
  await writeFile(
    join(root, 'commands/review.md'),
    '---\ndescription: Runs work\nagent: reviewer\n---\n',
  );

  const result = spawnSync(process.execPath, [cli.pathname, 'validate-distribution', root], {
    encoding: 'utf8',
  });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /missing required production agent "reviewer"/);
  assert.match(result.stderr, /field "agent" references missing agent "reviewer"/);
  assert.match(result.stderr, /Validation failed with 2 error/);
});
