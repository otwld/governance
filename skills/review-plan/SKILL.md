---
name: review-plan
description: Use ONLY for an independent, read-only review of one exact implementation plan against its approved issue digest and repository evidence; do not edit or execute the plan.
license: MIT
compatibility: OpenCode with repository read access
---

# Review a Plan

## Integrity gate

Require complete issue and plan JSON, claimed issue and plan digests, the matching
issue `PASS` review, repository/base state, and a valid `.opencode/project.json`.
Read every configured document; if configuration is absent/invalid, stop and route to
`setup-node-project`. Recompute both
digests and validate the plan with the issue context through read-only
`governance_check` action `contract` (`kind: "plan"`, plan `value`, and
`{ "issue": <approved issue> }` context). When the issue is published, first use
public `governance_check` action `approved-issue` with the issue lookup; require its
internally authenticated approval-comment digest and ignore/report unauthorized comments.
Truncated JSON, unknown paths,
digest mismatch, missing issue review, or inaccessible required evidence is not an
invitation to reconstruct the plan: return a schema-valid `BLOCKED` review.

## Review rubric

- **Contract coverage:** every requirement and acceptance scenario is addressed;
  no step crosses excluded scope or changes the approved outcome.
- **Traceability:** stable step IDs reference real scenario IDs and every step has
  exactly mapped validation evidence.
- **Repository grounding:** actions identify exact paths and interfaces/symbols;
  ownership, package boundaries, analogous patterns, and generated surfaces are
  based on inspected code.
- **Vertical sequencing:** each step delivers a coherent behavior slice in dependency
  order. Tests, implementation, and docs are not isolated horizontal batches.
- **Test quality:** checks prove behavior and important failures at useful seams;
  commands exist and the configured final command is preserved verbatim.
- **Architecture and discretion:** the plan follows established boundaries without
  speculative abstraction and preserves choices the issue left open.
- **Docs and compatibility:** maintained external docs/types/examples and consumers
  are handled through first-class `documentation.actions`, `.external`, and
  `.rationale`; compatibility claims name what stays stable or changes.
- **Risk and rollback:** material failure modes have mitigation and rollback is
  executable, including stateful or irreversible effects.

Use severity consistently: `low` bounded maintainability, `medium` incomplete step
or evidence likely to cause rework, `high` missing scenario/wrong architecture/scope
violation, `blocker` unverifiable subject or unresolved product decision. Findings
must contain stable IDs, exact locations, evidence, impact, and smallest safe plan
correction. Do not rewrite the plan yourself.

`PASS` requires no findings. `CHANGES_REQUIRED` requires correctable findings.
`BLOCKED` requires at least one blocker. Return a valid review contract such as the
[examples](references/review-examples.md). Validate and digest that review itself with
read-only `governance_check` action `contract`, kind `review`, before handoff. A corrected plan gets a new digest and
fresh review; never bless a digest by saying "pass after fixes."

## Documentation policy

A plan must update maintained user/developer documentation when behavior, public
interfaces, configuration, examples, or operational steps change. A no-doc change
is acceptable only when repository evidence shows the modified behavior is internal
and existing docs remain true. Missing docs are severity based on user impact, not
automatically low.

## Anti-patterns

- Reviewing intentions instead of exact JSON and digest.
- Passing a file list with no symbols, behavior, or scenario mapping.
- Demanding personal architecture preferences unsupported by repository constraints.
- Ignoring invalid commands, zero-test risk, docs, consumers, or rollback.
