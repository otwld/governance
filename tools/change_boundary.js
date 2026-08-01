import { tool } from '@opencode-ai/plugin';
import { executeChangeBoundary } from '../lib/change-boundary.mjs';
import { loadProjectContext } from '../lib/project-context.mjs';

/** Execute fixed Git argv in the validated project directory without a shell. */
async function run(argv, cwd) {
  /** The child and concurrent stream reads preserve complete Git evidence without shell interpretation. */
  const child = Bun.spawn(argv, { cwd, stdout: 'pipe', stderr: 'pipe' });
  const [exitCode, stdout, stderr] = await Promise.all([child.exited, new Response(child.stdout).text(), new Response(child.stderr).text()]);
  return { argv, exitCode, stdout: stdout.trim(), stderr: stderr.trim() };
}

/** Expose staged-tree inspection without accepting caller-controlled cwd or argv. */
export default tool({
  description: 'Inspect an exact staged Git tree after rejecting unstaged and untracked content.',
  args: { action: tool.schema.string(), base: tool.schema.string() },
  /** Fail closed unless OpenCode supplies a directory containing valid project authority. */
  async execute(input, context) {
    /** Project context prevents callers from selecting the repository whose index is inspected. */
    const project = await loadProjectContext(context?.directory);
    if (project.status !== 'valid') return JSON.stringify({ action: input.action, status: 'rejected', diagnostics: project.diagnostics });
    /** The inline adapter fixes every Git command to the validated project root. */
    return JSON.stringify(await executeChangeBoundary(input, (argv) => run(argv, project.root)));
  },
});
