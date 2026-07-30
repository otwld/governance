---
description: Runs the orchestrator in multi-task GitHub Project backlog mode.
agent: orchestrator
---

Run in explicit multi-task sequential backlog mode.

MODE: BACKLOG
PROJECT CONTEXT: $ARGUMENTS

Load `.opencode/project.json`, validate it with `governance validate-project` when available, and require a valid `githubProject` mapping, usable configured priority field, and `merge.automatic: true`; false is a blocker in `BACKLOG`. Read every configured document and use the exact verify, install, Project status and priority, and merge settings. Before selecting ready work, reconcile items in both the configured active and review statuses and resume the single unambiguous in-flight item. Process ready issues one at a time by the configured Priority field and Project item order, moving each item to the configured review status when review or pull request work begins. Complete implementation, staged local verification, a final fresh review after the final change, up to 3 review-fix cycles, pull request, and up to 2 CI repair cycles before selecting another issue. The required true automatic setting permits a squash merge only after all review, verification, post-commit integrity, required CI, and mergeability gates pass. After each commit, compare the committed diff and tree with the reviewed and verified staged diff; any hook-created or material difference requires re-verification and a fresh review before an exact allowed push. Continue after each successful squash merge until no ready work remains. Stop immediately and report if Project configuration, identity, ordering, readiness, active or review state, permissions, acceptance criteria, tests, CI, or merge safety is blocked or ambiguous.
