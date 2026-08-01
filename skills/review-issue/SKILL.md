---
name: review-issue
description: Use ONLY for an independent, read-only readiness review of one exact issue contract and digest before approval or publication; do not shape, rewrite, or publish the issue.
license: MIT
compatibility: OpenCode with repository read access
---

# Review an Issue

## Required inputs and malformed handling

Require the complete issue JSON, claimed canonical digest, repository identity, and
the evidence bundle used to shape it. Require valid `.opencode/project.json` and read
every configured document; if absent/invalid, stop and route to `setup-node-project`.
Recompute the digest and validate the closed
contract through read-only `governance_check` action `contract` with kind `issue` and
the issue as `value`; do not hash or
canonicalize it independently. Read configured project documents and primary
repository evidence. If the
subject is truncated, invalid, mismatched, or unavailable, do not infer intent:
return `BLOCKED` with a blocker finding naming the missing or malformed input.

## Evidence rubric

Review independently; do not merely confirm the draft's prose.

1. **One outcome:** one user-observable result, not bundled projects or an
   implementation activity.
2. **Problem evidence:** each source exists and supports its stated conclusion;
   hypotheses and preferences are not presented as facts.
3. **Duplicates:** open and closed issue searches cover behavior and affected
   surface; overlap is resolved or differentiated.
4. **Requirements and scenarios:** stable unique IDs; precise behavior; important
   success, negative, error, and compatibility cases; observable Given/When/Then.
5. **Scope:** included work is sufficient, exclusions do not contradict acceptance,
   and dependencies/assumptions are explicit.
6. **Direction:** decisions are actually approved, constraints are necessary, and
   implementer discretion is not accidentally consumed.
7. **Validation:** focused checks exercise scenarios; required commands are exact,
   existing, non-mutating repository commands.
8. **Documentation:** first-class `documentation.declarations`, `.external`, and
   `.rationale` cover maintained changed code and semantic docs or justify no impact.
9. **Project target:** when present, owner, number, node, Status field, and Ready
   status name/option IDs match direct read-only GitHub Project evidence.
10. **Readiness:** no unresolved material product decision or unsupported promise.

## Findings, severity, and verdict

Use `low` for bounded clarity/maintainability defects, `medium` for acceptance or
scope gaps likely to cause rework, `high` for wrong behavior/evidence or a material
missing contract path, and `blocker` when review cannot safely establish the subject
or readiness. Every finding needs stable ID, exact contract location, repository
evidence, impact, and the smallest contract-level correction. Do not prescribe an
implementation unless the issue must decide it.

- `PASS`: exact subject is publishable and findings is empty.
- `CHANGES_REQUIRED`: one or more correctable findings; no pass language.
- `BLOCKED`: review cannot complete safely and at least one finding is `blocker`.

Return only a valid `schemas/review.schema.json` contract plus a brief evidence
summary. Before handoff, call read-only `governance_check` action `contract` with kind
`review` and the review as `value`; return its validation result and digest. Use the
[structured examples](references/review-examples.md). Any correction
creates a new issue digest and requires a new review.

## Anti-patterns

- Editing the issue, accepting a near-match digest, or reviewing rendered fragments.
- Treating a test command as proof that acceptance behavior is well specified.
- Passing with advisory findings.
- Filing style preferences as readiness defects.
- Ignoring docs because the implementation is small.
