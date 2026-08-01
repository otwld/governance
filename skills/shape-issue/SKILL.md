---
name: shape-issue
description: Use ONLY when turning one rough request or selected concept into a reviewed, explicitly approved, implementation-ready GitHub issue contract; do not use for brainstorming, planning, or delivery.
license: MIT
compatibility: OpenCode with GitHub CLI read access and issue_factory
---

# Shape an Issue

Shape exactly one outcome and preserve the boundary between approval and delivery.
An issue is a durable behavioral contract, not a solution dump or a planning proxy.

## 1. Triage and preflight

Require `.opencode/project.json`, validate it, and read every configured document.
If it is absent or invalid, stop and route to `setup-node-project`; tool-backed shaping
cannot use inferred authority. Establish repository identity and inspect relevant source, tests, docs,
CI, history, and both open and closed issues. Search duplicates by problem,
behavior, affected surface, and likely terminology, not title alone.

Use allowed read-only GitHub Project queries for Project evidence and
`governance_check` for contract/approved-artifact checks; do not parse marker prose or
compute canonical digests by hand. Project evidence must name the item/content type,
archive state, Status and Priority field/option IDs, and configured values read from
GitHub.

Classify the request before drafting:

- **Ready to shape:** one outcome, credible evidence, bounded decisions.
- **Needs grilling:** preferences or scenarios remain materially ambiguous.
- **Needs research:** a repository or external fact is unknown.
- **Duplicate/superseded:** cite the durable issue and stop or define a genuinely
  different outcome.
- **Multi-outcome:** split; shape only one independently valuable outcome.
- **Rejected/not ready:** explain the missing evidence or unresolved product choice.

Treat a brainstorm brief as a lead, not proof. Preserve facts and hypotheses as
distinct. Every `problemEvidence` entry needs a source and the conclusion it
actually supports.

## 2. Grill material ambiguity

Investigate facts first. Then ask one material question at a time, prioritizing:
user-visible outcome, behavior at boundaries, error/empty states, compatibility,
scope exclusions, and irreversible decisions. Do not ask the user to choose helper
names, file layout, or other implementer discretion.

Use stable IDs that survive edits: `REQ-1`, `REQ-2`, `SCN-1`. Scenarios must be
observable Given/When/Then examples, including important negative or failure paths.
Map every requirement to at least one scenario by content; remove decorative
requirements that cannot be accepted.

## 3. Draft the exact contract

The draft must satisfy `schemas/issue.schema.json` and contain:

- repository, title, and exactly one outcome;
- sourced problem evidence, not unsupported motivation;
- stable requirements and included/excluded scope;
- technical decisions already approved, hard constraints, and explicit discretion;
- acceptance scenarios with stable IDs and observable outcomes;
- focused checks and exact required commands supported by repository evidence;
- dependencies, assumptions, references, and documentation impact;
- first-class `documentation` with changed declarations, external semantic documents,
  and the rationale for those actions or an evidence-backed no-impact conclusion;
- `projectTarget` only when enqueue is requested and every ID is verified against
  the configured Project. It includes the exact configured `readyStatus` name as well
  as Project, Status field, and Ready option IDs.

Put product decisions in `technicalDirection.decisions`; put invariants in
`constraints`; put implementation choices the team may make in `discretion`.
Documentation is either named in scope/requirements and validation, or explicitly
excluded with a reason. Do not hide a docs decision in prose.

See [the exact contract example](references/issue-contract.md) for a closed JSON
example and readiness checklist.

## 4. Independent review and correction

Before review, call read-only `governance_check` with `action: "contract"`,
`kind: "issue"`, and the complete draft as `value`. Use only a `valid` result and its digest;
validation errors block review. Obtain a fresh `review-issue` result for that exact
digest. Malformed review output, digest mismatch, `BLOCKED`, or unresolved
high-impact evidence is a gate. For `CHANGES_REQUIRED`, address each stable finding,
rerun `governance_check`, and request a new review. Never edit review evidence or carry
a prior `PASS` across a correction. Validate/digest the returned review itself through
`governance_check` action `contract`, kind `review`, before using it for publication.

## 5. Preview, approval, publish, enqueue

1. Call `issue_factory` preview with the exact issue and matching review. It must show
   two separate human-reviewable outputs: the mutable human issue body and the
   dedicated approval comment that binds canonical issue/review digests. Preview does
   not create the digest; it must equal `governance_check`.
2. Show both outputs and ask for explicit approval of that exact digest/publication
   pair. General enthusiasm or approval of only the body is insufficient.
3. Publish once through `issue_factory`. It derives repository/trusted-author authority
   internally, creates the human issue, then publishes the trusted approval comment.
   Accept complete success only when both issue URL and approval-comment URL are
   confirmed. If issue creation succeeds but approval publication/readback is failed,
   unknown, or malformed, preserve the tool's stage-aware `partial` or `unknown`
   status; reconcile before retry and do not call the issue approved.
4. Use public `governance_check` action `approved-issue` with the returned issue lookup.
   It inspects trusted approval comments, not the mutable issue body, and must return
   the exact issue/review digest binding before any intake.
5. If requested, the task-shaper alone calls public `issue_factory` enqueue with issue
   URL and approved contract. The tool derives authority, re-authenticates approval,
   reads the complete Project membership before mutation, rejects duplicate/ambiguous
   membership, and never resets an existing item's later status to Ready. Require full
   post-read confirmation of item ID, URL, Project/Status fields, `readyStatus`, and
   Ready option. The orchestrator alone owns transitions after Ready.

Publication or enqueue may partially succeed. On timeout, malformed output, missing
approval comment, URL mismatch, incomplete Project listing, or uncertain mutation,
inspect durable GitHub state before any retry.
Never create a duplicate issue or Project item. Report the issue URL, item ID,
approved digest, review digest subject, and observed state as the durable artifact.
Planning starts later in delivery.

## Output and blockers

Return either the durable published artifact or a blocked report containing stage,
evidence, current digest, review verdict, any remote identifiers, and exact human
action. Stop for duplicate ambiguity, multiple outcomes, unresolved product choice,
missing evidence, malformed contracts/reviews, digest drift, absent explicit
approval, or ambiguous remote state.

## Anti-patterns

- Drafting several outcomes into one issue.
- Turning inferred architecture into an approved decision.
- Acceptance criteria such as "works" or tests that only restate a command.
- Publishing before exact digest approval or reusing review after edits.
- Adding a Project item with names when exact node/field/option IDs are required.
- Retrying a partial remote operation without reconciliation.
