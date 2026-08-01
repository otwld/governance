---
name: deliver-issue
description: Use ONLY when coordinating one approved issue or a configured sequential GitHub Project queue through planning, implementation, review, pull request, CI, and squash-merge gates.
license: MIT
compatibility: OpenCode with Git, GitHub CLI, and configured project governance
---

# Deliver an Issue

This root is intentionally thin. Delivery is a resumable, digest-bound orchestration
workflow in which only the orchestrator mutates delivery Git, GitHub, pull-request,
or post-Ready Project state; planners, implementers, and reviewers receive explicit
handoffs and retain their role boundaries.

The task-shaper owns issue publication and optional intake enqueue through Ready.
Delivery begins from authenticated Ready/in-flight evidence; only the orchestrator
owns Active, Review, Blocked, and Done transitions plus branch/PR/merge mutations.

Before any action, read [the canonical lifecycle](references/lifecycle.md) in full.
It defines modes, preflight, durable `workflow_state`, queue selection, branch and
pull-request reconciliation, stage inference, handoff contracts, change digests,
verification and review, publication gates, bounded repair, merge, recovery, and
terminal reporting. It requires read-only `governance_check` for contract, approved-
issue, and queue decisions, orchestrator-only `change_boundary` for exact staged-tree
evidence, and `workflow_state` inspect for trusted durable
artifacts. No shorter prompt or status label overrides that reference.
