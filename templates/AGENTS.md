# Agent Guidance

## Project overview

`<verified purpose and repository type; reference manifests instead of copying versions>`

## Scope

Read applicable repository instructions before editing. Make only the smallest
complete change required by the task, preserve existing architecture, and do not
overwrite unrelated work.

## Context

- Repository guidance: `<path or not documented>`
- Architecture or ownership: `<path or not documented>`
- Task-specific constraints: `<verified context>`

## Repository structure

- `<path>`: `<verified responsibility>`

## Development commands

- Install: `<verified command or not applicable>`
- Build or run: `<verified command or not applicable>`
- Test: `<verified command or not applicable>`
- Lint and typecheck: `<verified commands or not applicable>`

## Patterns and conventions

- `<verified architecture, registration, export, generation, or content pattern>`
- `<verified CI, asset, responsive, release, or documentation rule when applicable>`

## Maintenance matrix

| When changing | Also inspect or update |
| --- | --- |
| `<package or source area>` | `<verified dependents, tests, generated outputs, and docs>` |
| `<workflow or configuration>` | `<verified scripts, CI, and operations documentation>` |

Keep only rows supported by actual import, workspace, generation, or release relationships.

## Common pitfalls

- `<evidence-backed failure mode, coupled update, or not documented>`

## Validation

- Focused check: `<verified repository command>`
- Required final check: `<verified repository command>`

## Dependency updates

Update only an existing direct root `dependencies` or `devDependencies` entry. Honor
the exact pinned `packageManager`: npm must resolve from `PATH` at that version;
pnpm and Yarn Berry use Corepack at the pinned version. Do not target workspaces,
transitive dependencies, Bun, arbitrary commands, or package scripts.

## Documentation policy

Keep relevant user, API, architecture, operations, and contract documentation
accurate. Add comments or JSDoc for public contracts and non-obvious invariants, not
for every local binding or callback. Do not maintain line-number exception ledgers.

Replace placeholders only with commands and paths defined by this repository. Do
not invent conventional commands. Confirm intended tests ran rather than being
skipped. Report changed behavior and files, acceptance evidence, exact commands and
outcomes, skips, assumptions, blockers, and unresolved risks. Preserve upstream
license and provenance notices; content adapted from upstream projects must identify
its source and compatible license.
