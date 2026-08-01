import { changeDigest, validateChangeBoundary } from './contracts.mjs';

/** Preserve command evidence required to distinguish blocked, failed, and unknown state. */
async function invoke(spawn, argv) {
  const outcome = await spawn(argv);
  if (!outcome || typeof outcome !== 'object' || !Number.isInteger(outcome.exitCode) || typeof outcome.stdout !== 'string' || typeof outcome.stderr !== 'string') throw new Error('command returned an invalid outcome');
  return outcome;
}

/** Redact credentials from unexpected process failures. */
function safeError(error) {
  const message = (error instanceof Error ? error.message : String(error)).replace(/\b(?:gh[pousr]_[A-Za-z0-9_]{20,}|github_pat_[A-Za-z0-9_]+)\b/g, '[redacted]');
  return { name: error instanceof Error ? error.name : 'Error', message };
}

/** Inspect the exact staged tree only when no unstaged or untracked bytes can be confused with it. */
export async function executeChangeBoundary(input, spawn) {
  if (!input || typeof input !== 'object' || Array.isArray(input) || input.action !== 'stage-inspect') return { action: input?.action, status: 'rejected', diagnostics: ['action: must be stage-inspect'] };
  if (typeof input.base !== 'string' || input.base === '' || input.base.startsWith('-') || /[\r\n\0]/.test(input.base)) return { action: 'stage-inspect', status: 'rejected', diagnostics: ['base: must be a safe Git revision'] };
  /** Stage-keyed outcomes retain the evidence needed to classify every early stop. */
  const outcomes = {};
  try {
    outcomes.unstaged = await invoke(spawn, ['git', 'diff', '--quiet']);
    if (outcomes.unstaged.exitCode === 1) return { action: 'stage-inspect', status: 'blocked', stage: 'unstaged', outcomes, diagnostics: ['unstaged tracked changes prevent exact staged verification'] };
    if (outcomes.unstaged.exitCode !== 0) return { action: 'stage-inspect', status: 'failed', stage: 'unstaged', outcomes };
    outcomes.untracked = await invoke(spawn, ['git', 'ls-files', '--others', '--exclude-standard']);
    if (outcomes.untracked.exitCode !== 0) return { action: 'stage-inspect', status: 'failed', stage: 'untracked', outcomes };
    if (outcomes.untracked.stdout.trim() !== '') return { action: 'stage-inspect', status: 'blocked', stage: 'untracked', outcomes, diagnostics: ['untracked files prevent exact staged verification; stage intended files first'] };
    outcomes.staged = await invoke(spawn, ['git', 'diff', '--cached', '--quiet']);
    if (outcomes.staged.exitCode === 0) return { action: 'stage-inspect', status: 'blocked', stage: 'staged', outcomes, diagnostics: ['no staged change exists for verification'] };
    if (outcomes.staged.exitCode !== 1) return { action: 'stage-inspect', status: 'failed', stage: 'staged', outcomes };
    outcomes.base = await invoke(spawn, ['git', 'rev-parse', `${input.base}^{commit}`]);
    if (outcomes.base.exitCode !== 0) return { action: 'stage-inspect', status: 'failed', stage: 'base', outcomes };
    outcomes.staged = await invoke(spawn, ['git', 'diff', '--cached', '--quiet', outcomes.base.stdout.trim(), '--']);
    if (outcomes.staged.exitCode === 0) return { action: 'stage-inspect', status: 'blocked', stage: 'empty-stage', outcomes, diagnostics: ['staged change is empty'] };
    if (outcomes.staged.exitCode !== 1) return { action: 'stage-inspect', status: 'failed', stage: 'staged-diff', outcomes };
    outcomes.tree = await invoke(spawn, ['git', 'write-tree']);
    if (outcomes.tree.exitCode !== 0) return { action: 'stage-inspect', status: 'failed', stage: 'tree', outcomes };
  } catch (error) {
    return { action: 'stage-inspect', status: 'unknown', outcomes, error: safeError(error), next: 'Inspect Git index and worktree state before retrying.' };
  }
  /** The immutable boundary uses Git-resolved values rather than caller-provided hashes. */
  const boundary = { baseCommit: outcomes.base.stdout.trim(), treeOid: outcomes.tree.stdout.trim() };
  const diagnostics = validateChangeBoundary(boundary);
  return diagnostics.length ? { action: 'stage-inspect', status: 'failed', stage: 'validate', outcomes, diagnostics } : { action: 'stage-inspect', status: 'succeeded', boundary, digest: changeDigest(boundary), outcomes };
}
