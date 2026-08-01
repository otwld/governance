# OpenCode Governance

OpenCode Governance is a Project-backed issue factory and sequential delivery workflow. Optional brainstorming leads to one reviewed, explicitly approved GitHub issue. The default orchestrator then coordinates planning, implementation, independent review, verification, pull request checks, and squash merge. GitHub is durable state.

## Product

- `/brainstorm`: explore without creating work.
- `/issue`: shape, review, approve, publish, and optionally enqueue one issue.
- `/run-issue`: deliver exactly one approved issue.
- `/run-project`: process ready Project issues one at a time.
- `/review`: independently review an issue, plan, or change.
- `/setup-project`: inspect and configure an existing Node project.

The task-shaper alone may publish issues. The orchestrator alone may perform delivery Git and GitHub mutations. The implementer edits and tests but cannot publish or delegate. Planner, reviewer, and researcher are read-only. Every agent denies tools by default and enables only its required surface.

The canonical detailed lifecycle is [deliver-issue](skills/deliver-issue/references/lifecycle.md). See [Design](docs/design.md), [Contracts](docs/contracts.md), and [Operations](docs/operations.md) for supporting policy.

## Install

Node.js 20 or later is required. From a trusted checkout:

```sh
npm install --global .
governance install-global
governance install-global --apply
```

The installer targets the standard OpenCode config home (`~/.config/opencode`) and places skills in its `skills` directory. It also installs the small runtime modules used by the custom tool. Dry run is the default. A managed ownership manifest records only asset path, kind, and hash. Managed unchanged files may be replaced or removed; local modifications are conflicts and are never overwritten or deleted. Apply rolls back on failure. The installer does not edit `opencode.json`; merge `templates/opencode.json` manually and restart OpenCode.

## Project contract

`.opencode/project.json` records the `owner/repository`, exact verify and optional install commands, purposeful document paths, optional Project status names and verified Project, field, and option IDs, priority mapping, and squash policy. `/run-project` requires the optional Project mapping to include `priorityField`; `/run-issue` does not. Values must come from repository and GitHub evidence. Validate it with:

```sh
governance validate-project /path/to/repository
```

## Distribution development

`governance.manifest.json` is the canonical roster, mode, command mapping, skill, tool, authority, and installation source. Validate this checkout with:

```sh
npm run check
node bin/governance.mjs validate-project /workspace/governance
```

The package is private. No package publication or deployment workflow is provided.

## License

[MIT](LICENSE)
