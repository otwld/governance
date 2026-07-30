---
name: nx-impact-analysis
description: Use ONLY when determining affected Nx projects or validating impact through the repository's real Nx graph, targets, inputs, plugins, and custom executors; do not use for non-Nx workspaces, generic monorepo advice, or guessed project relationships and targets.
---

# Nx Impact Analysis

## Contract

Use the installed Nx version and the repository's computed project graph. An import
search alone is not impact analysis, and a project name does not prove a target
exists. Keep graph discovery separate from target execution and preserve exact
base/head evidence.

## 1. Confirm the Nx environment

Inspect:

- the active lockfile, root `package.json`, `packageManager`, and installed Nx
  package versions;
- `nx.json`, including `namedInputs`, `targetDefaults`, plugins, release settings,
  and affected/default-base configuration;
- workspace/project configuration in `project.json` and `package.json` files;
- CI commands that choose base/head and invoke Nx;
- plugin configuration that infers targets, plus local executor packages and their
  schemas/implementations when relevant.

Use an approved complete Nx command prefix established by the repository: `nx`,
`npx nx`, `pnpm nx`, `pnpm exec nx`, `yarn nx`, or `bunx nx`. Do not use a downloading
`npx nx@latest`, an arbitrary package-manager exec wrapper, or an Nx command other
than `affected`, `run-many`, `test`, `lint`, or `build` for verification. Do not
migrate Nx as part of analysis.

Run the installed version's help for uncertain syntax. Prefer machine-readable
output when that version supports it. `nx show projects` and `nx show project
<name>` expose the computed configuration, including inferred targets that a raw
`project.json` read can miss.

## 2. Define the comparison exactly

Use a user-supplied range when present. Otherwise reproduce the repository's CI
base/head strategy. Verify refs exist and compute the merge base when CI compares
against a target branch. Never assume `origin/main` or use Nx's default base
without identifying where it is configured.

Record:

```text
base input: <ref or SHA>
head input: <ref, SHA, or working tree>
resolved base SHA: <sha>
resolved head SHA: <sha, plus staged/unstaged/untracked state if included>
```

If the analysis must include local edits, confirm how the installed Nx command
treats committed, staged, unstaged, and untracked files. Supply explicit files only
when needed and supported; do not claim untracked files are represented without
evidence.

## 3. Compute projects and explain impact

First obtain all project names and computed configurations needed for the analysis.
Then ask Nx for affected projects with the verified base/head using syntax supported
by the installed version, for example:

```text
<nx-command> show projects --affected --base=<base> --head=<head>
<nx-command> show project <project> --json
```

Use an affected graph or graph JSON when the reason for propagation matters. If
writing graph output, use a disposable path and do not add generated graph files to
the repository.

For each important affected project, distinguish:

- directly touched project roots or configured input files;
- dependency propagation through the Nx project graph;
- implicit dependencies or workspace-level named inputs;
- plugin-inferred impact;
- global files that make many or all projects affected.

Compare surprising results with `namedInputs`, target inputs, plugin rules, and the
computed project graph. Do not override Nx's result with a text import search.

## 4. Select and run real targets

List the computed targets for affected projects before choosing validation. A target
can come from explicit project config, `targetDefaults`, or an inference plugin.
Check its executor, options, configurations, inputs, outputs, and dependencies.

For a custom executor, inspect the resolved executor package, schema, and
implementation. Account for side effects, required environment, output paths, and
whether it forwards arguments. Do not assume a target named `test` runs tests or a
target named `build` is safe in the current environment.

Run affected targets only when they exist and are required, for example:

```text
<nx-command> affected -t <verified-targets> --base=<base> --head=<head>
```

Do not request a comma-separated conventional target set and accept `target not
found` noise. If different projects require different targets, run explicit project
targets or compatible groups. Preserve repository-defined parallelism and caching
policy unless the task requires diagnostic overrides; report cache hits separately
from executed tasks.

## 5. Completion evidence

Return:

- installed Nx version, package manager runner, and config files inspected;
- exact base/head inputs and resolved SHAs;
- affected project list and the evidence-backed reason for each material project;
- selected target, resolved executor, and any custom-executor findings;
- exact commands, exit codes, task counts, cache status, skipped/missing targets,
  and failed projects;
- uncertainty caused by graph construction failure, missing refs, daemon errors, or
  unavailable services.

Analysis is complete only when the affected query succeeded for the intended range
and every claimed validation target is shown to exist. Target execution is complete
only when Nx reports the expected non-zero task set and all required tasks pass.

## Anti-patterns

- Treating changed folders or TypeScript imports as the authoritative graph.
- Guessing the default branch, project name, target, or executor behavior.
- Reading only `project.json` and missing plugin-inferred targets.
- Running `run-many --all` instead of answering what is affected.
- Ignoring `namedInputs` or global files when impact is unexpectedly broad.
- Calling a cache hit fresh execution or a zero-task run successful validation.
