import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { validateProject, validateProjectConfig } from '../lib/validation.mjs';

async function repository(t) {
  const root = await mkdtemp(join(tmpdir(), 'governance-project-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  await mkdir(join(root, '.opencode'), { recursive: true });
  return root;
}

test('accepts a valid project configuration and existing documents', async (t) => {
  const root = await repository(t);
  const config = {
    $schema: '../schemas/project.schema.json',
    version: 1,
    commands: {
      verify: 'npm run check',
      install: 'npm ci',
    },
    documents: [
      { path: 'AGENTS.md', purpose: 'Repository guidance' },
      { path: 'docs', purpose: 'Project documentation' },
    ],
    githubProject: {
      owner: 'example',
      number: 12,
      statuses: {
        ready: 'Ready',
        active: 'In progress',
        review: 'In review',
        done: 'Done',
        blocked: 'Blocked',
      },
      priorityField: 'Priority',
    },
    merge: {
      method: 'squash',
      automatic: true,
    },
  };
  await mkdir(join(root, 'docs'));
  await writeFile(join(root, 'AGENTS.md'), '# Guidance\n');
  await writeFile(join(root, '.opencode/project.json'), `${JSON.stringify(config)}\n`);

  assert.deepEqual(await validateProject(root), []);
});

test('reports invalid project configuration fields', () => {
  const diagnostics = validateProjectConfig({
    version: 2,
    name: 'Invalid Name',
    commands: { verify: '', install: '', extra: true },
    documents: [
      { path: '../outside.md', purpose: '', extra: true },
      { path: 'good.md', purpose: 'Guidance' },
      { path: 'good.md', purpose: 'Guidance' },
    ],
    githubProject: {
      owner: '',
      number: 0,
      statuses: {
        ready: '',
        active: '',
        review: '',
        done: '',
        blocked: '',
        extra: '',
      },
      priorityField: '',
      extra: true,
    },
    merge: { method: 'merge', automatic: 'yes', extra: true },
    extra: true,
  });
  const output = diagnostics.map(({ path, message }) => `${path}: ${message}`).join('\n');

  assert.match(output, /\.extra: unknown property/);
  assert.match(output, /\.name: unknown property/);
  assert.match(output, /\.version: must equal 1/);
  assert.match(output, /commands\.extra: unknown property/);
  assert.match(output, /commands\.verify: must be a non-empty string/);
  assert.match(output, /documents\[0\]\.extra: unknown property/);
  assert.match(output, /documents\[0\]\.path: must be a safe relative path/);
  assert.match(output, /documents\[2\]: duplicates a document object/);
  assert.match(output, /githubProject\.number: must be a positive integer/);
  assert.match(output, /githubProject\.statuses\.extra: unknown property/);
  assert.match(output, /githubProject\.statuses\.ready: must be a non-empty string/);
  assert.match(output, /merge\.method: must equal "squash"/);
  assert.match(output, /merge\.automatic: must be a boolean/);
});

test('rejects whitespace strings and repeated statuses while accepting repeated document paths', () => {
  const diagnostics = validateProjectConfig({
    $schema: '   ',
    version: 1,
    commands: { verify: '   ' },
    documents: [
      { path: 'AGENTS.md', purpose: 'Primary guidance' },
      { path: 'AGENTS.md', purpose: 'Duplicate guidance' },
    ],
    githubProject: {
      owner: 'OTWLD',
      number: 1,
      statuses: {
        ready: 'Ready',
        active: 'Ready',
        review: 'In review',
        done: 'Done',
        blocked: 'Blocked',
      },
    },
    merge: { method: 'squash', automatic: true },
  });
  const output = diagnostics.map(({ path, message }) => `${path}: ${message}`).join('\n');

  assert.match(output, /\.\$schema: must be a non-empty string/);
  assert.match(output, /commands\.verify: must be a non-empty string/);
  assert.doesNotMatch(output, /duplicates document path/);
  assert.match(
    output,
    /githubProject\.statuses\.active: must differ from status "ready"; status values must be pairwise distinct/,
  );
  assert.equal(diagnostics.length, 3);
});

test('accepts only supported verification and safe install command families', () => {
  const config = (commands) => ({
    version: 1,
    commands,
    documents: [{ path: 'AGENTS.md', purpose: 'Agent guidance' }],
    merge: { method: 'squash', automatic: false },
  });
  const verificationCommands = [
    'npm test',
    'npm run check -- --coverage',
    'npm run test:unit -- --coverage',
    'pnpm test --filter api',
    'pnpm run lint',
    'pnpm run typecheck:api --filter api',
    'yarn test',
    'yarn run lint',
    'yarn verify:ci --verbose',
    'bun test test/*.test.mjs',
    'bun run check',
    'bun run ci:fast --coverage',
    'nx affected --target=test',
    'npx nx run-many --target=lint',
    'pnpm nx test api',
    'pnpm exec nx lint api',
    'yarn nx build app',
    'bunx nx affected --target=build',
    'node --test test/*.test.mjs',
    'node --check bin/governance.mjs',
  ];
  for (const verify of verificationCommands) {
    assert.deepEqual(validateProjectConfig(config({ verify })), [], verify);
  }
  for (const script of ['test', 'lint', 'typecheck', 'check', 'validate', 'build', 'ci', 'verify']) {
    for (const prefix of ['npm run', 'pnpm run', 'yarn', 'yarn run', 'bun run']) {
      const verify = `${prefix} ${script}:ci -- --coverage`;
      assert.deepEqual(validateProjectConfig(config({ verify })), [], verify);
    }
  }
  for (const runner of ['nx', 'npx nx', 'pnpm nx', 'pnpm exec nx', 'yarn nx', 'bunx nx']) {
    for (const command of ['affected', 'run-many', 'test', 'lint', 'build']) {
      const verify = `${runner} ${command} --configuration=ci`;
      assert.deepEqual(validateProjectConfig(config({ verify })), [], verify);
    }
  }

  const installCommands = [
    'npm ci',
    'npm ci --ignore-scripts',
    'pnpm install --frozen-lockfile --filter api',
    'yarn install --immutable --inline-builds',
    'bun install --frozen-lockfile --production',
  ];
  for (const install of installCommands) {
    assert.deepEqual(
      validateProjectConfig(config({ verify: 'npm test', install })),
      [],
      install,
    );
  }

  const rejectedVerificationCommands = [
    'npm run',
    'npm run publish',
    'npm run testing',
    'npm install',
    'pnpm install --frozen-lockfile',
    'pnpm run format',
    'yarn install --immutable',
    'yarn run publish',
    'bun install',
    'bun run deploy',
    'npx jest',
    'nx deploy api',
    'npx nx exec command',
    'pnpm exec jest',
    'yarn exec git push',
    'node script.mjs',
    'deno test',
    'governance validate-project .',
    'npm test && rm -rf .',
  ];
  for (const verify of rejectedVerificationCommands) {
    const diagnostics = validateProjectConfig(config({ verify }));
    assert.equal(diagnostics.length, 1, verify);
    assert.equal(diagnostics[0].path, '.opencode/project.json.commands.verify', verify);
    assert.match(diagnostics[0].message, /supported verification command family/, verify);
  }

  const mutatingVerificationCommands = [
    'yarn lint --fix',
    'npm run check -- --write',
    'pnpm run test --updateSnapshot',
    'pnpm run test --updateSnapshots',
    'bun run test --update-snapshot',
    'bun run test --update-snapshots',
    'node --test --test-update-snapshots',
    'npm test --watch',
    'npm test --watchAll',
    'npm test --watch-all=true',
    'npm test -u',
    'npm test -w',
  ];
  for (const verify of mutatingVerificationCommands) {
    const diagnostics = validateProjectConfig(config({ verify }));
    assert.equal(diagnostics.length, 1, verify);
    assert.equal(diagnostics[0].path, '.opencode/project.json.commands.verify', verify);
    assert.match(diagnostics[0].message, /must not use mutating verification flags/, verify);
  }

  for (const install of [
    'npm install',
    'pnpm install',
    'yarn install',
    'bun install',
    'npm ci && npm test',
  ]) {
    const diagnostics = validateProjectConfig(config({ verify: 'npm test', install }));
    assert.equal(diagnostics.length, 1, install);
    assert.equal(diagnostics[0].path, '.opencode/project.json.commands.install', install);
    assert.match(diagnostics[0].message, /must use npm ci/, install);
  }
});

test('accepts the minimal v1 model with distinct document paths', () => {
  assert.deepEqual(
    validateProjectConfig({
      version: 1,
      commands: { verify: 'node --test' },
      documents: [
        { path: 'docs', purpose: 'User documentation' },
        { path: 'AGENTS.md', purpose: 'Agent guidance' },
      ],
      merge: { method: 'squash', automatic: false },
    }),
    [],
  );
});

test('checks referenced files and directories only when requested', async (t) => {
  const root = await repository(t);
  const config = {
    version: 1,
    commands: { verify: 'npm test' },
    documents: [
      { path: 'docs', purpose: 'Documentation directory' },
      { path: 'missing.md', purpose: 'Missing guidance' },
    ],
    merge: { method: 'squash', automatic: false },
  };
  await mkdir(join(root, 'docs'));
  await writeFile(join(root, '.opencode/project.json'), JSON.stringify(config));

  const checked = await validateProject(root);
  assert.equal(checked.length, 1);
  assert.match(checked[0].message, /referenced document does not exist: missing\.md/);
  assert.deepEqual(await validateProject(root, { checkDocuments: false }), []);
});

test('published schema and template use the v1 model', async () => {
  const schema = JSON.parse(
    await readFile(new URL('../schemas/project.schema.json', import.meta.url), 'utf8'),
  );
  const template = JSON.parse(
    await readFile(new URL('../templates/project.json', import.meta.url), 'utf8'),
  );

  assert.deepEqual(schema.required, ['version', 'commands', 'documents', 'merge']);
  assert.equal(schema.additionalProperties, false);
  assert.equal(schema.properties.commands.additionalProperties, false);
  assert.equal(schema.properties.documents.items.additionalProperties, false);
  assert.equal(schema.properties.githubProject.additionalProperties, false);
  assert.equal(schema.properties.githubProject.properties.statuses.additionalProperties, false);
  assert.match(
    schema.properties.githubProject.properties.statuses.description,
    /CLI enforces.*standard JSON Schema cannot compare sibling values/,
  );
  assert.match(
    schema.properties.githubProject.properties.statuses.$comment,
    /pairwise-distinct.*standard JSON Schema cannot compare sibling values/,
  );
  assert.equal(schema.properties.merge.additionalProperties, false);
  assert.equal('name' in schema.properties, false);
  assert.equal('name' in template, false);
  assert.deepEqual(validateProjectConfig(template), []);

  const visit = (value, path = '$') => {
    if (value === null || typeof value !== 'object') return;
    if (value.type === 'string') {
      assert.equal(typeof value.pattern, 'string', `${path} must define a string pattern`);
      assert.equal(new RegExp(value.pattern).test('   '), false, `${path} must reject whitespace`);
    }
    for (const [key, child] of Object.entries(value)) visit(child, `${path}.${key}`);
  };
  visit(schema);

  const verifyPattern = new RegExp(schema.properties.commands.properties.verify.pattern);
  const installPattern = new RegExp(schema.properties.commands.properties.install.pattern);
  assert.match(
    schema.properties.commands.properties.verify.description,
    /Mutating --fix, --write, snapshot-update, watch, standalone -u, and standalone -w flags are forbidden/,
  );
  for (const value of [
    'npm test',
    'npm run verify:ci --coverage',
    'pnpm run typecheck',
    'yarn run lint',
    'bun run build:prod',
    'nx affected --target=test',
    'npx nx run-many --target=lint',
    'pnpm nx test api',
    'pnpm exec nx lint api',
    'yarn nx build app',
    'bunx nx affected --target=build',
    'node --test',
  ]) {
    assert.equal(verifyPattern.test(value), true, `schema must accept ${value}`);
  }
  for (const script of ['test', 'lint', 'typecheck', 'check', 'validate', 'build', 'ci', 'verify']) {
    for (const prefix of ['npm run', 'pnpm run', 'yarn', 'yarn run', 'bun run']) {
      const value = `${prefix} ${script}:ci -- --coverage`;
      assert.equal(verifyPattern.test(value), true, `schema must accept ${value}`);
    }
  }
  for (const runner of ['nx', 'npx nx', 'pnpm nx', 'pnpm exec nx', 'yarn nx', 'bunx nx']) {
    for (const command of ['affected', 'run-many', 'test', 'lint', 'build']) {
      const value = `${runner} ${command} --configuration=ci`;
      assert.equal(verifyPattern.test(value), true, `schema must accept ${value}`);
    }
  }
  for (const value of [
    'npm install',
    'npm run publish',
    'pnpm run format',
    'yarn lint --fix',
    'bun run test -u',
    'nx deploy api',
    'npx nx exec command',
    'node --test --watch',
    'node script.mjs',
    'npm test && npm run lint',
  ]) {
    assert.equal(verifyPattern.test(value), false, `schema must reject ${value}`);
  }
  for (const value of ['npm ci', 'yarn install --immutable --inline-builds']) {
    assert.equal(installPattern.test(value), true, `schema must accept ${value}`);
  }
  for (const value of ['npm install', 'pnpm install', 'npm ci && npm test']) {
    assert.equal(installPattern.test(value), false, `schema must reject ${value}`);
  }
});

test('reports missing and malformed project files', async (t) => {
  const root = await repository(t);
  assert.match((await validateProject(root))[0].message, /file does not exist/);

  await writeFile(join(root, '.opencode/project.json'), '{');
  assert.match((await validateProject(root))[0].message, /cannot parse JSON/);
});
