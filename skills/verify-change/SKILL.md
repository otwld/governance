---
name: verify-change
description: Use when a TypeScript or Node change must be validated with focused checks followed by repository-required final checks and exact execution evidence; do not use for speculative test planning, code review without execution, or inventing commands absent from the repository.
---

# Verify a Change

## Contract

Verification is evidence, not a list of commands that might work. Determine the
actual change and repository contract, run the narrowest checks that can fail for
that change, then run the required final checks. Never report a pass for a command
that was skipped, interrupted, ambiguous, or not executed.

## 1. Establish the verification boundary

Read applicable instructions and inspect the working tree, including staged,
unstaged, and untracked files. If a commit or PR range was supplied, verify the
range and include its diff; do not silently substitute the working tree.

Classify each changed surface:

- source module and its direct tests;
- public types, generated declarations, or package exports;
- package manifest, lockfile, runtime/TypeScript version, or build config;
- database/API/schema contract;
- workspace graph or shared library consumers;
- docs/configuration-only files.

Discover commands from root and package manifests, active lockfile, workspace
configuration, CI workflows, and contributor docs. Preserve the repository's
package manager. Prefer its pinned version through Corepack or the documented
runner; never use `npx` in a way that can download an undeclared tool.

## 2. Select focused checks

Map the changed behavior to checks that execute it. Examples are patterns, not
commands to invent:

- Run a test file with the repository's existing test runner and supported file or
  name filter.
- Run the owning workspace project's `test`, `lint`, `typecheck`, or `build` target
  only if that target exists.
- For shared types or exports, typecheck/build the producer and an actual consumer
  proven by imports or the workspace graph.
- For config or templates, run their parser/schema validator and a focused test that
  loads them.
- For a bug fix, execute the regression test in a way whose output proves the test
  case ran.

Do not use a broad command first to avoid understanding ownership. If no focused
check exists, run the smallest documented parent check and state why it is the
minimum available.

For each command capture the command exactly as executed, working directory, exit
code, and runner summary. Confirm that expected test files/cases were discovered.
Treat `0 tests`, `no projects matched`, `target not found`, all-skipped suites, and
watch mode as non-evidence even if the process exits zero.

## 3. Run final repository checks

After focused checks pass, run the final checks required by repository instructions
and CI for the changed scope. Use an existing aggregate script such as `check` only
when its definition is inspected. Otherwise run the documented checks separately so
failures remain attributable.

Typical categories are formatting, lint, typecheck, unit/integration tests, build,
and repository-specific validators. Run only categories actually defined or
required. A docs-only exception must come from repository policy, not convenience.

If a final check is too expensive, unavailable, requires credentials/services, or
is unsafe in the environment, do not replace it with a weaker command and call the
result complete. Report the exact unrun command, reason, and what evidence remains.

When a check fails:

1. Preserve the command and relevant failure output.
2. Decide whether the failure is introduced by the change, pre-existing, or
   indeterminate using the diff and a reproducible comparison when safe.
3. Fix only in-scope introduced failures, then rerun the failed focused check and
   any final aggregate invalidated by the edit.
4. Never suppress diagnostics, weaken assertions, update snapshots blindly, add
   retries, or exclude files merely to obtain green output.

## 4. Completion report

Report evidence in execution order:

```text
Focused:
- <cwd>: <exact command> -> exit <code>; <files/cases/targets run>
Final:
- <cwd>: <exact command> -> exit <code>; <runner summary>
Not run:
- <exact command> -> <specific blocker and remaining risk>
```

Also state the verified diff/range, package manager, required checks source (for
example a script or CI path), whether any tests were skipped, and final pass,
partial, or fail status. A pass requires all required checks to have executed and
passed with non-empty coverage of the intended targets.

## Anti-patterns

- Guessing `npm test` without reading `package.json` or using npm in a pnpm repo.
- Running only a new test while omitting the repository's required final check.
- Reporting an exit code without proving the intended test or target executed.
- Calling unrelated baseline failures pre-existing without comparison evidence.
- Hiding a failed broad check behind narrower green checks.
- Reporting command suggestions as if they were execution results.
