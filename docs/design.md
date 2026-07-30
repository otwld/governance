# Design

## V1 decisions

OTWLD Governance is a distribution of declarative OpenCode agents, commands, and
skills plus small validators. V1 deliberately uses the repository, GitHub issues,
GitHub Projects, pull requests, and CI instead of introducing a separate service or
workflow database.

The principal decisions are:

- one issue is the unit of work;
- one orchestrator processes one issue at a time;
- orchestration, implementation, review, and research are separate roles;
- every state transition requires observable evidence;
- review and CI repair have finite retry budgets;
- successful work lands only through a squash-merged pull request;
- ambiguity, missing permissions, and unsafe state stop rather than trigger guesses.

These constraints make the workflow inspectable and recoverable with normal GitHub
and Git tools.

## Agent roles

### Orchestrator

The primary coordinator selects work, creates the branch, delegates, inspects
evidence, commits, pushes, manages the Project item and pull request, monitors CI,
and squash-merges. It cannot edit source or tests. Unknown shell commands run without
approval prompts, while ordered explicit denies exclude destructive Git, force push,
administrative merge, branch deletion, deployment, and repository administration.

### Implementer

The implementer reads the repository, makes the smallest scoped change, adds tests
when behavior changes, and runs focused and final checks. It cannot delegate,
commit, push, use GitHub, switch branches, or deploy. Unknown shell commands run
without approval prompts, subject to ordered explicit role and safety denies.

### Reviewer

The reviewer independently checks the exact change against the task, acceptance
criteria, repository instructions, and validation evidence. It remains read-only,
uses stable finding IDs, and returns `PASS`, `CHANGES_REQUIRED`, or `BLOCKED`. A
reviewer does not trust prior claims and does not fix its own findings.

### Researcher

The researcher performs bounded, cited, read-only investigation. It inspects local
evidence first, uses primary external sources only when needed, and distinguishes
verified facts from inference.

## Issue-to-squash-merge state machine

The configured Project option names may vary, but each installation must map them
unambiguously to the semantic states below.

```text
OPEN + READY
  -> ACTIVE
  -> BRANCH CREATED
  -> IMPLEMENTED
  -> IN REVIEW
  -> REVIEWED
  -> LOCALLY VERIFIED
  -> PULL REQUEST OPEN
  -> CI GREEN + MERGEABLE
  -> SQUASH MERGED
  -> DONE
```

1. In `SINGLE`, the supplied task is the only candidate. In `BACKLOG`, reconcile a
   single existing active item first; otherwise select an open, actionable ready
   issue by Project Priority and then Project item order.
2. Read instructions, issue and Project context, acceptance criteria, branch state,
   and related pull requests. Ambiguity stops the transition.
3. Mark the Project item active when applicable and create a dedicated branch from
   the current base without overwriting unrelated work.
4. Delegate implementation. Inspect the resulting diff and executed test evidence.
5. Delegate a fresh review. Failed review returns to implementation with stable
   finding IDs and then requires a new reviewer.
6. After review passes, run final local verification on the accepted tree.
7. Commit only intended files, push, and open a pull request linked to the issue.
8. Required CI failure returns to implementation for a bounded repair, local
   verification, and fresh review.
9. Squash merge only when review passes, required CI is green, the pull request is
   mergeable, and no blocker remains. Move the item to done if automation did not.

At any stage, a blocker is a stop state, not success. Preserve the current branch,
pull request, and Project evidence and report the exact human action needed. Resume
only after reconciling that evidence; do not restart blindly or create duplicate
active work.

## Sources of truth

No single document overrides every concern. Use the narrowest authoritative source:

1. The explicit task or issue defines the goal, acceptance criteria, and scope.
2. Applicable `AGENTS.md` files and repository documents define local constraints,
   architecture, and required commands.
3. Source, tests, manifests, lockfiles, schemas, and CI workflows define actual
   implementation and validation behavior.
4. Git refs and the current working tree define the change being implemented or
   reviewed.
5. GitHub Project fields and item order define backlog readiness, active state,
   priority, and ordering.
6. Pull request checks, branch protection, and mergeability define merge safety.
7. This distribution defines role permissions, lifecycle rules, and retry limits.

Prefer direct inspection over copied summaries. If authoritative sources conflict,
stop and name the conflict instead of silently choosing one.

## Failure and retry policy

- Implementation or validation failures are diagnosed and fixed only when in scope.
  Required checks must be rerun after a relevant edit.
- Review allows at most three review-fix rounds total. Each round uses the current
  finding IDs and a fresh reviewer. Remaining findings block the task.
- CI allows at most two CI-fix rounds total. Each actionable repair requires local
  verification and fresh review before another push. Persistent, skipped, or
  ambiguous CI blocks the merge.
- Authentication, rate limits, missing refs, dirty or conflicting state, multiple
  active items, unavailable dependencies, unclear acceptance criteria, and unsafe
  merge state are blockers, not reasons to broaden permissions or retry forever.
- Recovery reports the task, current stage, evidence, attempted rounds, and exact
  human decision or action required.

## Why V1 avoids overengineering

Sequential work removes scheduling, locking, and cross-branch coordination from the
initial trust boundary. GitHub remains the visible state store, squash merge keeps
history compact, and Markdown roles are reviewable without a custom runtime. The
small project schema records only verified commands, purposeful guidance paths,
optional Project mappings, and squash policy; it does not become a workflow state
store. Bounded retries prevent unattended loops from converting uncertainty into
churn.

V1 defers concurrency, persistent orchestration state, automatic Project discovery,
dynamic permission escalation, and broad language-specific setup until pilot
evidence shows a repeated problem that simpler repository policy cannot solve. See
the [roadmap](roadmap.md) for upgrade triggers.
