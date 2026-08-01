# Agent Guidance

## Scope

Read applicable repository instructions before editing. Make only the smallest
complete change required by the task, preserve existing architecture, and do not
overwrite unrelated work.

## Context

- Repository guidance: `<path or not documented>`
- Architecture or ownership: `<path or not documented>`
- Task-specific constraints: `<verified context>`

## Validation

- Focused check: `<verified repository command>`
- Required final check: `<verified repository command>`

## Dependency updates

Update only an existing direct root `dependencies` or `devDependencies` entry. Honor
the exact pinned `packageManager`: npm must resolve from `PATH` at that version;
pnpm and Yarn Berry use Corepack at the pinned version. Do not target workspaces,
transitive dependencies, Bun, arbitrary commands, or package scripts.

## Documentation policy

Every changed behavior must leave configured user, API, architecture, operations,
and contract documentation accurate. Apply the canonical `document-code` policy to
EVERY added or materially changed declaration, variable, callback, and test callback
in maintained JavaScript or TypeScript. Useful documentation explains semantics; it
does not narrate syntax. The only exceptions are generated/vendored/minified/machine
output, imports/reexports, parameters covered by their owner, destructuring aliases,
loop/catch bindings, unchanged inherited implementation, and syntax covered by one
owning comment. Record each exception with a file/line pointer and short reason.
Untouched historical code does not block the current change. Keep external
documentation current or record the evidence-backed no-impact conclusion.

Replace placeholders only with commands and paths defined by this repository. Do
not invent conventional commands. Confirm intended tests ran rather than being
skipped. Report changed behavior and files, acceptance evidence, exact commands and
outcomes, skips, assumptions, blockers, and unresolved risks. Preserve upstream
license and provenance notices; content adapted from upstream projects must identify
its source and compatible license.
Deterministic evaluation-fixture checks prove structure, not model behavior. Report
manual configured-model evidence only when it actually ran.
