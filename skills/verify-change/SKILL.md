---
name: verify-change
description: Use when validating an implementation with focused checks followed by the exact repository-required final command.
license: MIT
compatibility: OpenCode with repository shell access
---

# Verify Change

Read project instructions and `.opencode/project.json`. Require the reviewed subject digest and the exact change digest before running checks. Run the narrowest check that exercises the changed behavior, then run `commands.verify` verbatim. Never substitute commands, use mutating flags, or count skipped and zero-test runs as evidence.

Return the structured verification contract from `schemas/verification.schema.json`: `subjectDigest`, `changeDigest`, `status`, and command evidence containing exact `command`, `cwd`, `required`, `exitCode`, `summary`, `testsOrTargets`, `skipped`, and `unavailable` when execution could not occur. Use `PASS` only when every command exits zero and nothing is skipped or unavailable, `FAIL` only with nonzero evidence, and `BLOCKED` only with unavailable or skipped required-check evidence. Validate the contract before handoff.
