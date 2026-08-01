import { readFile, realpath, stat } from 'node:fs/promises';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { validateProjectConfig } from './validation.mjs';

/** Return whether a filesystem marker exists without following directory policy upward. */
async function exists(path) {
  try { await stat(path); return true; } catch { return false; }
}

/** Load the nearest in-worktree project authority from a required execution directory. */
export async function loadProjectContext(directory) {
  if (typeof directory !== 'string' || directory.trim() === '') return { status: 'rejected', diagnostics: ['execution context.directory: required'] };
  /** Canonicalizing the supplied directory prevents lexical aliases from changing the ancestor search. */
  let start;
  try { start = await realpath(resolve(directory)); } catch { return { status: 'rejected', diagnostics: ['execution context.directory: does not exist'] }; }
  /** The first ancestor carrying Git metadata is the sole authority root for this invocation. */
  let worktree;
  for (let current = start; ; current = dirname(current)) {
    if (await exists(join(current, '.git'))) { worktree = current; break; }
    if (dirname(current) === current) break;
  }
  if (!worktree) return { status: 'rejected', diagnostics: ['project context: no containing Git worktree'] };
  /** Authority is rooted once per worktree; nested files cannot shadow it. */
  const candidate = join(worktree, '.opencode', 'project.json');
  if (!(await exists(candidate))) return { status: 'rejected', diagnostics: ['project context: no worktree-root .opencode/project.json'] };
  /** The resolved configuration path must remain inside the discovered worktree despite symlinks. */
  let configPath;
  try {
    configPath = await realpath(candidate);
    /** The relative path is the containment oracle for the canonical configuration target. */
    const rel = relative(worktree, configPath);
    if (rel === '..' || rel.startsWith(`..${sep}`)) return { status: 'rejected', diagnostics: ['project context: project configuration escapes worktree'] };
  } catch { return { status: 'rejected', diagnostics: ['project context: project configuration cannot be resolved'] }; }
  /** Parsed configuration remains untrusted until closed-contract validation succeeds. */
  let config;
  try { config = JSON.parse(await readFile(configPath, 'utf8')); } catch (error) { return { status: 'rejected', diagnostics: [`project context: ${error instanceof Error ? error.message : String(error)}`] }; }
  /** Stable diagnostics are the only rejected output after syntactically valid JSON is loaded. */
  const diagnostics = validateProjectConfig(config).map(({ path, message }) => `${path}: ${message}`);
  return diagnostics.length ? { status: 'rejected', diagnostics } : { status: 'valid', root: worktree, config, configPath };
}

/** Resolve a relative path without allowing symlink or traversal escape from the worktree. */
export async function resolveProjectPath(root, path) {
  if (typeof path !== 'string' || path === '' || path.includes('\\') || (path !== '.' && path.split('/').some((part) => part === '' || part === '.' || part === '..'))) return { diagnostics: ['packageDirectory: must be a safe relative path'] };
  try {
    /** Canonical target resolution exposes symlink escapes before a package path is returned. */
    const target = await realpath(join(root, path));
    /** The canonical relative path both proves containment and becomes the returned package identity. */
    const rel = relative(root, target);
    if (rel === '..' || rel.startsWith(`..${sep}`)) return { diagnostics: ['packageDirectory: escapes project root'] };
    return { path: target, relativePath: rel };
  } catch (error) { return { diagnostics: [`packageDirectory: ${error instanceof Error ? error.message : String(error)}`] }; }
}
