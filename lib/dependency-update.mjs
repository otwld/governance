import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

/** Registry package names exclude option-like and shell-significant input before argv construction. */
const packagePattern = /^(?:@[a-z0-9][a-z0-9._-]*\/)?[a-z0-9][a-z0-9._-]*$/;
/** Exact SemVer syntax rejects ranges and malformed prerelease/build identifiers at the approval boundary. */
const exactSemverPattern = /^(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)(?:-(?:(?:0|[1-9]\d*|\d*[A-Za-z-][0-9A-Za-z-]*)(?:\.(?:0|[1-9]\d*|\d*[A-Za-z-][0-9A-Za-z-]*))*))?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/;
/** Root lockfile names provide the independent manager-identity oracle. */
const lockfiles = { npm: 'package-lock.json', pnpm: 'pnpm-lock.yaml', yarn: 'yarn.lock', bun: 'bun.lock' };

/** Restrict protocol values to plain records. */
function record(value) { return value !== null && typeof value === 'object' && !Array.isArray(value); }

/** Redact registry credentials from unexpected failures. */
function safeError(error) {
  const message = (error instanceof Error ? error.message : String(error)).replace(/\b(?:npm_[A-Za-z0-9]+|gh[pousr]_[A-Za-z0-9_]{20,}|github_pat_[A-Za-z0-9_]+)\b/g, '[redacted]');
  return { name: error instanceof Error ? error.name : 'Error', message };
}

/** Build metadata-only argv through Corepack so the declared manager pin controls execution. */
export function dependencyUpdateArgv({ manager, package: packageName, target, dev }) {
  /** The package spec is assembled only from a validated name and exact target. */
  const spec = `${packageName}@${target}`;
  if (manager === 'npm') return ['npm', 'install', spec, '--save-exact', '--package-lock-only', '--ignore-scripts', ...(dev ? ['--save-dev'] : [])];
  if (manager === 'pnpm') return ['corepack', 'pnpm', 'add', spec, '--save-exact', '--lockfile-only', '--ignore-scripts', ...(dev ? ['--save-dev'] : [])];
  if (manager === 'yarn') return ['corepack', 'yarn', 'add', spec, '--exact', '--mode=update-lockfile', ...(dev ? ['--dev'] : [])];
  return undefined;
}

/** Detect exactly one package-manager lockfile at the validated project root. */
async function discoverLockfile(root) {
  /** Discovery retains every root match so ambiguous manager authority fails closed. */
  const found = [];
  for (const [manager, name] of Object.entries(lockfiles)) try { await readFile(join(root, name)); found.push({ manager, name }); } catch {}
  return found;
}

/** Distinguish dependency paths from an unrelated exact scoped package with the same basename. */
function pathSelectorTargetsPackage(selector, packageName) {
  const suffix = `/${packageName}`;
  if (!selector.endsWith(suffix)) return false;
  const prefix = selector.slice(0, -suffix.length);
  return prefix !== '' && !(packageName[0] !== '@' && /^@[^/]+$/.test(prefix));
}

/** Match manager selector forms that can redirect the requested package. */
function selectorTargetsPackage(selector, packageName) {
  return selector === packageName || selector.startsWith(`${packageName}@`) || pathSelectorTargetsPackage(selector, packageName) || selector.endsWith(`>${packageName}`);
}

/** Recursively inspect only manager override maps for selectors targeting the package. */
function overrideMapTargetsPackage(value, packageName, seen = new WeakSet()) {
  if (!record(value) || seen.has(value)) return false;
  seen.add(value);
  for (const [selector, nested] of Object.entries(value)) {
    if (selectorTargetsPackage(selector, packageName) || overrideMapTargetsPackage(nested, packageName, seen)) return true;
  }
  return false;
}

/** Reject npm, Yarn, or pnpm override ownership without penalizing unrelated selectors. */
function hasOverride(manifest, packageName) {
  return overrideMapTargetsPackage(manifest.overrides, packageName) || overrideMapTargetsPackage(manifest.resolutions, packageName) || overrideMapTargetsPackage(manifest.pnpm?.overrides, packageName);
}

/** Update one root direct dependency while preserving manager pin and dependency class. */
export async function executeDependencyUpdate(input, spawn) {
  if (!record(input)) return { action: undefined, status: 'rejected', diagnostics: ['input: must be an object'] };
  /** Diagnostics accumulate every pre-mutation contract failure before subprocess execution. */
  const diagnostics = [];
  if (input.action !== 'update') diagnostics.push('action: must be update');
  if (!['npm', 'pnpm', 'yarn'].includes(input.manager)) diagnostics.push('manager: must be npm, pnpm, or yarn');
  if (typeof input.package !== 'string' || input.package.length > 214 || !packagePattern.test(input.package)) diagnostics.push('package: must be a registry-safe package name');
  if (typeof input.target !== 'string' || !exactSemverPattern.test(input.target)) diagnostics.push('target: must be an exact semantic version');
  if (typeof input.dev !== 'boolean') diagnostics.push('dev: must be a boolean');
  if (typeof input.root !== 'string') diagnostics.push('project context: required');
  if (input.packageDirectory !== '.') diagnostics.push('packageDirectory: only the project root "." is currently supported');
  if (diagnostics.length) return { action: input.action, status: 'rejected', diagnostics };
  /** The root manifest is the source of dependency ownership and the exact manager pin. */
  let manifest;
  try { manifest = JSON.parse(await readFile(join(input.root, 'package.json'), 'utf8')); }
  catch (error) { return { action: 'update', status: 'rejected', diagnostics: [`package manifest: ${error instanceof Error ? error.message : String(error)}`] }; }
  /** Exactly one dependency-section membership preserves the existing production/dev class. */
  const dependency = Object.hasOwn(manifest.dependencies ?? {}, input.package);
  const devDependency = Object.hasOwn(manifest.devDependencies ?? {}, input.package);
  if (dependency === devDependency) diagnostics.push('package: must be declared directly in exactly one dependencies section');
  else if (input.dev !== devDependency) diagnostics.push('dev: must preserve the existing dependency class');
  /** Existing shorthand, alias, path, protocol, URL, and Git declarations are outside exact registry updates. */
  const declaration = manifest.dependencies?.[input.package] ?? manifest.devDependencies?.[input.package];
  if (typeof declaration !== 'string' || /[:/\\@]/.test(declaration) || declaration.startsWith('.') || !/(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)/.test(declaration)) diagnostics.push('package: aliases, protocols, paths, URLs, Git references, and shorthand declarations are unsupported');
  if (Object.hasOwn(manifest.peerDependencies ?? {}, input.package) || Object.hasOwn(manifest.optionalDependencies ?? {}, input.package) || hasOverride(manifest, input.package)) diagnostics.push('package: peer, optional, and override-managed dependencies are unsupported');
  /** Lockfile evidence must identify exactly one supported manager at the project root. */
  const discovered = await discoverLockfile(input.root);
  if (discovered.length !== 1) diagnostics.push('lockfile: exactly one root lockfile is required');
  const lockfile = discovered[0];
  if (lockfile?.manager === 'bun') diagnostics.push('manager: Bun metadata-only updates are unsupported');
  if (lockfile && lockfile.manager !== input.manager) diagnostics.push('manager: must match the root lockfile');
  /** The packageManager declaration separates manager identity from its exact SemVer pin. */
  const managerMatch = typeof manifest.packageManager === 'string' ? /^(npm|pnpm|yarn)@(.+)$/.exec(manifest.packageManager) : undefined;
  if (!managerMatch || managerMatch[1] !== input.manager || !exactSemverPattern.test(managerMatch[2])) diagnostics.push('packageManager: exact matching manager and SemVer version are required');
  else if (input.manager === 'yarn' && Number(managerMatch[2].split('.')[0]) < 2) diagnostics.push('packageManager: Yarn Berry major 2 or later is required');
  if (diagnostics.length) return { action: 'update', status: 'rejected', diagnostics };
  /** Committed lockfile evidence is required before any manager preflight or metadata write. */
  let tracked;
  try { tracked = await spawn(['git', 'ls-files', '--error-unmatch', '--', lockfile.name], { cwd: input.root }); }
  catch (error) { return { action: 'update', status: 'unknown', error: safeError(error) }; }
  if (!record(tracked) || tracked.exitCode !== 0) return { action: 'update', status: 'rejected', diagnostics: ['lockfile: root lockfile must be committed'], outcome: tracked };
  /** Descriptor evidence retains integrity metadata while executable version comparison omits its SemVer build suffix. */
  const descriptorVersion = managerMatch[2];
  /** Corepack integrity hashes are transport metadata; ordinary SemVer build metadata remains executable identity. */
  const pinnedVersion = descriptorVersion.replace(/\+sha(?:224|256|384|512)\.[a-fA-F0-9]+$/, '');
  const versionArgv = input.manager === 'npm' ? ['npm', '--version'] : ['corepack', input.manager, '--version'];
  let versionOutcome;
  try { versionOutcome = await spawn(versionArgv, { cwd: input.root }); }
  catch (error) { return { action: 'update', status: 'unknown', error: safeError(error) }; }
  if (!record(versionOutcome) || versionOutcome.exitCode !== 0 || typeof versionOutcome.stdout !== 'string') return { action: 'update', status: 'rejected', diagnostics: ['package manager version preflight failed'], versionOutcome };
  if (versionOutcome.stdout.trim() !== pinnedVersion) return { action: 'update', status: 'rejected', diagnostics: ['package manager version does not match packageManager pin'], versionOutcome };
  /** Only the fixed metadata-only update argv may run after version preflight succeeds. */
  const argv = dependencyUpdateArgv(input);
  let outcome;
  try {
    outcome = await spawn(argv, { cwd: input.root });
    if (!record(outcome) || !Number.isInteger(outcome.exitCode) || typeof outcome.stdout !== 'string' || typeof outcome.stderr !== 'string') throw new Error('command returned an invalid outcome');
  } catch (error) { return { action: 'update', status: 'unknown', error: safeError(error), next: 'Inspect manifest and lockfile before retrying.' }; }
  /** Returned evidence preserves the pin, preflight argv, expected version, and observed outcome together. */
  const versionEvidence = { packageManager: manifest.packageManager, descriptorVersion, argv: versionArgv, version: pinnedVersion, outcome: versionOutcome };
  return outcome.exitCode === 0 ? { action: 'update', status: 'succeeded', argv, outcome, packageDirectory: '.', lockfile: lockfile.name, packageManager: manifest.packageManager, versionEvidence, next: 'Verify manifest diff, lockfile diff, and resolved version.' } : { action: 'update', status: 'failed', argv, outcome, versionEvidence };
}
