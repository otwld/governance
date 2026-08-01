---
name: test-change
description: Use when adding or changing behavior in maintained code and tests should drive or lock down the change through observable seams; do not use to inflate coverage or test source text.
license: MIT
compatibility: OpenCode with repository edit and test access
---

# Test a Change

Tests are executable behavioral evidence. Prefer red-green-refactor when a stable
behavior seam and runnable focused command exist; do not force ceremony when the
repository cannot execute a meaningful red safely.

## Find the behavior seam

Read the contract, existing tests, public entry points, and nearest analogous test.
Choose the narrowest seam that remains meaningful across internal refactoring: a
public function, API/CLI boundary, component behavior, package export, parser,
validator, or other owned interface. State the production change that would make
the test fail before writing it. Expected values must come from the contract, worked
example, fixture, or independent oracle, not the implementation's own algorithm.

## Vertical red-green-refactor slices

Work one behavior at a time:

1. **Red:** add the smallest test for one observable scenario, usually a tracer path
   through the real seam. Run the exact focused command.
2. **Prove red reason:** confirm the intended test was discovered and failed because
   behavior is absent/wrong, not because of syntax, fixture, import, environment, or
   an unrelated baseline failure. Preserve the test name and diagnostic.
3. **Green:** make the smallest production change that satisfies that behavior.
4. **Prove green:** rerun the same command; confirm the intended test and nearby
   suite execute with no skips.
5. **Refactor:** only while green, improve names/duplication without adding behavior;
   rerun after refactoring.
6. Repeat for the next scenario, letting each completed slice inform the next.

Do not batch imagined tests horizontally before implementation. Add negative, error,
boundary, and compatibility scenarios according to risk, not line coverage.

## Meaningful test rules

- Name behavior and context, not implementation details.
- Exercise real production code and assert user/domain-observable outputs or effects.
- Use mocks only at true slow, destructive, nondeterministic, or external boundaries;
  assert the behavior around the boundary, not merely mock call counts.
- Keep setup proportionate and fixtures explicit. Large setup is design feedback.
- A regression test must fail on the buggy behavior and pass on the root fix.
- Confirm zero-test, filtered-out, todo, pending, and skipped results are not pass.

Avoid source-text assertions (`readFile(...).includes(...)`), snapshots accepted
without semantic review, tests of private helper names, tautological expected-value
calculation, and production hooks added only to expose internals. Do not weaken or
delete existing tests merely because they resist the desired implementation.

## Exceptions and output

Test-first may be infeasible for generated code, pure documentation/configuration,
throwaway exploration, an unavailable external system, or behavior with no safe
automatable seam. The exception must be supported by repository policy or explicit
approval. Record why red was infeasible, the alternative evidence used, and remaining
risk; still add regression coverage at the nearest meaningful seam when possible.

Return scenario-to-test mapping, red command and expected failure evidence, green
command and execution count, production paths changed, mocks and justification,
exceptions, and the next verification step. Run applicable repository checks after
all slices. During governed issue delivery, hand the final staged boundary to
`verify-change`; ordinary changes do not require that durable contract workflow.

## Anti-patterns

- Test-after that passed on first run, reported as proof the test can catch the bug.
- All tests first, all implementation later.
- Mocking the subject under test or asserting only collaborator calls.
- Testing source strings, formatting, or private helpers instead of behavior.
- Updating snapshots to green without explaining the behavioral delta.
- Equating coverage percentage with contract coverage.
