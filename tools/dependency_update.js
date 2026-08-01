import { tool } from '@opencode-ai/plugin';
import { executeDependencyUpdate } from '../lib/dependency-update.mjs';
import { loadProjectContext } from '../lib/project-context.mjs';

/** Redact registry and GitHub credentials from package-manager diagnostics. */
function redact(value) {
  return value.trim()
    .replace(/(authorization:\s*(?:bearer|token)\s+)\S+/gi, '$1[redacted]')
    .replace(/\b(?:npm_[A-Za-z0-9]+|gh[pousr]_[A-Za-z0-9_]{20,}|github_pat_[A-Za-z0-9_]+)\b/g, '[redacted]');
}

/** Run a package manager in the trusted project directory without a shell. */
async function run(argv, cwd) {
  /** Concurrent stream consumption prevents package-manager output from deadlocking completion. */
  const child = Bun.spawn(argv, { cwd, stdout: 'pipe', stderr: 'pipe' });
  const [exitCode, stdout, stderr] = await Promise.all([child.exited, new Response(child.stdout).text(), new Response(child.stderr).text()]);
  return { argv, exitCode, stdout: stdout.trim(), stderr: redact(stderr) };
}

/** Expose one narrowly scoped dependency mutation with no arbitrary command surface. */
export default tool({
  description: 'Update one dependency to an exact version without running package scripts.',
  args: {
    action: tool.schema.string(), manager: tool.schema.string(), package: tool.schema.string(), target: tool.schema.string(), dev: tool.schema.boolean(), packageDirectory: tool.schema.string(),
  },
  /** Bind package-manager writes to the execution context, never caller-supplied cwd. */
  async execute(input, context) {
    /** Project context is the authority boundary for package and lockfile writes. */
    const project = await loadProjectContext(context?.directory);
    if (project.status !== 'valid') return JSON.stringify({ action: input.action, status: 'rejected', diagnostics: project.diagnostics });
    /** The inline adapter permits only executor-selected package directories beneath the trusted root. */
    return JSON.stringify(await executeDependencyUpdate({ ...input, root: project.root }, (argv, options) => run(argv, options?.cwd ?? project.root)));
  },
});
