# Implementation Plan

## Goal

Provide a personal, reusable OpenCode workflow that turns explicit TypeScript or
Node tasks and ordered GitHub Project backlogs into reviewed, verified, green,
squash-merged pull requests. Explicit tasks stop after one result. Backlog mode
continues sequentially until no ready work remains or a blocker occurs.

## V1 deliverables

1. Installable global orchestrator, implementer, reviewer, and researcher agents.
2. Commands for single-task orchestration, backlog orchestration, setup, and review.
3. Focused setup, verification, Nx impact, and dependency-upgrade skills.
4. A minimal project configuration containing verified commands, guidance paths,
   optional GitHub Project mapping, and squash-merge policy.
5. Issue, pull request, and repository-guidance templates.
6. Dependency-free distribution and project validators with automated tests.
7. Conflict-safe global installation with a dry run before writes.

## Delivery sequence

### Foundation

- Define role permissions and self-contained handoff contracts.
- Keep implementation, acceptance, and independent review separate.
- Use GitHub, Git, repository scripts, and CI as durable sources of truth.

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
- Single mode handles exactly one requested task.
- Backlog mode handles multiple ready tasks sequentially.
- Implementers cannot publish, and reviewers cannot edit.
- The last file change is followed by final verification and a fresh review.
- Only a mergeable PR with green required CI and `VERDICT: PASS` is squash merged.
- Destructive Git, administrative merge, deployment, and secret operations remain
  outside the workflow.
- Setup never invents commands, architecture, or GitHub metadata.

## Deferred until evidence exists

Parallel execution, worktree pools, distributed leases, runtime databases,
semantic memory, custom goal or quality plugins, multiple reviewer panels,
automatic deployment, and a custom dashboard are intentionally excluded from V1.
