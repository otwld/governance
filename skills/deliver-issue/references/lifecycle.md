# Delivery Lifecycle

## Inputs and modes

`ISSUE` handles exactly one approved issue. `PROJECT` handles issues sequentially and requires configured Project node, Status field, option IDs, Priority field, and automatic squash merge.

Load and validate `.opencode/project.json`, read every configured document, and fetch the complete approved issue contract, issue review, and digest. A URL is a lookup key, not a handoff. Preserve unrelated work and reconcile an existing branch or pull request before acting.

Before selecting ready work in `PROJECT`, inspect items in both configured active and review statuses. Resume exactly one item at its evidenced stage. More than one in-flight item, conflicting status and pull-request evidence, or an uncertain prior remote mutation is ambiguous: stop without changing any Project status. Only when both in-flight sets are empty may selection use configured Priority and then Project order.

## Gates

1. Validate that the issue digest matches the issue review subject digest and that the review is an issue `PASS`. Move an unambiguous Project item to active and create a dedicated branch from the current base.
2. Delegate the complete issue contract, digest, repository state, exact commands, and unrelated changes to a fresh planner. Validate the returned plan contract, its issue digest, and its own digest.
3. Delegate the exact plan and issue contract to a fresh reviewer. Continue only when a plan `PASS` review names the current plan digest. Corrections invalidate the prior plan digest and review. Stop after two correction rounds.
4. Delegate the complete issue, reviewed plan, their digests, repository state, unrelated changes, exact commands, and publication prohibitions to the implementer.
5. After each material change, compute the current change digest and invalidate every earlier verification or change review. Run focused checks and the configured verify command, then validate a structured verification contract whose subject and change digests match the current issue or plan and exact current change.
6. At the review or pull-request boundary, move an unambiguous Project item to review. Obtain a fresh change review whose subject digest matches the current change digest. `CHANGES_REQUIRED` returns stable findings to implementation and requires a new change digest, verification contract, and review. Stop after three fix rounds.
7. Stage only intended files. Before commit, require matching current issue, plan, verification, and review digests. Commit, compare the committed tree digest with the reviewed and verified change digest, and invalidate and recreate verification and review evidence on any difference. Push only after integrity matches, then open or update the linked pull request.

## CI repair

Observe required CI against the pushed commit. For each actionable failure, run this complete sequence:

1. delegate the failure and current contracts to implementation;
2. stage only the repair;
3. create and validate a new local verification contract for the repair's change digest;
4. obtain a fresh change `PASS` review for that same digest;
5. commit the reviewed repair;
6. compare post-commit integrity and recreate evidence if it differs;
7. push and observe CI again.

Allow at most two CI repair cycles. Unavailable, skipped, ambiguous, or still-failing CI after the second cycle blocks delivery.

## Completion and blockers

Before merge, validate that the current issue, plan, verification, final review, committed tree, and pull-request head digests all match. Require green required CI and a mergeable pull request. If automatic merge is enabled, squash merge and move the item to done. Otherwise stop at the green reviewed pull request for a human merge.

On a terminal workflow blocker, preserve branch and pull-request state and record the issue, stage, evidence, digest set, and repair counts. Move an unambiguous Project item to the configured blocked status only when the failed transition is known not to be partial and the status mutation itself can be verified. If remote state is ambiguous, report the blocker without mutating status.

Never force push, rewrite a published branch, bypass protection, use an administrative merge, delete branches, deploy, publish packages, widen permissions, or retry an ambiguous remote mutation.
