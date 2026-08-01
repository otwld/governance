---
name: document-code
description: Use whenever maintained JavaScript or TypeScript is added or materially changed; review and document every changed declaration, variable, callback, and test callback without requiring a separate documentation request.
license: MIT
compatibility: OpenCode with JavaScript or TypeScript repository access
---

# Document JavaScript and TypeScript Code

## Selected policy: everything changed

Load this skill automatically whenever maintained `.js`, `.mjs`, `.cjs`, `.jsx`,
`.ts`, or `.tsx` is added or materially changed. The user selected documentation for
**everything in the changed semantic boundary**, not only public or non-obvious code.
The canonical rules and complete exception list are in [the policy](references/policy.md).
This root explains how to apply them; it does not narrow them.

Every added or materially changed maintained declaration, variable, callback, and
test callback needs useful documentation. Material change includes behavior,
contract, responsibility, lifetime, side effects, error semantics, type relationship,
or algorithm changes. Documentation must explain purpose, contract, domain meaning,
invariant, lifecycle, side effect, failure, or rationale; syntax narration is not
useful documentation.

Untouched historical declarations are excluded because this is a review-only change
policy, not an unbounded backfill. Their age is not an exemption if the current change
materially alters them. Historical gaps may be noted separately but cannot block the
current change unless the new code depends on a false or dangerous existing claim.

## Workflow

1. Establish the exact diff and enumerate every added/materially changed maintained
   declaration and binding: functions, classes, methods, fields, types, constants,
   variables, callbacks/closures, and test callbacks.
2. Classify only the narrow exceptions permitted by the canonical policy. Record the
   owner comment when one comment documents several syntactic bindings.
3. Read repository style, lint configuration, surrounding documentation conventions,
   public API docs, architecture, and operations guidance. Preserve valid attribution.
4. Add useful JSDoc or an owning semantic comment for every in-scope item. Clear test
   names document the test callback's behavioral purpose; add comments/JSDoc needed
   to cover fixtures, oracle, setup, effects, or regression intent.
5. In TypeScript, let TypeScript own type syntax. Document semantics and derive related
   types from canonical declarations rather than duplicating annotations in tags.
6. In JavaScript, use accurate JSDoc tags where they provide contract and tooling
   value, including parameters, returns, throws, templates, callbacks, and shapes.
7. Update maintained external semantic docs whenever public behavior, API/config,
   architecture, operations, security, or examples change. Code comments are not a
   substitute for those documents.
8. Re-enumerate the final diff so callbacks or variables added during correction are
   not missed. Run focused documentation/lint/type checks and required verification.

Use [the examples](references/examples.md) to distinguish useful ownership comments
from redundant narration.

## Review output

Return the exact change boundary; complete in-scope item inventory; documentation
owner for each item; exceptions with the canonical category and location; external
docs changed or checked; exact commands/outcomes; and findings with file/line evidence.
A missing useful owner for any in-scope item is a finding. Do not demand edits to
untouched historical declarations.

## Anti-patterns

- Loading only when the user separately requests documentation.
- Restricting comments to exported, complex, or supposedly non-obvious code.
- Treating callbacks, test callbacks, local variables, or framework code as blanket
  exceptions.
- Comments such as "increments count" or "callback for map" that narrate syntax.
- TypeScript JSDoc types that duplicate annotations and can drift.
- One file-level paragraph claimed as ownership for unrelated bindings.
- Repository-wide historical churn outside the changed semantic boundary.
