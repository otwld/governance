# Delivery Lifecycle

This is the sole canonical delivery procedure. Other files may point here but must
not redefine its transitions or retry bounds.

## Table of contents

1. Durable artifacts and invariants
2. Modes and preflight
3. Project queue selection
4. Branch, base, and remote reconciliation
5. Stage inference and `workflow_state`
6. Plan and plan-review handoffs
7. Implementation handoff and change digest
8. Verification and change review
9. Stage, commit, push, and pull request
10. CI observation and repair
11. Merge and Project statuses
12. Idempotency, malformed handoffs, and recovery
13. Terminal report
14. Invocation and resume examples

## 1. Durable artifacts and invariants

GitHub issue, dedicated trusted approval comment, Project item, branch, commits, pull
request, checks, and merge state are durable evidence. The mutable issue body is human
context, not approval authority. Local contracts and `workflow_state` are resumable evidence, not a
new source of product truth. Maintain one issue contract/digest, one current plan and
digest, reviews naming exact subject digests, one verification bound to issue/plan/
change digests, and one exact current staged-tree or committed-tree digest.

The task-shaper alone publishes the issue and may perform optional intake enqueue to
Ready. After Ready, only the orchestrator creates branches, stages, commits, pushes,
changes delivery statuses, manages pull requests, and merges. Planners/reviewers are
read-only. Implementers edit and test but do not stage or publish. Process one issue
at a time. Never force push, rewrite a published branch, bypass protection, admin-merge,
delete branches, deploy, publish packages, widen permissions, or retry an ambiguous
remote mutation.

Any material content change invalidates prior verification and change review. A
corrected issue invalidates issue approval and all downstream artifacts. A corrected
plan invalidates plan review and implementation handoff.

## 2. Modes and preflight

`ISSUE <issue URL or owner/repo#number>` delivers exactly one approved issue.
`PROJECT <owner/number>` processes an ordered configured queue sequentially until it
is empty or one item blocks. A URL is a lookup key, never a complete handoff.

Before selection or mutation:

1. Load `.opencode/project.json`, validate it, preserve commands, documents, Project
   IDs/statuses/priority ordering, and merge policy exactly; read every configured
   document. Tool actions derive repository and trust authority from this validated
   configuration; never supply caller-selected authority fields.
2. Inspect Git status, current branch, remotes, default/base branch, worktrees, local
   and remote issue branches, open/closed pull requests, and relevant checks.
3. Call read-only `governance_check` action `approved-issue` with only the issue lookup
   accepted by the public tool. It derives repository/trust configuration and accepts
   only a dedicated trusted-author approval comment binding exact issue/review digests.
4. Call `workflow_state` action `inspect` with only the public issue lookup. It derives
   authority internally and validates one rooted linear chain against the approved
   issue digest. Unauthorized comments are ignored/reported; malformed, forked,
   disconnected, or cross-bound chains block.
5. Require an exact-tree-capable worktree: no unstaged tracked changes and no untracked
   nonignored files. Existing unrelated work blocks delivery; do not stash, clean,
   overwrite, or claim it can be excluded from exact evidence.
6. Verify required credentials/read access and that configured squash/automatic
   policy can be observed. Never change repository settings to make delivery work.

Missing config/documents, malformed issue/review, digest mismatch, unapproved issue,
unsafe local state, or ambiguous remote state blocks before mutation.

## 3. Project queue selection

`PROJECT` requires configured Project node ID, Status field and exact Ready/Active/
Review/Done/Blocked names and option IDs, `priorityFieldId`, ordered
`priorityOptions` entries shaped `{ "name": ..., "optionId": ... }`,
`missingPriority`, `includeDrafts: false`, `includeArchived: false`, and squash policy.
Preflight must retain GraphQL evidence that the configured Project node, Status field,
status options, Priority field, and every priority option name/ID refer to the same
Project. Display names alone are not field identity.
Call read-only `governance_check` with `action: "queue"` and no caller-supplied project
or item data. It derives configuration, fetches authoritative full Project data,
authenticates approved artifacts, and returns the deterministic resume/selection.

The queue operation must apply this exact algorithm:

1. use authoritative archive state and filter out every archived item, including an
   archived item carrying Active or Review status;
2. inspect Active and Review first: resume exactly one combined in-flight item, select
   Ready only when there are zero, and block without mutation when there are multiple;
3. reject draft content; configuration cannot enable it because drafts cannot contain
   an approved issue artifact;
4. authenticate the selected/resumed issue's dedicated approval comment against
   internally derived trusted actors; missing, invalid, conflicting, or unauthorized
   approval blocks rather than disappearing;
5. rank eligible Ready issues by `priorityOptions` array order high-to-low, placing missing
   priority first or last exactly as `missingPriority` specifies;
6. break rank ties by Project order and then stable item ID.

Archived and draft items are always excluded. Do not silently skip a malformed
in-flight item or trust caller-normalized Project data.

Before moving Ready to Active, verify item ID, issue URL, issue readiness, and current
status. Perform one exact status mutation and read back the field. If mutation outcome
is uncertain, reconcile before retry.

## 4. Branch, base, and remote reconciliation

Resolve the current default base and record its commit. A new delivery branch starts
once from the current approved base using repository naming guidance. Before creating
one, search local/remote branches and pull requests by issue number and linkage.
Branch switching and worktree creation permissions are defined by the orchestrator's
agent configuration, not this skill. Use only an allowed operation; if reconciliation
requires a denied switch/worktree action, block rather than inventing a workaround.

If a branch or PR exists, reconcile rather than duplicate:

- confirm it belongs to the issue and base;
- inspect head commit, commits, files, PR body/linkage, checks, and merge state;
- compare local and remote ancestry without rewriting published history;
- preserve unrelated commits and stop if ownership is uncertain.

Base drift alone does not authorize merge/rebase. Use the repository's safe policy or
block for a human decision. Never switch with discard/force flags or create a second
branch to evade reconciliation.

## 5. Stage inference and `workflow_state`

Infer stage from durable evidence, not Project status alone. Ordered stages are:

```text
selected -> active -> planned -> plan_reviewed -> implementing -> verified
-> change_reviewed -> committed -> pushed -> pr_open -> ci_green -> merged -> done
```

Stage may move backward when evidence is invalidated. For example, changed bytes
after `verified` return to `implementing`; a pushed CI repair returns through verify
and review before another commit.

Call `workflow_state` action `inspect` before publication or resume using only its
public issue lookup. It derives repository/trusted-author authority from validated
project configuration. Use only its single rooted linear artifact chain and diagnostics;
do not parse comments by hand. Publish resumable evidence with `workflow_state` as contract-bound issue
comments. Supported artifact kinds are `plan`, `plan-review`, `verification`,
`change-review`, `blocker`, and `checkpoint`. For every publication:

```json
{
  "action": "inspect",
  "issueUrl": "https://github.com/owner/repo/issues/42"
}
```

Require inspection to bind the chain root to the approved issue digest and distinguish
accepted artifacts, ignored unauthorized comments, malformed markers, forks, missing
parents, multiple roots/heads, and cross-context digests.

1. call read-only `governance_check` action `contract` for every contract kind used by
   the chain: plan, review, verification, blocker, and checkpoint. Never ask
   `workflow_state` to establish a digest that has not passed this gate;
2. immediately before preview, call `workflow_state` `inspect`; require its current
   single head to equal the intended `priorDigest`, or require an empty artifact chain
   for the first publication. Then call `preview` with issue URL, artifact kind,
   complete artifact, and digest. Omit
   `priorDigest` on the first artifact; every later artifact passes the immediately
   previous chain artifact's digest, never merely the issue digest or an older stage;
3. immediately before publish, inspect again and require the same current head. A new
   head invalidates the preview and requires a fresh preview. Inspect the safe marker,
   digest, and idempotency key, then call `publish` once;
4. accept only `published` with the exact issue comment URL as durable success;
5. on `failed`, `partial`, or `unknown`, inspect issue comments for the idempotency
   key before any retry.

A blocker and checkpoint are closed contracts, not arbitrary records. Validate each
with `governance_check` action `contract` and use its returned digest before
`workflow_state` preview/publication. Exact examples appear below.

Blocker fields are exactly `issueDigest`, `stage`, `reason`, `evidence`, and
`requiredAction`:

```json
{
  "issueDigest": "sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  "stage": "verification",
  "reason": "The required integration service is unavailable.",
  "evidence": ["npm run check exited before integration targets could execute."],
  "requiredAction": "Restore the service and resume verification without changing the staged tree."
}
```

Checkpoint required fields are exactly `issueDigest`, `mode`, `stage`, `repository`,
`issueUrl`, and `rounds` (`plan`, `change`, `ci`). Optional fields are
`planDigest`, `planReviewDigest`, `changeDigest`, `verificationDigest`,
`changeReviewDigest`, `blockerDigest`, `projectItemId`, `baseCommit`, `branch`,
`headCommit`, and `pullRequestUrl`:

```json
{
  "issueDigest": "sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  "mode": "issue",
  "stage": "change_reviewed",
  "repository": "owner/repo",
  "issueUrl": "https://github.com/owner/repo/issues/42",
  "rounds": { "plan": 1, "change": 0, "ci": 0 },
  "planDigest": "sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
  "planReviewDigest": "sha256:eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee",
  "changeDigest": "sha256:cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc",
  "verificationDigest": "sha256:dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd",
  "changeReviewDigest": "sha256:ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff",
  "baseCommit": "1111111111111111111111111111111111111111",
  "branch": "issue-42-deterministic-results",
  "headCommit": "2222222222222222222222222222222222222222",
  "pullRequestUrl": "https://github.com/owner/repo/pull/43"
}
```

Every digest referenced inside an artifact must match the artifact already present in
the same chain: plan binds the approved issue; plan review binds issue/plan;
verification binds issue/plan/change; change review binds issue/plan/change/
verification; blocker/checkpoint `issueDigest` binds the chain root and their optional
digests must name earlier chain evidence. `priorDigest` links publication order and is
separate from those semantic cross-bindings.

Artifact order and PASS gates are strict: plan review must be `PASS` for the current
plan before implementation; verification must be `PASS` for the current change before
change review; change review must be `PASS` for that verification/change before commit.
`CHANGES_REQUIRED`, `BLOCKED`, or any corrected plan/change invalidates every later
digest and checkpoint field derived from it. Publish corrected contracts later in the
same linear chain, rerun invalidated gates, and omit stale optional fields until new
evidence exists. A blocker or checkpoint records state but never substitutes for a
required `PASS` review or verification.

On resume, call `workflow_state` inspect and accept only its rooted linear chain.
Ignore/report unauthorized comments; block on duplicate keys, malformed trusted
artifacts, broken `priorDigest`, forks, multiple heads, or issue-digest cross-binding.
Reconcile against actual Git/GitHub state. A stale checkpoint never overrides
a merged PR, changed head, current Project readback, or a later valid artifact.

## 6. Plan and plan-review handoffs

Delegate to a fresh planner with: complete issue JSON/digest/review, repository root,
base and branch state, all configured documents and exact commands, relevant evidence,
the exact-tree clean-gate result, permissions/prohibitions, and requested plan output. A link or
summary is malformed. Validate and digest the returned plan with read-only
`governance_check` action `contract`, kind `plan`, value plan, and approved issue context.
Pass that context as `{ "issue": <approved issue> }` so scenario references and issue
digest are checked together.

Delegate exact issue and plan contracts/digests plus repository evidence to a fresh
reviewer. Require a schema-valid plan review whose `subject.kind` is `plan`, whose
`subject.digest` is the current plan digest, and whose context binds the issue and
plan digests. `PASS` has no findings. `CHANGES_REQUIRED` returns stable findings for a new
planner correction and new digest/review. `BLOCKED` stops. Maximum two correction
rounds; malformed output counts as a failed handoff requiring correction, not a pass.
Validate and digest each returned review with `governance_check` action `contract` before
publishing it through `workflow_state`.

## 7. Implementation handoff and change digest

Delegate complete issue, reviewed plan, all matching digests/reviews, exact repository
and branch state, clean starting tree, configured documents and commands, accepted scope,
and publication/destructive-operation prohibitions. Require changed files/behavior,
tests, exact command evidence, assumptions, and blockers. The implementer must not
stage, commit, push, change branch, use GitHub, or delegate.

After implementation, inspect all tracked/untracked changes and the handoff, then
stage only intended files. Staging occurs **before** any governed change digest. Leave
no unrelated work behind: if any unstaged tracked change or untracked nonignored file
exists, block instead of claiming exact evidence. Inspect staged names and patch, then
call the orchestrator-only `change_boundary` tool with `action: "stage-inspect"` and
the recorded base in `base`. It does not stage;
it validates the clean gate, reads the already-staged index tree, and returns full
base/tree OIDs plus canonical `changeDigest`. Record these and intended paths in the
checkpoint. Any later index/content change invalidates digest, verification, and
review; restage intentionally, re-establish the clean gate, and rerun
`change_boundary` `stage-inspect`.

## 8. Verification and change review

Use the current successful `change_boundary` `stage-inspect` result. Before and after every
verification command, require no unstaged tracked changes and no untracked nonignored
files; a command that mutates the tree invalidates exact evidence. Run focused checks
that execute changed scenarios, then configured `commands.verify`
verbatim. Use configured install verbatim only when required. Validate the redesigned
verification contract in `schemas/verification.schema.json`: its `issueDigest`,
`planDigest`, and `changeDigest` bind the current exact artifacts. Command evidence must prove non-zero target discovery and no
skips. `FAIL` returns to implementation; unavailable/skipped required checks are
`BLOCKED`. Baseline claims require comparison evidence.

At the review boundary in `PROJECT`, the orchestrator moves an unambiguous item to
Review once and reads it back. Obtain a fresh independent `review-change` contract for the exact change
digest. The review must separately establish contract compliance and engineering
quality. `CHANGES_REQUIRED` returns stable findings through `address-review`, then
requires a new change digest, full invalidated verification, and fresh review.
Maximum three change-fix rounds. `BLOCKED`, malformed review, or stale digest stops.

## 9. Stage, commit, push, and pull request

Before commit require matching issue, plan, plan review, `change_boundary` result,
verification, and change review evidence. Re-run `change_boundary` `stage-inspect`
immediately before commit and require the same full base/tree OIDs and digest. Commit
once with repository guidance. Resolve the commit's full tree OID, then call read-only
`governance_check` action `change` with the reviewed boundary's `baseCommit` and
`treeOid` plus that `committedTreeOid`; require `valid` and the same digest. If hooks
or transformations changed bytes, stage the resulting
intended state and recreate the governance-check digest, verification, and review
before push (a follow-up commit may be required; never amend a published/failed commit
to hide the difference).

Push only the reconciled branch without force. Read back remote head and require it
equals local head. Open or update one linked PR; include issue linkage, outcome,
scenario/validation summary, and current evidence without exposing secrets. Verify
base/head, issue link, files, and remote commit. An uncertain push or PR mutation must
be reconciled before any retry.

## 10. CI observation and repair

Observe all required checks on the exact pushed head. Pending is not green; skipped,
neutral, unavailable, stale-head, or missing required checks block unless repository
policy explicitly classifies them otherwise.

For each actionable CI failure:

1. capture check/run URL, exact head, failing command/job, and logs;
2. delegate failure plus all current contracts/state to implementation;
3. inspect and stage only the repair, require the exact-tree clean gate, and call
   `change_boundary` `stage-inspect` for the
   new base/tree OIDs and digest;
4. run focused and required verification for that digest;
5. obtain fresh change `PASS` review for that digest;
6. commit, compare committed integrity, and recreate evidence on difference;
7. push and observe all required checks on the new head.

Allow at most two CI repair cycles. Do not rerun to seek luck unless evidence proves a
transient external failure and repository policy permits bounded retry. Still failing,
ambiguous, unavailable, or skipped required CI after the limit blocks delivery.

## 11. Merge and Project statuses

Before merge require: approved issue digest; reviewed plan digest; current verification
and change `PASS` review matching the committed/remote-head change digest; PR base/head
integrity; all required CI green on that head; no unresolved mergeability or review
gate; and configured squash policy.

If `merge.automatic` is true, perform one squash merge without admin or branch
deletion flags and verify merged state and resulting commit. If false, stop at the
green reviewed PR for human merge and report that expected terminal boundary; do not
mark Done before durable merged evidence.

After verified merge, the orchestrator moves an unambiguous Project item to Done using exact configured
IDs and read back. On a terminal blocker, move to Blocked only when the failed remote
transition is known not to be partial, item identity is unambiguous, and readback can
verify the mutation. Otherwise report without status mutation.

## 12. Idempotency, malformed handoffs, and recovery

Every remote mutation is check-before, mutate-once, read-after. A timeout means
unknown, not failed. Query by durable identity before retrying branch push, status,
PR creation/update, or merge. Project intake/enqueue belongs only to task-shaper via
`issue_factory`; delivery never enqueues. Re-entering the workflow must resume the first
stage whose evidence is absent or invalid, not repeat completed side effects.

Malformed handoffs include missing full contracts, invalid JSON/schema, digest
mismatch, stale base/head/change boundary, missing exact-tree clean-gate evidence, ambiguous command
evidence, and verdict/status inconsistent with findings. Reject with exact diagnostics
and request a corrected artifact within the stage's retry bound. Never repair another
role's signed-off artifact silently.

If local and remote evidence conflict, preserve branch/PR/state, record both views,
and stop. Do not reset, clean, stash, force, duplicate, or guess.

## 13. Terminal report

Report mode, repository/issue/Project item, final inferred stage and status, branch,
base/head commits, PR and merge URLs, issue/plan/change digest set, review verdicts,
verification command evidence, required CI statuses, correction/fix/repair counts,
Project mutations with readback, exact-tree clean-gate evidence, and exact blocker/human
action. Include the final `workflow_state`. Distinguish completed, waiting-for-human-
merge, blocked, and queue-empty. Do not describe unexecuted actions as completed.

## 14. Invocation and resume examples

```text
ISSUE https://github.com/owner/repo/issues/42
```

Fetch issue 42, reconcile any branch/PR, and deliver only that approved contract.

```text
PROJECT owner/7
```

Call `governance_check` queue selection. Resume exactly one combined Active/Review
item; otherwise filter archived, draft, and unapproved work, rank Ready by configured
high-to-low priority options with configured missing placement, then Project order and
item ID. Stop queue processing at the first blocker.

```text
Resume ISSUE owner/repo#42 with workflow_state: { ... }
```

Treat the object as a claim. Re-read Git/GitHub, infer the actual stage, invalidate
stale digests/evidence, and continue from the first unsatisfied gate without repeating
durable side effects.
