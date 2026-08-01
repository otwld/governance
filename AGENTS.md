# Governance Repository Instructions

## Scope

Maintain the public OpenCode governance distribution. Read the relevant agents,
commands, skills, schemas, templates, implementation, and tests before editing.
Make the smallest complete change required by the task and preserve established
role separation and permission boundaries.

- Do not add speculative configuration, commands, dependencies, abstractions, or
  automation.
- Keep documentation consistent with implemented behavior and use ASCII text.
- Preserve required frontmatter and stable names for agents, commands, and skills.
- Do not overwrite unrelated work, weaken tests, hide failures, or update expected
  output only to make a check pass.
- Do not commit, push, change GitHub state, or deploy unless a task explicitly
  authorizes it.

## Documentation and provenance

Changed behavior must leave all configured semantic documentation accurate,
including API, contract, architecture, operations, and user guidance. Apply the
canonical [document-code policy](skills/document-code/references/policy.md) to
EVERY added or materially changed declaration, variable, callback, and test callback
in maintained JavaScript or TypeScript. Documentation must explain useful semantics,
not narrate syntax. The only exceptions are generated/vendored/minified/machine
output, imports/reexports, parameters covered by their owner, destructuring aliases,
loop/catch bindings, unchanged inherited implementation, and syntax covered by one
owning comment. Record each exception with a file/line pointer and short reason.
Untouched historical code does not block the current change. Keep external
documentation current or record the evidence-backed no-impact conclusion. Preserve
upstream copyright, license, and
attribution notices. Any adapted upstream material must identify its source and use
a compatible license; do not import unattributed procedures or prose.

## Validation

For behavior changes, add or update focused tests in `test/`. Run the narrowest
relevant test first, then the repository check:

```sh
npm run check
```

The check runs the Node test suite and distribution validator. Confirm the intended
tests executed and were not skipped. For project configuration changes, also run
`node bin/governance.mjs validate-project <repository>` against a representative
fixture or target repository. Report exact commands, outcomes, and anything not run.
Deterministic evaluation-fixture checks prove structure, not model behavior; report
manual configured-model runs separately and never imply they ran when they did not.
