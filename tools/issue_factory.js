import { tool } from '@opencode-ai/plugin';
import { executeIssueFactory } from '../lib/issue-factory.mjs';
import { loadProjectContext } from '../lib/project-context.mjs';

/** Prevent process credentials from crossing into durable tool output. */
function redact(value) {
  return value.trim()
    .replace(/(authorization:\s*(?:bearer|token)\s+)\S+/gi, '$1[redacted]')
    .replace(/\b(?:gh[pousr]_[A-Za-z0-9_]{20,}|github_pat_[A-Za-z0-9_]+)\b/g, '[redacted]');
}

/** Run GitHub CLI without a shell and capture a complete structured outcome. */
async function run(argv, cwd) {
  const child = Bun.spawn(argv, { cwd, stdout: 'pipe', stderr: 'pipe' });
  /** Concurrent pipe reads prevent a full stderr buffer from deadlocking the child. */
  const [exitCode, stdout, stderr] = await Promise.all([
    child.exited,
    new Response(child.stdout).text(),
    new Response(child.stderr).text(),
  ]);
  return { argv, exitCode, stdout: stdout.trim(), stderr: redact(stderr) };
}

/** Expose reviewed issue publication without arbitrary GitHub body input. */
export default tool({
  description: 'Preview, publish, or enqueue one durable approved issue artifact.',
  args: {
    action: tool.schema.string(), issue: tool.schema.any(), digest: tool.schema.string().optional(),
    review: tool.schema.any().optional(), issueUrl: tool.schema.string().optional(),
  },
  /** Execute one issue-factory action and preserve its structured result. */
  async execute(input, context) {
    /** Project context is the sole source of repository and trusted-author authority. */
    const project = await loadProjectContext(context?.directory);
    if (project.status !== 'valid') return JSON.stringify({ action: input.action, status: 'rejected', errors: project.diagnostics });
    /** Enrichment overwrites any undeclared caller authority before execution. */
    const enriched = { ...input, repository: project.config.repository, trustedActors: project.config.trustedActors, project: project.config };
    /** The inline adapter pins every GitHub invocation to the validated project root. */
    return JSON.stringify(await executeIssueFactory(enriched, (argv) => run(argv, project.root)));
  },
});
