import { tool } from '@opencode-ai/plugin';
import { executeWorkflowState } from '../lib/workflow-state.mjs';
import { loadProjectContext } from '../lib/project-context.mjs';

/** Prevent process credentials from crossing into durable workflow output. */
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

/** Expose durable workflow publication and trusted-author inspection. */
export default tool({
  description: 'Preview, publish, or inspect contract-bound workflow-state issue comments.',
  args: {
    action: tool.schema.string(), issueUrl: tool.schema.string(), artifactKind: tool.schema.string().optional(),
    artifact: tool.schema.any().optional(), digest: tool.schema.string().optional(), priorDigest: tool.schema.string().optional(),
  },
  /** Execute one workflow-state action and preserve its structured result. */
  async execute(input, context) {
    /** Project context supplies immutable repository and trusted-author authority. */
    const project = await loadProjectContext(context?.directory);
    if (project.status !== 'valid') return JSON.stringify({ action: input.action, status: 'rejected', errors: project.diagnostics });
    /** The inline adapter pins comment reads and writes to the validated project root. */
    return JSON.stringify(await executeWorkflowState({ ...input, repository: project.config.repository, trustedActors: project.config.trustedActors }, (argv) => run(argv, project.root)));
  },
});
