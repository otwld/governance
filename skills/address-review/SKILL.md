---
name: address-review
description: Use ONLY when implementing a concrete set of review findings against an exact change digest; validate each finding before editing, address one at a time, and reverify before rereview.
license: MIT
compatibility: OpenCode with repository edit and test access
---

# Address Review Findings

Review feedback is technical input, not authority to bypass evidence. Do not offer
performative agreement or implement suggestions blindly.

## Inputs and gate

Require the full review contract, exact reviewed change digest and boundary, issue
and plan contracts, verification evidence, repository instructions, and current
tree. Require valid `.opencode/project.json` and every configured document; route
absent/invalid configuration to `setup-node-project`. Use read-only `governance_check` action `contract` for issue/plan and action
`change_boundary` `stage-inspect` evidence supplied by the orchestrator for the pre-edit review;
require matching full base/tree OIDs and digest. The implementer cannot invoke this
orchestrator-only action and must not stage or alter the index. If the boundary moved,
findings are unclear, IDs duplicate,
or a requested correction conflicts with the approved contract, stop and ask for
clarification or fresh review before partial implementation.

## Validate and disposition every finding

For each stable finding ID, inspect its cited line, surrounding code, tests, history,
and contract. Record one disposition:

- `ACCEPTED`: evidence reproduces the defect and correction is in scope.
- `ACCEPTED_WITH_ADJUSTMENT`: defect is valid but a smaller repository-consistent
  correction is safer; explain the adjustment.
- `REJECTED`: evidence shows the premise, reachability, impact, or correction is
  wrong; cite the proof and do not edit merely to appease the review.
- `BLOCKED`: missing context or product/architecture decision prevents safe action.

No "great point" or "you're right." State what evidence established and what action
follows. Escalate contradictory findings rather than choosing whichever is easiest.

## Implement one finding at a time

Order blockers/security/correctness first, then bounded fixes, then larger structural
work. For each accepted finding: add or refine a behavior-level regression when
feasible, prove the red reason, make the smallest correction, run its focused check,
and inspect the diff before moving on. Do not batch unrelated findings or refactor
nearby code. Preserve review IDs in the disposition log, not production comments.

After all dispositions, run focused checks without staging. Return a review-ready
handoff to the orchestrator containing dispositions, changed paths, tests, exact
commands/outcomes, unresolved risk, and evidence that the implementer did not mutate
the index (correction bytes remain unstaged relative to the reviewed index). The
implementer does not request, delegate, or perform review and does not publish
`workflow_state`. The orchestrator stages intended files, obtains the new staged
change digest through `change_boundary` `stage-inspect` after proving no unstaged
tracked or untracked nonignored files, runs/obtains `verify-change`, and requests a
fresh `review-change`. Old verification and review cannot pass the new bytes. Never
commit, push, resolve remote threads, or claim a fresh verdict from the implementer.

## Anti-patterns

- Agreeing socially instead of validating technically.
- Implementing understood items while silently skipping unclear related items.
- Treating reviewer-suggested architecture as mandatory without contract evidence.
- Changing tests to accept incorrect behavior or deleting coverage.
- Fixing all findings before any focused check.
- Reusing the prior digest, verification, or verdict.
