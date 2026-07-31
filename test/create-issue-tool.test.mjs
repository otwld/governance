import assert from 'node:assert/strict';
import { copyFile, mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import test from 'node:test';

async function loadTool(t, spawn) {
  const root = await mkdtemp(join(tmpdir(), 'governance-create-issue-tool-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  await mkdir(join(root, 'tools'), { recursive: true });
  await mkdir(join(root, 'node_modules', '@opencode-ai', 'plugin'), { recursive: true });
  await writeFile(join(root, 'package.json'), JSON.stringify({ type: 'module' }));
  await writeFile(
    join(root, 'node_modules', '@opencode-ai', 'plugin', 'package.json'),
    JSON.stringify({ name: '@opencode-ai/plugin', type: 'module', exports: './index.js' }),
  );
  await writeFile(
    join(root, 'node_modules', '@opencode-ai', 'plugin', 'index.js'),
    [
      'export function tool(definition) { return definition; }',
      'tool.schema = {',
      '  string() { return { min() { return this; } }; },',
      '};',
      '',
    ].join('\n'),
  );
  const toolFile = join(root, 'tools', 'create_issue.js');
  await copyFile(new URL('../tools/create_issue.js', import.meta.url), toolFile);

  const previousBun = globalThis.Bun;
  globalThis.Bun = { spawn };
  t.after(() => {
    if (previousBun === undefined) delete globalThis.Bun;
    else globalThis.Bun = previousBun;
  });
  return (await import(pathToFileURL(toolFile))).default;
}

function stream(text) {
  return new Response(text).body;
}

test('create_issue transfers approved rich Markdown unchanged in one structured spawn', async (t) => {
  const calls = [];
  const body = [
    '## Outcome',
    'Keep $GH_TOKEN, $(whoami), ${HOME}, and `backticks` literal.',
    "Keep apostrophes like user's; semicolons; && pipes | redirects < and >.",
    'Option-like text: --body, --label, --repo.',
  ].join('\n');
  const spawn = (argv, options) => {
    calls.push({ argv, options });
    return {
      exited: Promise.resolve(0),
      stdout: stream('https://github.com/OTWLD/governance/issues/123\n'),
      stderr: stream(''),
    };
  };
  const createIssue = await loadTool(t, spawn);

  const result = await createIssue.execute({
    repo: 'OTWLD/governance',
    title: "Preserve user's approved Markdown",
    body,
  });

  assert.equal(result, 'https://github.com/OTWLD/governance/issues/123');
  assert.deepEqual(calls, [{
    argv: [
      'gh',
      'issue',
      'create',
      '--repo',
      'OTWLD/governance',
      '--title',
      "Preserve user's approved Markdown",
      '--body',
      body,
    ],
    options: { stdout: 'pipe', stderr: 'pipe' },
  }]);
});

test('create_issue reports nonzero stderr and does not retry', async (t) => {
  let calls = 0;
  const token = 'ghp_abcdefghijklmnopqrstuvwxyz123456';
  const createIssue = await loadTool(t, () => {
    calls += 1;
    return {
      exited: Promise.resolve(1),
      stdout: stream(''),
      stderr: stream(`GraphQL: issue creation denied for ${token}\n`),
    };
  });

  await assert.rejects(
    createIssue.execute({ repo: 'OTWLD/governance', title: 'One outcome', body: 'Body' }),
    (error) => {
      assert.match(error.message, /exit code 1: GraphQL: issue creation denied for \[redacted\]/);
      assert.doesNotMatch(error.message, new RegExp(token));
      return true;
    },
  );
  assert.equal(calls, 1);
});

test('create_issue treats empty successful output as ambiguous and does not retry', async (t) => {
  let calls = 0;
  const createIssue = await loadTool(t, () => {
    calls += 1;
    return {
      exited: Promise.resolve(0),
      stdout: stream(' \n'),
      stderr: stream(''),
    };
  });

  await assert.rejects(
    createIssue.execute({ repo: 'OTWLD/governance', title: 'One outcome', body: 'Body' }),
    /without returning an issue URL/,
  );
  assert.equal(calls, 1);
});
