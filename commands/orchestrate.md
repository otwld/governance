---
description: Runs the orchestrator in explicit single-task mode.
agent: orchestrator
---

Run in explicit single-task mode.

MODE: SINGLE
TASK: $ARGUMENTS

Handle exactly this one task through implementation, local verification, a final fresh review after the final change, up to 3 review-fix cycles, pull request, and up to 2 CI repair cycles. Before coding, load `.opencode/project.json` when present, validate it with `governance validate-project` when available, read every configured document, and use its exact verify, install, Project status and priority, and merge settings. Honor `merge.automatic`: when it is true, squash merge only after all review, verification, post-commit integrity, required CI, and mergeability gates pass; when it is false, do not merge and stop at the green reviewed pull request ready for human merge. Stage the final change before final verification and review. After each commit, compare the committed diff and tree with the reviewed and verified staged diff; any hook-created or material difference requires re-verification and a fresh review before an exact allowed push. Do not inspect the backlog for another task and stop after this task. If TASK is empty, ambiguous, or contains multiple independent tasks, stop and request exactly one task rather than choosing or splitting it.
