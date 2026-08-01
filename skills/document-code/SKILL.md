---
name: document-code
description: Use when maintained JavaScript or TypeScript changes need useful code or external documentation.
license: MIT
---

# Document Code

Keep documentation proportional to the change.

- Update user, API, architecture, operations, and contract documentation when their
  described behavior changes.
- Add comments or JSDoc for public interfaces, surprising behavior, invariants,
  lifecycle constraints, and failure semantics.
- Prefer clear names and straightforward code over comments that narrate syntax.
- Do not require comments for every local variable, callback, import, or test setup.
- Do not maintain line-number inventories of documentation exceptions.
- Preserve upstream attribution and compatible license notices.

Review the final diff for stale semantic documentation, then run the repository's
normal documentation, type, lint, or test checks that apply to the changed surface.
