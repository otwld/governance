---
name: dependency-upgrade
description: Use when upgrading, pinning, or remediating TypeScript or Node dependencies with authoritative release evidence, package-manager-consistent lockfile changes, and compatibility checks; do not use for broad modernization, unrelated refactors, or replacing libraries without an explicit dependency objective.
---

# Dependency Upgrade

## Contract

Upgrade the smallest package set required by the request. Preserve the repository's
package manager, dependency ownership, workspace conventions, and lockfile. Read
the release delta before editing code; do not turn a version bump into a framework
rewrite or opportunistic cleanup.

## 1. Establish current state and scope

Inspect the active manifest and lockfile, root `packageManager`, workspace/catalog
configuration, CI runtime, Node and TypeScript versions, module mode, and relevant
build/test scripts. Determine:

- whether the package is direct, dev, optional, peer, bundled, or transitive;
- every workspace manifest or shared catalog that owns its version;
- the exact resolved current version, requested target/range, and who depends on it;
- existing overrides, resolutions, patches, vendored types, or update policies;
- whether a lockfile conflict or mixed package-manager evidence is already present.

Use the repository's package manager and pinned version. Useful read-only ownership
commands include `npm ls <pkg>`, `pnpm why <pkg>`, `yarn why <pkg>`, or the
repository-supported Bun equivalent. A failed ownership command is evidence to
investigate, not permission to switch managers.

Do not change a transitive dependency into a direct dependency merely to force a
version. Use an override/resolution only when the task requires a transitive pin and
the repository/package manager supports that mechanism; explain why the normal
dependency solve is insufficient.

## 2. Research the exact release delta

Read authoritative sources for every version crossed:

1. official project release notes or changelog;
2. official migration guide and compatibility/support matrix;
3. published package metadata for `engines`, `peerDependencies`, exports, and
   deprecations;
4. the authoritative security advisory when remediation is the objective.

Use repository or registry pages only to confirm versions and metadata when official
notes exist elsewhere. Record source URLs, publication/version identifiers, and the
specific breaking changes, security fixes, runtime requirements, and migration
steps that apply. Do not infer compatibility from semver alone, a blog post, or a
dependency bot summary.

Check the target against the repository's actual Node version, TypeScript version,
module system, framework/plugin versions, test environment, and peer ranges. For a
coordinated package family, identify the minimum mutually compatible set from
official matrices and peer metadata. Expanding the set beyond that is out of scope.

If release notes are absent, contradictory, or inaccessible, state the uncertainty
and do not invent migration behavior.

## 3. Apply a targeted package-manager change

Choose the existing package manager's command that preserves dependency type and
workspace location. Run it from the owning workspace or use the repository's
documented workspace flag. Examples such as `npm install -D <pkg>@<version>`,
`pnpm add -D <pkg>@<version>`, or `yarn add -D <pkg>@<version>` are valid only after
the ownership and manager are verified.

- Keep an exact pin or range style consistent with the owning manifest unless the
  request explicitly changes policy.
- Update a workspace catalog at its source rather than duplicating versions in
  consumers.
- Let the package manager update its own lockfile. Do not hand-edit integrity hashes
  or regenerate a lockfile with another manager/version.
- Avoid full-install update commands that float unrelated dependencies. If the
  manager necessarily rewrites metadata, inspect every unrelated delta and revert
  it safely or report why it is unavoidable.
- Do not delete the lockfile, package-manager cache, or install state as a first
  response to resolution errors.

Apply only migration edits required by the authoritative release delta. Use an
official codemod only when it covers the selected versions, then review every
changed file and remove unrelated churn. Avoid repository-wide search/replace;
resolve imports, renamed APIs, config keys, and type changes at proven call sites.

## 4. Verify resolution and compatibility

Inspect the manifest and lockfile diff before tests. Confirm:

- requested direct ranges and resolved versions are present;
- old vulnerable/incompatible versions are absent where required, or explain each
  remaining dependency path;
- peer dependencies and engine constraints are satisfied;
- lockfile changes are limited to the target package family and necessary
  transitive solver changes;
- no workspace manifest, catalog, patch, override, or generated artifact is stale.

Run a package-manager integrity/install check appropriate to the repository, then
focused tests for migrated call sites and the package's owning project. Finish with
the repository-required lint, typecheck, test, build, and lockfile/frozen-install
checks for the affected scope. Confirm expected tests and tasks executed; zero-test
or all-skipped output is not a pass.

For a security upgrade, rerun the repository's existing audit/scanner with its
committed policy. Do not claim remediation solely because the advisory's minimum
version appears in a manifest.

## 5. Completion evidence

Report:

- package manager and version, owning manifests, old range/resolution, and new
  range/resolution;
- authoritative release/advisory URLs and applicable compatibility findings;
- manifest, lockfile, migration, override, and patch files changed;
- explanation for every package beyond the requested dependency that moved;
- exact install/integrity and validation commands, exit codes, task/test counts,
  skips, and audit result;
- unresolved peers, duplicate old versions, unavailable notes, or environment
  mismatches as risks rather than a successful upgrade.

## Anti-patterns

- Switching npm, pnpm, Yarn, or Bun because another command is familiar.
- Editing only `package.json`, or accepting broad lockfile churn without review.
- Upgrading all dependencies to latest while fixing one advisory.
- Adding overrides without tracing dependency ownership and exit conditions.
- Replacing a library or API across the repository when a compatible target exists.
- Claiming compatibility from semver or claiming security remediation from a direct
  version string without checking the resolved graph.
