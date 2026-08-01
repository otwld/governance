import { tool } from '@opencode-ai/plugin';
import { executeIssueFactory } from '../lib/issue-factory.mjs';

function redact(value) {
  return value.trim()
    .replace(/(authorization:\s*(?:bearer|token)\s+)\S+/gi, '$1[redacted]')
    .replace(/\b(?:gh[pousr]_[A-Za-z0-9_]{20,}|github_pat_[A-Za-z0-9_]+)\b/g, '[redacted]');
}

async function run(argv) {
  const child = Bun.spawn(argv, { stdout: 'pipe', stderr: 'pipe' });
  const [exitCode, stdout, stderr] = await Promise.all([
    child.exited,
    new Response(child.stdout).text(),
    new Response(child.stderr).text(),
  ]);
  return { argv, exitCode, stdout: stdout.trim(), stderr: redact(stderr) };
}

export default tool({
  description: 'Preview, publish, or enqueue one approved issue contract.',
  args: {
    action: tool.schema.string(), issue: tool.schema.any(), digest: tool.schema.string().optional(),
    review: tool.schema.any().optional(), issueUrl: tool.schema.string().optional(),
  },
  async execute(input) { return JSON.stringify(await executeIssueFactory(input, run)); },
});
