---
name: verify-change
description: Use ONLY when producing structured execution evidence for an exact orchestrator-created change_boundary digest with focused checks and the repository's required final command; do not use for speculative test planning or code review.
license: MIT
compatibility: OpenCode with repository shell access
---

# Verify Change

Verification proves that exact commands exercised an exact tree. It is not a command
recommendation and it expires whenever the reviewed bytes change.

## 1. Bind the subject and tree

Require exact `issueDigest` and reviewed `planDigest`, repository root, current base,
and an exact staged `changeDigest`. Use read-only `governance_check` action `contract`
for issue and plan, public action `approved-issue` for the published issue, and the
orchestrator-only `change_boundary` result created after intended files were staged.
The exact call uses `action: "stage-inspect"` and the recorded `base`.
`change_boundary` does not stage. It requires no unstaged tracked changes and no
untracked nonignored files and returns full base/tree OIDs plus canonical digest.
Reject a digest supplied for a different boundary. Any unrelated work fails this clean
gate and blocks verification; it cannot be excluded while claiming exact-tree evidence.
Verification does not independently review or approve its own contract;
it becomes evidence context for `review-change`.

Require and validate `.opencode/project.json`; if absent or invalid, stop and route to
`setup-node-project`. Read every configured document. Discover the package manager and commands from lockfiles, manifests,
workspace configuration, CI, and instructions. Inventory changed surfaces: runtime
behavior, tests, public types/exports, packages/consumers, schemas/config, generated
files, docs, and operational behavior.

## 2. Select and run focused evidence

Map every changed behavior and acceptance scenario to the narrowest existing command
that executes it. Use the repository's runner and supported filters. For shared
interfaces, include proven consumers. For configuration/templates, use their parser
or validator. For a bug, identify the regression test by name.

Capture exact command, cwd, exit code, runner summary, and tests/targets actually
discovered. Exit zero with `0 tests`, `no projects matched`, missing targets, watch
mode, an all-skipped suite, or an expected test absent is no evidence. Record each
skip explicitly; do not call it pass.

## 3. Required final command

After focused checks pass, run `commands.verify` verbatim. Do not add flags, split,
wrap, or substitute it; the required valid project contract supplies this command. If installation is genuinely required,
use configured `commands.install` verbatim; never infer an install command.

Check the exact-tree gate before and after every command. If a check writes an
unstaged tracked change or untracked nonignored file, the prior boundary no longer
describes the verified tree: return `BLOCKED`, preserve evidence, and require the
orchestrator to reconcile/restage and create a new `change_boundary`.

On failure, preserve output and classify introduced, baseline, or indeterminate.
"Baseline" requires reproducible evidence from an unchanged comparison, not belief.
Fix only in-scope introduced failures. Any edit invalidates the digest and all prior
command evidence: return to the orchestrator to restage intended files and rerun
`change_boundary` `stage-inspect`, then rerun affected focused checks and the final
command. Unavailable services, credentials, unsafe commands, or skipped required
checks produce `BLOCKED`, not a weaker substitute.

## 4. Structured output

Return a contract valid against `schemas/verification.schema.json`. `PASS` requires
every command exit zero, non-empty intended target execution, no skipped evidence,
and no `unavailable`. `FAIL` requires a nonzero command. `BLOCKED` requires unavailable
evidence or a skipped required check. Validate and digest the complete verification
contract through read-only `governance_check` action `contract`, kind `verification`,
before handoff. See
[the redesigned example](references/verification-example.md).

Also report the digest boundary, package manager, discovery sources, required-check
source, base/tree OIDs from `change_boundary`, baseline comparison (if any), and
whether later staging or edits invalidated prior runs.

## Anti-patterns

- Running the broad suite first to avoid ownership discovery.
- Reporting an exit code without proving the intended test or target ran.
- Replacing `commands.verify`, adding update/watch/fix flags, or downloading a runner.
- Calling unrelated known failures baseline without comparison evidence.
- Reusing evidence after any material edit, dirty clean-gate result, or boundary change.
- Treating verification as an independently reviewable subject rather than evidence
  bound into the change review context.
- Hiding a required failure behind narrower green commands.
