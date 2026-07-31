# Design

## V1 decisions

OTWLD Governance is a distribution of declarative OpenCode agents, commands, and
skills plus small validators. V1 deliberately uses the repository, GitHub issues,
GitHub Projects, pull requests, and CI instead of introducing a separate service or
workflow database.

The principal decisions are:

- one implementation-ready issue is the unit of work;
- brainstorming is narrowed, checked for duplicates, gated for readiness, and
  published only after approval of the exact title and body;
- one orchestrator processes one issue at a time;
- shaping, orchestration, implementation, review, and research are separate roles;
- every state transition requires observable evidence;
- review and CI repair have finite retry budgets;
- successful work lands only through a squash-merged pull request;
- ambiguity, missing permissions, and unsafe state stop rather than trigger guesses.

These constraints make the workflow inspectable and recoverable with normal GitHub
and Git tools.

## Agent roles

### Task-shaper

The non-default primary task-shaper turns a brainstorm into exactly one autonomous
implementation contract. It inspects guidance, project configuration, docs, source,
tests, CI, history, and existing issues; asks only bounded material questions; and
delegates only bounded external research to the researcher. Before publication it
checks duplicates and overlap and requires one outcome, grounded evidence, binding
requirements, scope and non-goals, technical constraints and discretion,
independently decidable acceptance scenarios, exact validation, readiness,
assumptions, and authoritative references. It displays the exact repository, title,
and body and creates one plain issue only after explicit approval of that draft.

Its top-level tool policy denies by default, including unspecified plugin and MCP
tools, and explicitly enables only required local discovery, bounded researcher
delegation, questions, task tracking, constrained read-only shell discovery, and the
structured `create_issue` tool. That tool passes the approved repository, title, and
free-form Markdown body to `gh` as an argument vector without a shell, preserving
literal shell-like text without evaluating it. Direct shell issue creation is denied.
It cannot edit files or Git, mutate existing issues or metadata, use Projects or
pull requests, administer a repository, deploy, or delegate implementation or review.
The global OpenCode template denies `create_issue`. Agent permissions take
precedence over the global rule, so the task-shaper's explicit allow is the sole
production override; orchestrator, implementer, reviewer, and researcher each carry
an explicit denial rather than inheriting access through their broader defaults.

### Orchestrator

The primary coordinator selects work, creates the branch, delegates, inspects
evidence, commits, pushes, manages the Project item and pull request, monitors CI,
and squash-merges. It cannot edit source or tests. Unknown shell commands run without
approval prompts, while ordered explicit denies exclude destructive Git, force push,
administrative merge, branch deletion, deployment, and repository administration.

### Implementer

The implementer receives the complete shaped contract plus current branch, diff,
workflow, check, and publication state. It reads the repository, makes the smallest scoped change, adds tests
when behavior changes, and runs focused and final checks. It cannot delegate,
commit, push, use GitHub, switch branches, or deploy. Unknown shell commands run
without approval prompts, subject to ordered explicit role and safety denies.

### Reviewer

The reviewer independently checks the exact change against the full shaped contract,
repository instructions, and validation evidence. It remains read-only,
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
BRAINSTORM
  -> REPOSITORY + DUPLICATE DISCOVERY
  -> READY DRAFT
  -> EXPLICITLY APPROVED ISSUE
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
2. Read instructions, the complete issue title and body, Project context, branch
   state, and related pull requests. An issue reference is a lookup key, never an
   implementation handoff. Ambiguity stops the transition.
3. Mark the Project item active when applicable and create a dedicated branch from
   the current base without overwriting unrelated work.
4. Delegate implementation with the complete shaped task and volatile repository
   root, branch/base/publication, exact diff or working-tree boundary, unrelated
   changes, workflow cycle, review/CI evidence, exact configured commands, install
   authorization, and publication prohibitions. Inspect the resulting diff and
   executed test evidence.
5. Delegate a fresh review of that same full contract and runtime boundary. Failed review returns to implementation with stable
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

1. The shaped task defines binding product behavior, scope, non-goals,
   compatibility, and explicit technical decisions.
2. Applicable `AGENTS.md` files and repository documents define local constraints,
   architecture, and required commands.
3. Source, tests, manifests, lockfiles, schemas, and CI workflows govern actual
   implementation details and validation commands. Internal choices not bound by
   the shaped task remain implementer discretion.
4. Git refs and the current working tree define the change being implemented or
   reviewed.
5. GitHub Project fields and item order define backlog readiness, active state,
   priority, and ordering.
6. Pull request checks, branch protection, and mergeability define merge safety.
7. This distribution defines role permissions, lifecycle rules, and retry limits.

Prefer direct inspection over copied summaries. If authoritative sources conflict or
a material product decision is unresolved, stop and name the conflict instead of
silently choosing one.

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
initial trust boundary. Task shaping expands the trust boundary only by one
approval-gated structured issue-create operation; all discovery remains read-only.
GitHub remains the visible state store, squash merge keeps history compact, and
Markdown roles are reviewable without a custom runtime. The
small project schema records only verified commands, purposeful guidance paths,
optional Project mappings, and squash policy; it does not become a workflow state
store. Bounded retries prevent unattended loops from converting uncertainty into
churn.

V1 defers concurrency, persistent orchestration state, automatic Project discovery,
dynamic permission escalation, and broad language-specific setup until pilot
evidence shows a repeated problem that simpler repository policy cannot solve. See
the [roadmap](roadmap.md) for upgrade triggers.
