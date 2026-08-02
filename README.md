# OpenCode Governance

OpenCode Governance is an issue factory and sequential delivery workflow for OpenCode. Optional brainstorming leads to one reviewed, explicitly approved GitHub issue. Its contract and review are bound in a trusted-author approval comment. The default orchestrator can work directly or coordinate planning, implementation, independent review, verification, pull request checks, and squash merge. Canonical digests and trusted workflow comments provide durable, recoverable evidence where that workflow is used.

## Product

- `/brainstorm`: explore without creating work.
- `/issue`: shape, review, approve, publish, and optionally enqueue one issue.
- `/run-issue`: deliver exactly one approved issue.
- `/run-project`: process ready Project issues one at a time.
- `/review`: independently review an issue, plan, or change.
- `/setup-project`: bootstrap or audit evidence-backed OpenCode governance in an existing Node or TypeScript project.

The primary roster is brainstormer, task-shaper, and orchestrator. Planner, implementer, reviewer, and researcher are specialized subagents. Agents have broad development access so they can inspect repositories, use authenticated GitHub commands, diagnose OpenCode, edit, and run checks without searching for permission workarounds. Prompts preserve role intent, while explicit custom-tool permissions retain ownership of issue publication and durable workflow state.

Commands stay thin and route to specialized skills: brainstorming, shaping, planning, delivery, systematic debugging, test and documentation updates, independent issue/plan/change review, setup, research, and verification. The canonical detailed lifecycle is [deliver-issue](skills/deliver-issue/references/lifecycle.md). See [Design](docs/design.md), [Contracts](docs/contracts.md), [Operations](docs/operations.md), [Agent model routing](docs/models.md), and [Skill authoring](docs/skill-authoring.md).

## Install

Node.js 20 or later is required. From a trusted checkout:

```sh
npm install --global .
governance install-global
governance install-global --apply
```

The installer targets `~/.config/opencode`, including the custom tools declared by the distribution. `issue_factory` publishes approved issue intake, `workflow_state` records or inspects durable delivery state, `governance_check` performs read-only integrity checks, `change_boundary` creates immutable Git boundary evidence, and `dependency_update` updates one existing direct root dependency using the pinned `packageManager`. npm must resolve from `PATH` at the exact pinned version; pnpm and Yarn Berry run through Corepack at their exact pins. Public wrappers require OpenCode's supplied directory and discover validated `.opencode/project.json` only within that bounded Git worktree; they never use process cwd as authority. Dry run is the default. A managed ownership manifest records only asset path, kind, and hash; local modifications are conflicts and are never overwritten or deleted. Apply rolls back on failure. The installer does not edit `opencode.json`; merge `templates/opencode.json` manually and restart OpenCode.

## Project contract

`.opencode/project.json` records the `owner/repository`, trusted GitHub comment authors, exact verify and optional install commands, purposeful document paths, optional verified Project/status mapping, ordered `{name, optionId}` Priority options, explicit missing-priority placement, and squash policy. Project mode reads paginated GraphQL values by configured field ID and always excludes drafts and archived items. Use [the minimal non-Project template](templates/project.json) or [the Project-backed evidence example](templates/project.github.example.json); every placeholder must be replaced from repository and GitHub evidence. Validate it with:

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

## Repository setup

`/setup-project` inventories OpenCode context, contribution workflow, and onboarding
assets before changing anything. It distinguishes a first-run bootstrap from a rerun audit,
supports report-only requests and explicit asset exclusions, and uses preservation-first
merges for incomplete existing assets. The terminal report uses `Ready`, `Needs work`,
`Missing`, `Not applicable`, and `Blocked`; readiness counts include only applicable assets.
The workflow uses authenticated, bounded GitHub discovery when available and a local-only
fallback otherwise. It never creates `.mcp.json`, speculative MCP or Dependabot config,
or promotional badges, and it does not commit, push, or create pull requests unless
explicitly requested. See
[the setup skill](skills/setup-node-project/SKILL.md) and
[operations](docs/operations.md#repository-setup).

## License

[MIT](LICENSE)
