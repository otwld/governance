---
description: Runs a fresh read-only review of a specified change or the current working tree.
agent: reviewer
---

Perform a fresh review using this context:

$ARGUMENTS

If no diff range is supplied, review the current working tree against its base and state that assumption. Inspect repository instructions and available validation evidence. When `.opencode/project.json` exists, load it, validate it with `governance validate-project` when available, read every configured document, and use its exact workflow settings. For a final staged or committed review, confirm it covers the final change and that any post-commit tree or diff difference from the reviewed and verified staged diff triggered re-verification. Do not modify anything. Report findings first with stable IDs and finish with exactly one supported verdict: `VERDICT: PASS`, `VERDICT: CHANGES_REQUIRED`, or `VERDICT: BLOCKED`.
