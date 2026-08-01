import { tool } from '@opencode-ai/plugin';
import { executeGovernanceCheck } from '../lib/governance-check.mjs';
import { loadProjectContext } from '../lib/project-context.mjs';

/** Redact process diagnostics before they enter durable agent output. */
function redact(value) {
  return value.trim()
    .replace(/(authorization:\s*(?:bearer|token)\s+)\S+/gi, '$1[redacted]')
    .replace(/\b(?:gh[pousr]_[A-Za-z0-9_]{20,}|github_pat_[A-Za-z0-9_]+)\b/g, '[redacted]');
}

/** Execute a fixed argv in the OpenCode project directory without invoking a shell. */
async function run(argv, cwd) {
  /** Concurrent stream consumption preserves complete read-only command evidence. */
  const child = Bun.spawn(argv, { cwd, stdout: 'pipe', stderr: 'pipe' });
  const [exitCode, stdout, stderr] = await Promise.all([child.exited, new Response(child.stdout).text(), new Response(child.stderr).text()]);
  return { argv, exitCode, stdout: stdout.trim(), stderr: redact(stderr) };
}

/** Expose read-only governance checks while keeping process execution inside trusted cwd. */
export default tool({
  description: 'Read-only contract, approved-issue, change, and authoritative queue checks.',
  args: {
    action: tool.schema.string(), kind: tool.schema.string().optional(), value: tool.schema.any().optional(), context: tool.schema.any().optional(),
    issueUrl: tool.schema.string().optional(), baseCommit: tool.schema.string().optional(), treeOid: tool.schema.string().optional(), committedTreeOid: tool.schema.string().optional(),
  },
  /** Bind Git reads to the trusted execution context rather than caller-controlled cwd. */
  async execute(input, context) {
    /** Project context is the sole source of repository, actor, and queue authority. */
    const project = await loadProjectContext(context?.directory);
    if (project.status !== 'valid') return JSON.stringify({ action: input.action, status: 'rejected', diagnostics: project.diagnostics });
    /** Enrichment overwrites any undeclared caller trust context before validation. */
    const enriched = { ...input, repository: project.config.repository, trustedActors: project.config.trustedActors, project: project.config };
    /** The inline adapter binds all GitHub reads to the validated execution root. */
    return JSON.stringify(await executeGovernanceCheck(enriched, (argv) => run(argv, project.root)));
  },
});
