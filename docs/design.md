# Design

## State and execution

GitHub issues, trusted-author artifact comments, Projects, pull requests, checks, merge state, and explicit workflow-state records are durable workflow evidence. The approval artifact is a trusted-author issue comment binding the issue contract and its review. Machine-recognizable markers and canonical digests permit idempotent recovery without treating summaries or URLs as authority. Public tools require OpenCode's supplied directory and perform bounded Git-worktree discovery of validated `.opencode/project.json`; no process cwd fallback or caller authority override exists. Execution is strictly sequential.

Issue, plan, review, and verification contracts are structured, validated, and canonically digested. A digest binds approval and review to exact content. Publication requires a matching issue `PASS` review. Delivery creates and independently reviews the plan, then requires fresh review after the final change.

Workflow publication is compare-before-write: current head must still equal the
checkpoint binding. A changed head invalidates downstream change, verification,
change-review, and checkpoint state. Checkpoints preserve `planReviewDigest` and
`changeReviewDigest` independently.

## Role separation

- The brainstormer explores and cannot create work.
- The task-shaper alone publishes an approved issue, creates its intake Project item, and assigns Ready.
- The orchestrator starts from verified Ready and alone owns Active, review, Done, and Blocked transitions plus all other delivery Git/GitHub mutations.
- The planner produces read-only implementation plans.
- The implementer edits and tests without GitHub, Git publication, or delegation.
- The reviewer independently reviews issues, plans, and changes read-only.
- The researcher performs bounded cited read-only investigation.

All roles deny by default. Explicit allows are validated against the canonical manifest tool-access matrix. The global OpenCode template denies every custom tool. Only task-shaper receives `issue_factory`; only orchestrator receives `workflow_state` and `change_boundary`; only implementer receives `dependency_update`; and the delivery/review roles receive read-only `governance_check`.

## Semantic documentation

Code and documentation form one change boundary. Issue and plan contracts carry first-class declaration, external-document, and rationale fields. Implementation applies the `document-code` policy to every added or materially changed maintained JavaScript or TypeScript surface and keeps external semantics current; review and verification bind that evidence to the same change digest. Untouched historical code is outside that gate. Detailed writing and validation procedures remain in the skill rather than agent or command prompts.

## Lifecycle

The complete state transitions, retry bounds, handoff requirements, and merge gates live only in [the deliver-issue lifecycle](../skills/deliver-issue/references/lifecycle.md). Commands and agent prompts point there rather than copying its policy.

## Failure posture

Missing evidence, ambiguous state, digest mismatch, partial remote outcomes, unresolved decisions, unavailable required checks, and unsafe repository state are blockers. The workflow never broadens permissions, guesses a transition, or blindly retries a remote mutation.
