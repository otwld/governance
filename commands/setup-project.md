---
description: Sets up reviewable Node project governance through the single-task workflow.
agent: orchestrator
---

Run project setup in explicit single-task mode.

MODE: SINGLE
TASK: Set up or refresh Node project governance for the current repository.
CONTEXT: $ARGUMENTS

Load the `setup-node-project` skill before acting and follow it. Load `.opencode/project.json` when present and validate it with `governance validate-project` when available, retaining diagnostics when repairing that file is in scope. Read every valid configured document and preserve exact configured verify, install, Project status and priority, and merge settings unless repository evidence proves a value stale. Inspect repository instructions, manifests, lockfiles, workspaces, runtime and TypeScript configuration, CI, documentation, existing governance files, Git remotes, and read-only GitHub metadata before proposing edits. Ask the user a setup question only when multiple GitHub Projects still plausibly map to this repository after that inspection; for every other uncertainty, preserve existing good content or report a precise blocker.

This is an implementation workflow, not a read-only audit. After inspection, delegate the smallest reviewable file changes to `implementer`, stage and run the evidence-based validation required by the skill, and delegate a final fresh review of the staged diff to `reviewer`. Apply the normal `SINGLE` review-fix and post-commit integrity rules, including re-verification and fresh review for any hook-created or material difference, and require `VERDICT: PASS` after the last change. If `merge.automatic` is true, squash merge only after all gates pass; if it is false, do not merge and complete the one-task workflow at the green reviewed pull request ready for human merge. Do not guess GitHub Project identifiers or invent commands, tooling, or repository structure.
