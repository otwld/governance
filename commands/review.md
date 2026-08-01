---
description: Runs a fresh independent review of an issue, plan, change, or working tree.
agent: reviewer
---

Independently review this exact subject: $ARGUMENTS

Use `review-issue`, `review-plan`, or `review-change` when the matching governed
contracts and digests are supplied. Otherwise review the user-specified diff, commit
range, pull request, or current working tree directly. Do not block a reviewable
subject merely because durable workflow artifacts are absent.
