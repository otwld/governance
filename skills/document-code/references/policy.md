# Canonical Changed-Code Documentation Policy

## Requirement

For every added or materially changed maintained JavaScript/TypeScript declaration,
variable, callback, and test callback, provide useful semantic documentation through
its own JSDoc/comment or one clearly associated owning comment. This applies whether
the item appears public, private, simple, complex, named, anonymous, production, or
test-only.

Useful documentation records at least one fact beyond syntax: responsibility,
behavioral contract, domain meaning, invariant, units, source of truth, lifecycle,
side effect, mutation, ordering, failure, security boundary, test behavior, oracle,
or design rationale. Names and types may carry part of the contract but do not waive
this selected documentation requirement.

## Material change

An item is materially changed when the current diff changes its behavior, contract,
responsibility, lifetime, side effects, error semantics, type relationship, algorithm,
or the meaning of values it owns. Formatting-only edits and a mechanical rename with
identical semantics are not material. An item is still in scope if old lines survive
but the current change alters their semantics.

## Complete narrow exception list

Only these structural cases are exempt:

1. import declarations and pure re-export declarations;
2. function/method parameters whose semantics are documented by the owning
   declaration;
3. destructuring aliases whose semantics are documented by the owning declaration or
   variable comment;
4. loop bindings and catch bindings whose role is documented by the owning loop/catch
   comment or enclosing declaration;
5. generated, vendored, minified, or machine-produced output whose maintained source
   or generator is documented instead;
6. an unchanged inherited implementation when only the inheriting declaration or
   metadata changes and its owning declaration documents that relationship;
7. multiple purely syntactic bindings covered by one clearly associated owning
   comment that documents all of their shared semantics.

There are no blanket exceptions for trivial callbacks, test callbacks, framework
hooks, private declarations, obvious variables, short functions, or familiar syntax.
If one owning comment is used, its placement and wording must make ownership
unambiguous; proximity alone is insufficient.

## Historical boundary

Untouched historical declarations are outside review because this policy governs the
current semantic change, not repository-wide remediation. Do not edit them solely to
increase comment coverage. If the current change materially alters an historical
item, it enters scope. If an untouched stale comment makes the changed behavior
unsafe or false, report that conflict and correct the claim needed by this change.

## TypeScript, JavaScript, tests, and external docs

In TypeScript, prefer the compiler as the single type-syntax source. Use prose for
semantic constraints and derive related types with `typeof`, `keyof`, indexed access,
utility types, or canonical exports rather than restating shapes in JSDoc.

In JavaScript, use JSDoc tags when accurate type/contract data improves editor or
checker behavior. Document thrown/rejected failures, optional/default semantics,
mutation, callback timing, units, and object contracts where applicable.

Test names are the owning behavioral documentation for test callbacks when they state
the complete behavior. Add comments for non-obvious fixture purpose, independent
oracle, timing, setup, or regression cause. Helper declarations and variables in test
files follow the same everything-changed rule.

Update maintained external documentation for changed public behavior, APIs/types,
configuration/schema, examples, architecture/ownership, operations/recovery,
observability, or security. An internal change may need no external update only after
the relevant docs are checked and remain accurate.

## Source guidance

- JSDoc documentation: <https://jsdoc.app/>
- TypeScript JSDoc reference: <https://www.typescriptlang.org/docs/handbook/jsdoc-supported-types.html>
- TypeScript declaration reference: <https://www.typescriptlang.org/docs/handbook/declaration-files/by-example.html>
- Google TypeScript style guide: <https://google.github.io/styleguide/tsguide.html#comments-documentation>
- eslint-plugin-jsdoc: <https://github.com/gajus/eslint-plugin-jsdoc>
- Martin Fowler, "Code As Documentation": <https://martinfowler.com/bliki/CodeAsDocumentation.html>
