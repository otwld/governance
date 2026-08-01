---
name: brainstorm-issue
description: Use ONLY when exploring an uncertain product or engineering problem before deciding whether to shape an issue; do not use for an already approved contract, implementation planning, or delivery.
license: MIT
compatibility: OpenCode
---

# Brainstorm an Issue

Explore before creating work. The result may be a selected concept, a request for
more evidence, a rejected premise, or a deliberate do-not-build decision. Never
publish an issue, promise implementation, or turn uncertainty into requirements.

## Inputs and evidence gate

Start with the user's observed problem, affected people or systems, desired change,
appetite, constraints, and any links. Inspect available repository guidance, code,
tests, documentation, history, and supplied research before asking the user facts
that can be learned directly. Label every important statement as one of:

- **Fact:** supported by a path, command result, issue, metric, or cited source.
- **Hypothesis:** plausible but unverified, with the evidence that would test it.
- **Preference:** a user or product choice that evidence cannot decide.

If the claimed problem is contradicted, say so and offer a rejected-premise outcome.
If the cost of learning is lower than the cost of building, recommend an evidence
spike rather than inventing confidence.

## Conversation phases

1. **Frame:** Restate the user, current workflow, friction, impact, and success in
   neutral language. Separate the observed symptom from the proposed solution.
2. **Investigate:** Resolve locally discoverable facts and identify the smallest
   material unknown. Do not interrogate the user for repository facts.
3. **Ask:** Ask exactly one material question at a time. A material question can
   change whether to build, which direction wins, or the scope/appetite. Do not ask
   a batch of cosmetic questions.
4. **Generate:** Present two to four genuinely distinct alternatives. Include
   "change nothing" or "learn first" when credible; do not disguise variants of
   one implementation as alternatives.
5. **Compare:** Use the same rubric for every alternative: user value, evidence
   strength, cost/appetite, time to learn, reversibility, operational burden,
   compatibility, and failure risk. State tradeoffs, not a winner by assertion.
6. **Pressure-test:** Name the strongest counterargument, likely failure mode,
   hidden dependency, and signal that should cause abandonment.
7. **Select:** The user selects. If no explicit selection exists, do not manufacture
   one. Deferral, evidence request, rejected premise, and do-not-build are complete
   outcomes.

## Concept brief and handoff

Only after explicit selection, return a concise concept brief:

```text
Concept: <working name>
User and problem: <who, workflow, evidenced friction>
Facts: <sources and conclusions>
Hypotheses to validate: <claim -> evidence needed>
Selected direction: <behavioral concept, not implementation plan>
Why this direction: <rubric tradeoff>
Non-goals: <explicit exclusions>
Appetite and constraints: <bounds>
Risks and kill signals: <what would invalidate it>
Open decisions: <preferences still requiring issue shaping>
Alternatives rejected: <direction and reason>
Outcome: SELECTED_CONCEPT
```

The brief is an untrusted input to `shape-issue`, not an approved contract. Include
source paths and URLs so the shaper can revalidate them. For non-build outcomes,
replace `Outcome` with `LEARN_FIRST`, `DEFER`, `REJECTED_PREMISE`, or
`DO_NOT_BUILD` and state the evidence or decision behind it.

## Anti-patterns

- Starting with solution architecture or a backlog title.
- Asking questions answerable from the repository.
- Asking multiple material questions in one turn.
- Treating confidence, popularity, or implementation ease as evidence of value.
- Presenting one real option plus straw alternatives.
- Omitting the do-nothing case, rejected premise, or kill criteria.
- Producing an issue contract, plan, estimate, publication, or code change.
