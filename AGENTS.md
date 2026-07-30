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
