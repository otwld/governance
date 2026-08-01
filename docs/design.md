# Design

## State and execution

GitHub issues, Projects, pull requests, checks, and merge state are durable workflow evidence. Execution is strictly sequential. The project contract maps repository commands and optional Project fields without becoming a workflow database.

Issue, plan, review, and verification contracts are structured, validated, and canonically digested. A digest binds approval and review to exact content. Publication requires a matching issue `PASS` review. Delivery creates and independently reviews the plan, then requires fresh review after the final change.

## Role separation

- The brainstormer explores and cannot create work.
- The task-shaper is the sole issue publication authority.
- The orchestrator is the default primary and sole Git and GitHub delivery authority.
- The planner produces read-only implementation plans.
- The implementer edits and tests without GitHub, Git publication, or delegation.
- The reviewer independently reviews issues, plans, and changes read-only.
- The researcher performs bounded cited read-only investigation.

All roles deny by default. Explicit allows are validated against the canonical manifest. The global OpenCode template denies `issue_factory`; only task-shaper overrides it.

## Lifecycle

The complete state transitions, retry bounds, handoff requirements, and merge gates live only in [the deliver-issue lifecycle](../skills/deliver-issue/references/lifecycle.md). Commands and agent prompts point there rather than copying its policy.

## Failure posture

Missing evidence, ambiguous state, digest mismatch, partial remote outcomes, unresolved decisions, unavailable required checks, and unsafe repository state are blockers. The workflow never broadens permissions, guesses a transition, or blindly retries a remote mutation.
