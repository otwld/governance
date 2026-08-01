---
name: dependency-upgrade
description: Use ONLY when updating one already-declared direct dependency or devDependency to an exact version through dependency_update in a pinned npm, pnpm, or Yarn Berry package; block unsupported ownership and tooling.
license: MIT
compatibility: OpenCode with dependency_update and repository install/test access
---

# Upgrade a Dependency

## Establish the supported boundary

Require valid `.opencode/project.json` and read every configured document; if missing
or invalid, stop and route to `setup-node-project`. The temporary supported mutation
boundary is only the lockfile-owning repository root: require `packageDirectory: "."`,
root `package.json`, and the root committed lockfile. Prove the package is already
declared in that root manifest's `dependencies` or `devDependencies`; record which one.
Require an exact root `packageManager` pin.

`dependency_update` supports only:

- an already-declared direct `dependencies` entry (`dev: false`), or
- an already-declared direct `devDependencies` entry (`dev: true`),
- owned by `packageDirectory: "."`, which also owns the one committed lockfile,
- using an exactly pinned npm, pnpm, or Yarn Berry `packageManager` with the manager-
  specific preflight below,
- changed to one exact semantic version.

Return `BLOCKED` before mutation for a transitive, peer, optional, override/resolution,
catalog/protocol-managed, undeclared, or ambiguously owned package; any workspace
package direct dependency; Bun; Yarn Classic; an unpinned/unsupported manager; any
`packageDirectory` other than `.`; ranges/tags; or multiple packages. State that the
issue must choose a supported root direct owner or supported tooling. This is an
explicit temporary support boundary, not a compatibility fallback. Never move a
workspace declaration to root, replace a workspace protocol, or convert unsupported
ownership into a direct declaration/override merely to satisfy the tool.

## Researcher evidence gate

Require a researcher handoff citing official release notes/changelog, registry
metadata, support matrix, upgrade guide, upstream advisory, and security advisory/CVE
when relevant. Preserve URLs, publication dates, affected/fixed ranges, and conclusions.
The handoff must cover runtime/Node/TypeScript/framework compatibility, peers, module/
exports/types, platform requirements, behavior/config changes, security reachability,
and residual copies. Conflicting or missing primary evidence is `BLOCKED`.

Research evidence can show that the requested owner/tooling is unsupported; it cannot
authorize bypassing the mutation boundary.

## Exact mutation through `dependency_update`

Call `dependency_update` once with `action: "update"`, manager matching the pinned
root `packageManager`, package name, exact target, boolean `dev`, and
`packageDirectory: "."`. Require `succeeded` with fixed preflight and mutation
argv/outcomes. The tool must verify root declaration class, package-manager pin, and
root lockfile ownership before writing metadata and must not run package scripts.

Execution is manager-specific:

- **npm:** run the directly installed `npm --version`; it must exactly equal the
  executable comparison version derived from `packageManager`. Only then may the tool
  invoke that installed npm for the metadata-only update. Corepack is not the npm
  execution path.
- **pnpm:** run `corepack pnpm --version`; it must exactly equal the executable
  comparison version, then perform the metadata-only update through `corepack pnpm`.
- **Yarn Berry:** run `corepack yarn --version`; it must exactly equal the pinned
  executable comparison version and be Berry, then update through `corepack yarn`.

Validate and preserve the complete exact `packageManager` descriptor. For executable
comparison only, omit a terminal Corepack integrity suffix of the form
`+sha224.<hex>`, `+sha256.<hex>`, `+sha384.<hex>`, or `+sha512.<hex>`. Keep any
prerelease in the comparison. Ordinary SemVer build metadata is not an integrity hash:
retain it in the expected executable version, so a manager reporting only the plain
version fails the preflight. Report both the full descriptor and derived comparison
version.

For pnpm/Yarn, unavailable Corepack is `BLOCKED`. For every manager, a failed version
preflight or any version mismatch is `BLOCKED` before mutation. Do not fall back to a
globally installed pnpm/Yarn, a different manager, or an unpinned executable.

Do not run direct package-manager add/update commands, hand-edit/delete the lockfile,
change package class, create a declaration, add an override, or retry an `unknown`
outcome before inspecting manifest and lockfile state. After success, inspect the diff
for exact owner/class/target, unrelated fan-out, scripts/native artifacts, integrity,
peer contexts, and residual affected resolutions.

## Install, test, and verify

Run configured `commands.install` verbatim when installation is required; do not infer
another command. Prove the requested resolution and peer graph. Run focused owner and
consumer tests first, typecheck/build for type/export changes, and add regression
coverage for corrected behavior when feasible. Then run `verify-change` and configured
final verification verbatim.

On tool/install/peer/build/test failure, preserve output and classify target
incompatibility, ownership/tooling rejection, lockfile failure, introduced behavior,
baseline, or indeterminate. Do not use force flags, peer bypasses, ignored scripts,
blanket overrides, skipped tests, or weakened types.

## Output contract

Report root manifest and `packageDirectory: "."`; full pinned `packageManager`
descriptor; derived executable comparison version; exact npm or Corepack
version-preflight evidence as applicable; declaration class;
researcher handoff/primary URLs; before/after requested and resolved versions; exact
`dependency_update` request, argv, status, and diff; configured install and focused/
final command outcomes; security reachability/residual copies; coherent rollback; and
unresolved risk or supported-owner/tooling decision.

## Worked outcomes

**Success:** root `package.json` already declares `example-lib` under `dependencies`,
pins `pnpm@<exact version>`, and owns the root `pnpm-lock.yaml`. Research supports
exact `3.4.2`. Call `dependency_update` with package directory `.`, manager `pnpm`,
package `example-lib`, target `3.4.2`, and `dev: false`. Accept only a successful
`corepack pnpm --version` equality check followed by a Corepack-mediated root
declaration/lockfile diff, then install, inspect resolution,
run owner/consumer checks, and run final verification.

**Blocked ownership:** The vulnerable package is only transitive. Do not add it as a
direct dependency or override and do not invoke the tool. Report the parent chain,
reachability, fixed upstream choices, and that the issue must select a supported direct
owner or different supported remediation tooling.

**Blocked tooling:** The owning package uses Bun, Yarn Classic, or lacks a pinned
manager. Do not substitute npm/pnpm/Yarn Berry. Report the evidence and require the
issue to choose supported tooling before mutation.

**Blocked preflight:** `corepack pnpm --version`, `corepack yarn --version`, or direct
`npm --version` is unavailable, fails, or differs from the exact pin. Do not invoke the
mutation command. Report expected/observed versions and require tooling restoration.

**Blocked workspace owner:** `packages/api/package.json` directly declares the package
under a workspace protocol or ordinary range. Do not pass `packages/api`, move the
declaration to root, or rewrite the protocol. Report that current tool support is root-
only and require the issue to select supported owner/tooling.

## Anti-patterns

- Calling the tool for undeclared, transitive, peer, optional, override, or catalog-
  only ownership.
- Treating Bun, Yarn Classic, or an inferred manager as supported.
- Passing any `packageDirectory` except `.` or updating a workspace declaration.
- Using Corepack for npm, or bypassing Corepack for pnpm/Yarn Berry.
- Mutating after unavailable/failed/mismatched manager-version preflight.
- Bypassing `dependency_update` with direct package-manager mutation.
- Claiming remediation while a reachable affected resolution remains.
