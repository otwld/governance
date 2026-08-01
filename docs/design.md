# Design

## State and execution

GitHub issues, trusted-author artifact comments, Projects, pull requests, checks, merge state, and explicit workflow-state records are durable workflow evidence. The approval artifact is a trusted-author issue comment binding the issue contract and its review. Machine-recognizable markers and canonical digests permit idempotent recovery without treating summaries or URLs as authority. Public tools require OpenCode's supplied directory and perform bounded Git-worktree discovery of validated `.opencode/project.json`; no process cwd fallback or caller authority override exists. Execution is strictly sequential.

Issue, plan, review, and verification contracts are structured, validated, and canonically digested. A digest binds approval and review to exact content. Publication requires a matching issue `PASS` review. Delivery creates and independently reviews the plan, then requires fresh review after the final change.

Workflow publication is compare-before-write: current head must still equal the
checkpoint binding. A changed head invalidates downstream change, verification,
change-review, and checkpoint state. Checkpoints preserve `planReviewDigest` and
`changeReviewDigest` independently.

## Roles and permissions

- The brainstormer explores product direction and context.
- The task-shaper owns issue publication through `issue_factory`.
- The orchestrator coordinates development and owns durable workflow-state and change-boundary tools.
- The planner, implementer, reviewer, and researcher provide specialized work without being blocked from ordinary repository or diagnostic tools.

This development distribution allows ordinary tools by default, including shell,
external paths, web access, editing, and GitHub inspection. Role prompts describe
responsibility rather than trying to encode every possible command in permission
globs. Explicit ownership remains only for custom tools that publish durable workflow
state: task-shaper receives `issue_factory`; orchestrator receives `workflow_state`
and `change_boundary`; orchestrator and implementer receive `dependency_update`; and
all roles may use read-only `governance_check`.

## Semantic documentation

Code and documentation form one change boundary. Issue and plan contracts carry first-class declaration, external-document, and rationale fields. Implementation keeps affected external semantics and non-obvious code contracts current; review and verification bind that evidence to the same change digest. Documentation stays proportional to behavior rather than tracking every declaration or local binding.

## Lifecycle

The complete state transitions, retry bounds, handoff requirements, and merge gates live only in [the deliver-issue lifecycle](../skills/deliver-issue/references/lifecycle.md). Commands and agent prompts point there rather than copying its policy.

## Failure posture

Missing material evidence, ambiguous durable state, digest mismatch, partial remote outcomes, and unsafe repository state are blockers for publication or merge. Ordinary development and diagnosis should continue with the best available tools instead of manufacturing workflow ceremony.
