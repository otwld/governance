---
name: nx-impact-analysis
description: Use ONLY in an existing workspace with Nx installed when affected projects or targets must be derived from the real graph, comparison range, plugins, inputs, and executors; do not guess monorepo impact.
license: MIT
compatibility: OpenCode with an installed Nx workspace
---

# Analyze Nx Impact

## Preconditions and comparison semantics

Confirm this is an Nx workspace and use its installed Nx through the repository's
package manager or documented command. Do not download another Nx. Record workspace
root, lockfile/manager, Nx configuration, and exact installed invocation.

Define the change universe explicitly:

- **base/head:** committed comparison where base is the merge base or supplied commit
  and head is the supplied/current commit;
- **working tree:** committed range plus relevant staged, unstaged, and untracked
  files, stated separately because Nx command semantics may not include all of them;
- **tree-only:** local paths mapped against the graph without pretending a Git range.

Never silently replace a supplied base/head. Verify commits exist and record the merge
base. In shallow/unavailable history, report the blocker rather than choosing `HEAD~1`.

## Discover the actual Nx model

Inspect `nx.json`, package/workspace manifests, project configuration, inferred and
explicit targets, plugin registrations, named inputs, target defaults, generators,
and custom executors. Query the installed project graph and project/target metadata.
Trace source files to owning projects and dependencies through graph edges; include
implicit/global inputs and plugin-inferred ownership. Generated config and lockfile
changes may fan out according to named inputs and plugin rules.

Do not infer target names from convention. For each selected target confirm it exists,
its executor/command, inputs, dependency targets, configuration, and outputs/cache
behavior. Cache hits are acceptable evidence only when Nx reports a valid successful
execution/replay for the exact inputs; do not confuse "nothing ran" with cached work.

## Select and execute impact

Start with the smallest graph-derived projects and targets that exercise the changed
surface. Shared library changes include graph consumers required by repository policy;
public types may require producer plus representative/affected consumer typechecks.
Plugin, executor, or named-input changes can invalidate wider targets and must be
explained from configuration evidence.

Example analysis (commands are illustrative; use only commands supported here):

```text
Range: merge-base abc123..def456 plus unstaged libs/config/src/index.ts
Owners: config
Graph consumers: app-a, app-b
Targets found: config:test, config:lint, app-a:build, app-b:build
Selection: config:test and affected build because the public export feeds both apps
```

Run focused targets first, then configured final verification verbatim. Capture exact
command/cwd, projects/targets selected, task count, cache status, exits, and skips.
Zero tasks, no affected projects, target absent, graph construction failure, daemon/
plugin crash, and executor unavailable are non-evidence even with exit zero.

## Failures and output

Separate graph failure, selection/config error, executor/tool failure, and test/build
failure. Preserve diagnostics. Do not disable plugins, bypass dependencies, clear
caches destructively, or broaden to all projects merely to avoid understanding the
graph. If a clean cache comparison is required, use only repository-approved safe
means and state it.

Return base/head/merge-base and local-tree semantics; installed Nx invocation;
changed files and owners; graph edges/global inputs; selected/excluded projects and
targets with reasons; executor/plugin/input/cache observations; exact outcomes; zero-
task/skipped proof; and unresolved coverage risk.

## Anti-patterns

- Guessing affected projects from folder names alone.
- Running a target that does not exist or substituting a familiar target.
- Ignoring untracked files, lockfile/global inputs, plugins, or target dependencies.
- Calling an empty affected set a pass without proving why it is empty.
- Treating a cache hit, graph error, or skipped task as execution without evidence.
