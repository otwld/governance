---
name: review-change
description: Use ONLY for an independent, read-only review of one exact implementation diff against approved issue, plan, verification, and change digests; do not fix, stage, or publish the change.
license: MIT
compatibility: OpenCode with Git and repository read access
---

# Review a Change

Review two dimensions separately: contract compliance asks whether the exact issue
and reviewed plan were implemented; engineering quality asks whether the resulting
code is safe and maintainable. Neither substitutes for the other. The only review
subject is the change; verification is bound evidence in its context, never an
independently reviewed subject.

## Inputs and exact boundary

Require complete issue and plan contracts and digests, matching prior reviews, the
structured verification contract, repository/base/head identifiers, and the exact
staged change digest. Require valid `.opencode/project.json` and all configured
documents; absent/invalid configuration routes to `setup-node-project`. Inspect staged, unstaged, and untracked state, but review only
the intended staged tree returned by orchestrator-only `change_boundary` action
`stage-inspect` with the recorded base. The tool does not stage; it requires no unstaged tracked changes
and no untracked nonignored files, binds full base/tree OIDs, and returns the canonical
change digest. Any unrelated dirty work blocks exact review rather than remaining
outside the digest.
Validate issue and plan digests with `governance_check` action `contract`; inspect the
published issue with public action `approved-issue`, which derives authority internally
and authenticates the dedicated approval comment rather than trusting mutable body text.
A URL, prose summary, partial patch, stale verification, or digest mismatch is
malformed input.
Return `BLOCKED` rather than reviewing a guessed boundary.

## Pass 1: contract compliance

Trace each requirement and acceptance scenario through plan step, changed behavior,
and meaningful test. Check included and excluded scope, approved decisions,
constraints, implementer discretion, docs impact, and exact validation. Flag missing
behavior, accidental product decisions, unrelated changes, or tests that do not
exercise the promised seam.

## Pass 2: engineering quality

Inspect correctness and edge cases, failure handling, security/trust boundaries,
concurrency/state/order, public APIs and types, package/workspace consumers,
performance where material, architecture/ownership, maintainability, and regression
quality. Read surrounding code, not only added lines. Verification success is
evidence that commands ran, not proof that assertions or implementation are sound.

Apply repository docs policy: changed public behavior, configuration, interfaces,
examples, or operations require maintained docs. Internal-only changes may omit docs
only when existing docs remain accurate.

Require plan `documentation.actions`, `.external`, and `.rationale` to match the
staged declarations and semantic documents. A missing changed-code owner is contract
or engineering evidence according to impact, not an optional style note.

## Findings and verdict

Report findings first. Each must have stable ID, severity, exact file/line or
contract location, observed evidence, concrete impact, and smallest safe correction.
Use `low` for bounded maintainability, `medium` for credible defects with limited
impact, `high` for incorrect behavior/security/data/contract gaps, and `blocker` for
an unreviewable boundary or unsafe unresolved condition. Do not report speculative
possibilities without a reachable path.

- `PASS`: both passes succeed and findings is empty.
- `CHANGES_REQUIRED`: at least one evidenced correctable defect.
- `BLOCKED`: exact review cannot complete, with a blocker finding.

Return the schema-valid contract illustrated in [review examples](references/review-examples.md).
Its `subject.kind` is `change`, `subject.digest` is the exact change digest, and its
context binds issue, plan, change, and verification digests. Validate and digest the
review with read-only `governance_check` action `contract`, kind `review`, before handoff. Any material correction invalidates
the verification and review and requires a new change digest.

## Anti-patterns

- Reviewing only contract checkboxes or only generic code quality.
- Trusting a green suite without reading test assertions and changed paths.
- Commenting on unrelated historical code unless the change activates the defect.
- Style findings unsupported by repository policy.
- Fixing code, staging, committing, or saying `PASS` with findings.
- Reviewing a working-tree summary or dirty tree instead of the exact
  `change_boundary` result.
