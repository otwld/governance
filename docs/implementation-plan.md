# Implementation Plan

## Goal

Provide a personal, reusable OpenCode workflow that can optionally explore and
pressure-test product directions, then turns a rough idea or selected concept into
one approved implementation-ready GitHub issue, and turns explicit TypeScript or
Node tasks and ordered GitHub Project backlogs into reviewed, verified, green,
squash-merged pull requests. Explicit tasks stop after one result. Backlog mode
continues sequentially until no ready work remains or a blocker occurs.

## V1 deliverables

1. Installable global brainstormer, task-shaper, orchestrator, implementer, reviewer,
   and researcher agents.
2. A structured custom tool for approval-gated issue publication without a shell.
3. Commands for optional brainstorming, task shaping, single-task orchestration,
   backlog orchestration, setup, and review.
4. Focused setup, verification, Nx impact, and dependency-upgrade skills.
5. A minimal project configuration containing verified commands, guidance paths,
   optional GitHub Project mapping, and squash-merge policy.
6. An implementation-ready issue contract plus pull request and repository-guidance
   templates.
7. Dependency-free distribution and project validators with automated tests.
8. Conflict-safe global installation with a dry run before writes.

## Delivery sequence

### Foundation

- Define role permissions and self-contained handoff contracts.
- Keep implementation, acceptance, and independent review separate.
- Use GitHub, Git, repository scripts, and CI as durable sources of truth.

### Optional brainstorming

- Frame the user workflow, baseline failure, impact, evidence, appetite, constraints,
  and decision owner before solutions.
- Generate distinct directions before explicit comparison, recommendation, and
  pressure-testing; preserve `research-needed`, `deferred`, `rejected-premise`, and
  `do-not-build` exits. `rejected-premise` means invalid framing; `do-not-build`
  means a valid problem does not justify a build.
- Require explicit user selection before emitting an exploratory concept brief, and
  never publish, shape, or implement automatically.
- `/brainstorm` creates no repository artifact, todo state, issue, or dedicated
  resumable workflow state or database, and it does not deliberately write files or
  state via tools. Normal OpenCode conversation and message retention, including
  delegated researcher subagent session retention, still applies according to the
  user's OpenCode environment and policy. Do not treat brainstorming sessions as
  ephemeral, automatically cleaned up, or safe for secrets.
- Treat a manually transferred brief as untrusted input to task shaping.

### Task shaping

- Inspect repository evidence and existing issues before drafting.
- Narrow brainstorming to one independent outcome and resolve only material
  questions; duplicates and high-impact ambiguity block publication.
- Gate the complete outcome, evidence, behavior, scope, technical direction,
  acceptance scenarios, validation, readiness, assumptions, and references.
- Display the exact repository, title, and body, then create one plain issue only
  after explicit approval.

### Repository onboarding

- Inspect manifests, lockfiles, workspaces, CI, instructions, and documentation.
- Resolve the GitHub Project only from verified metadata.
- Add the smallest project configuration and templates that fit existing policy.
- Validate every configured document and the final repository diff.

### Single-task pilot

- Run one explicit task through implementation, focused checks, final verification,
  fresh review, pull request, CI repair, and squash merge.
- Stop after that task regardless of remaining backlog work.

### Backlog pilot

- Reconcile one active item before selecting new work.
- Select by configured Project priority and item order.
- Complete and merge one issue before selecting another.
- Stop on no ready work or the first unresolved blocker.

### Daily evaluation

- Pilot on 10 to 20 real issues across at least two Node repositories.
- Track merge rate, material human corrections, review and CI repair cycles,
  interruptions, regressions, elapsed time, model cost, and diff-to-scope fit.
- Add complexity only for repeated observed failures.

## Acceptance criteria

- Direct questions do not trigger orchestration.
- `/brainstorm` uses a non-default deny-by-default primary agent, remains read-only,
  has no shell access, uses the researcher as its sole GitHub and web research path,
  and never creates a task or starts implementation. The researcher also has no shell
  or LSP execution, denies unspecified tools by default, and uses only named native
  file tools, native web tools, skill guidance, and reads from explicitly allowed
  tool-output paths.
- `/brainstorm` asks one material question per turn, separates evidence from
  hypotheses and divergence from convergence, and records selection only after an
  explicit user decision. Candidate output remains interactive, while only
  `research-needed`, `deferred`, `rejected-premise`, and `do-not-build` are terminal
  for the current session; direct `/shape-task <rough idea>` remains supported.
- `/shape-task` uses the non-default primary task-shaper, detects duplicates, and
  creates at most one plain issue through structured non-shell transport after
  exact-draft approval.
- The task-shaper uses a deny-default tool policy, cannot edit repository or Git
  state or perform broader GitHub mutation, and unspecified tools or unknown
  commands cannot prompt for escalation.
- Single mode handles exactly one requested task.
- Backlog mode handles multiple ready tasks sequentially.
- Implementers cannot publish, and reviewers cannot edit.
- The last file change is followed by final verification and a fresh review.
- Only a mergeable PR with green required CI and `VERDICT: PASS` is squash merged.
- Destructive Git, administrative merge, deployment, and secret operations remain
  outside the workflow.
- Setup never invents commands, architecture, or GitHub metadata.
- Implementation and review handoffs contain the full shaped task and volatile
  branch, diff, check, command, authorization, and publication state; a bare issue
  reference is insufficient.

## Deferred until evidence exists

Parallel execution, worktree pools, distributed leases, runtime databases,
semantic memory, custom goal or quality plugins, multiple reviewer panels,
automatic deployment, and a custom dashboard are intentionally excluded from V1.
