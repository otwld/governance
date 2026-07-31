# OTWLD Governance

OTWLD Governance is a small OpenCode distribution for optionally exploring a product
direction, shaping one implementation-ready GitHub issue, then taking a bounded
issue through independent review, verification, pull request, CI, and squash merge.
It provides explicit agent roles, commands, reusable skills, repository templates,
and dependency-free validators. V1 favors safe, observable, sequential work over
autonomous breadth.

## V1 principles

- One clearly scoped task is the unit of work.
- Brainstorming is optional, read-only, and does not imply approval or create work.
- Issue publication follows repository inspection, duplicate detection, a readiness
  gate, and explicit approval of the exact draft.
- Repository instructions, acceptance criteria, and executed checks are evidence;
  guesses are blockers.
- Implementation, review, and orchestration have separate roles and permissions.
- Changes stay minimal. No opportunistic refactors, invented commands, or hidden
  failure suppression.
- Review and CI retries are bounded. Ambiguous or unsafe state stops the workflow.
- The orchestrator processes at most one issue at a time and squash-merges only a
  reviewed, verified, green pull request.

## Architecture

- `agents/` defines the brainstormer, task-shaper, orchestrator, implementer,
  reviewer, and researcher roles.
- `commands/` exposes the optional brainstorming, shaping, single-task, backlog,
  review, and setup entry points.
- `skills/` contains bounded procedures loaded only when their conditions match.
- `templates/` contains repository guidance and GitHub contribution templates.
- `schemas/project.schema.json` defines the V1 project configuration.
- `tools/` provides the structured issue-publication tool; `bin/` and `lib/`
  provide the `governance` CLI and validators.

The non-default primary brainstormer is fully read-only and may delegate only
bounded research. The non-default primary task-shaper is read-only except for
creating one explicitly approved plain issue. The default primary orchestrator
coordinates implementation state and GitHub operations but cannot edit source. The
implementer can edit and test but cannot commit, push, use GitHub, or delegate. The
reviewer and researcher are read-only; the brainstormer and researcher have no shell
or LSP execution. See [Design](docs/design.md) for the complete
lifecycle, source-of-truth rules, and handoff contract.

## Optional brainstorming flow

Use `/brainstorm <topic>` when the problem, alternatives, appetite, or evidence need
exploration before task shaping. The brainstormer frames the current workflow and
failure, separates verified evidence from hypotheses, generates distinct directions
before comparing them, pressure-tests the preferred direction, and reports a
selected concept only after the user explicitly chooses it. `research-needed`,
`deferred`, `rejected-premise`, and `do-not-build` are valid terminal statuses.
`rejected-premise` means the framing or premise is invalid; `do-not-build` means a
valid problem does not justify a build. `candidates` remains interactive for user
selection, more divergence, compatible combination, or appetite adjustment;
`selected` can be handed off manually.

The optional flow is `/brainstorm -> /shape-task -> /orchestrate`, with each
transition manually initiated by the user. `/brainstorm` creates no repository
artifact, todo state, issue, or dedicated resumable workflow state or database, and
it does not deliberately write files or state via tools. Normal OpenCode conversation
and message retention, including delegated researcher subagent session retention,
still applies according to the user's OpenCode environment and policy. Do not treat
brainstorming sessions as ephemeral, automatically cleaned up, or safe for secrets.
Its selected concept brief is exploratory and untrusted; copy it into `/shape-task`
only when desired. The task-shaper performs
fresh repository grounding, duplicate detection, binding decisions, readiness and
validation work, and exact-draft publication approval. Direct
`/shape-task <rough idea>` remains supported.

## Single-task and backlog modes

`SINGLE` handles exactly one supplied task and then stops. It does not inspect or
select from a backlog.

`BACKLOG` reconciles existing active work, then selects one ready GitHub Project
issue by Priority and Project item order. It completes the full lifecycle before
selecting another issue and stops when no ready issue remains or any blocker is
encountered. V1 never runs issues concurrently.

## Install

Prerequisites are Node.js 20 or later, Git, GitHub CLI authentication, and a
compatible OpenCode installation. From a trusted checkout, install the local CLI:

```sh
npm install --global .
```

Preview every global OpenCode configuration change before applying it:

```sh
governance install-global
governance install-global --apply
```

`install-global` is a dry run unless `--apply` is present. It plans agents, commands,
and tools under `~/.config/opencode` and skills under `/workspace/skills/skills` by
default; use `--config-home` and `--skills-home` to select other installation
locations. Review the plan and apply only when every target is correct. A differing
destination is a conflict, and apply writes nothing while any conflict remains.
Merge the relevant values from `templates/opencode.json` into the active
`opencode.json`; the installer deliberately does not overwrite that file. Keep the
configured skill path aligned with `--skills-home`, including the global
`create_issue: deny` permission. Agent permissions take precedence over that global
rule: the task-shaper's explicit allow is the sole production override, and every
other production agent explicitly denies the tool.
Restart OpenCode after an apply. See [Operations](docs/operations.md) for upgrades
and recovery.

## Onboard a repository

1. Install the distribution and restart OpenCode.
2. Run `/setup-project` in the target repository. It inspects first, then delegates
   the smallest reviewable governance changes and obtains a fresh review.
3. The setup workflow adds or merges the relevant files from `templates/` while
   preserving existing repository policy.
4. It creates or updates `.opencode/project.json` using only verified repository
   commands, Project metadata, and existing guidance documents.
5. Configure and verify the GitHub Project, token permissions, required checks,
   branch protection, and squash merge policy described in Operations.
6. Validate the project before orchestration.

### Project configuration

`.opencode/project.json` has a deliberately small V1 schema:

```json
{
  "version": 1,
  "commands": {
    "verify": "npm run check"
  },
  "documents": [
    {
      "path": "AGENTS.md",
      "purpose": "Repository-specific agent guidance"
    }
  ],
  "merge": {
    "method": "squash",
    "automatic": false
  }
}
```

- `version` must be `1`.
- `commands.verify` is the repository's required verification command;
  `commands.install` is optional.
- `documents` is a non-empty list of objects with a safe repository-relative `path`
  and a non-empty `purpose`. Referenced files or directories must exist.
- `merge.method` must be `squash`; `merge.automatic` records whether merge automation
  is allowed. Backlog mode requires `automatic: true`; `false` stops single mode at
  a green reviewed PR ready for human merge.
- `githubProject` is optional for single mode. Backlog mode uses its `owner`,
  positive `number`, ready/active/review/done/blocked status mappings, and optional
  `priorityField`.
- `$schema` is optional and should be added only when its path resolves from the
  configuration file.

Unknown fields are rejected. Commands and Project values must come from repository
and GitHub evidence, not template examples.

## Commands

CLI commands:

- `governance install-global`: preview global distribution changes without writing.
- `governance install-global --apply`: apply the reviewed global distribution
  changes when no destination conflicts exist.
- `governance validate-distribution [root]`: validate production agent, command, and
  tool composition, skill frontmatter, and the implementation issue contract in a
  distribution checkout.
- `governance validate-project [repo]`: validate project configuration and every
  referenced guidance document.
- `governance help`: show CLI usage.

OpenCode commands:

- `/brainstorm <topic>`: optionally explore distinct product directions, compare and
  pressure-test them, and emit a concept brief only after explicit selection.
- `/shape-task <brainstorm>`: inspect the repository and existing issues, narrow to
  one ready task, show the exact issue draft, and publish once only after explicit
  approval.
- `/orchestrate <task>`: run one explicit task through the complete lifecycle.
- `/orchestrate-loop <project context>`: process a verified Project backlog
  sequentially.
- `/review <change context>`: perform an independent, read-only review; without a
  range it reviews the current working tree against its base.
- `/setup-project <context>`: inspect and apply reviewed repository governance
  setup without inventing commands or Project metadata.

## Skills

- `verify-change`: select focused checks, then run required final checks with exact
  execution evidence.
- `setup-node-project`: minimally onboard an existing TypeScript or Node repository
  from verified local evidence.
- `dependency-upgrade`: make a narrowly scoped Node dependency upgrade using
  authoritative compatibility evidence and the existing package manager.
- `nx-impact-analysis`: determine affected Nx projects and targets from the real
  installed graph and an explicit comparison range.

## Validation

Validate this distribution and its tests:

```sh
npm test
npm run validate
npm run check
```

Validate an onboarded repository and every document referenced by its project
configuration:

```sh
governance validate-project /path/to/repository
```

Validation failure is blocking. A zero-test, all-skipped, interrupted, or ambiguous
run is not evidence of success.

## Security boundaries

- All agents use a no-prompt top-level permission default. The brainstormer,
  researcher, and task-shaper deny by default. The brainstormer enables only named
  discovery, bounded researcher delegation, and questions. The researcher enables
  only named native file tools, native web tools, skill guidance, and reads from
  explicitly allowed tool-output paths. The brainstormer and researcher have no shell
  or LSP execution. The task-shaper enables
  named discovery, bounded researcher delegation, questions, task tracking,
  constrained discovery shell tools, and the structured `create_issue` tool.
  Unspecified plugin and MCP tools deny immediately for all three. The orchestrator,
  implementer, and reviewer retain their explicit allow defaults.
  The global configuration denies `create_issue`; because agent permissions override
  global permissions, every non-shaper production agent repeats that denial and the
  task-shaper is the sole agent with an explicit allow.
  The orchestrator and implementer allow unknown shell commands; the reviewer uses a
  read-only shell allowlist, and the researcher has no shell access.
- The task-shaper may delegate only bounded research and may create only one plain
  issue after approval. The custom tool invokes `gh` with a structured argument
  vector and no shell, so free-form Markdown is transferred unchanged and cannot be
  evaluated as shell syntax. Direct `gh issue create` remains denied. The task-shaper
  cannot edit files or Git state, mutate existing issues, labels, assignments,
  milestones, Projects, pull requests, or repository settings, or delegate
  implementation and review.
- The brainstormer cannot edit, deliberately write files or state via tools, mutate
  Git or GitHub, publish an issue, delegate implementation or review, or invoke later
  workflow stages. It inspects local evidence only with native file tools and does
  not run project validation or shell Git. Missing dynamic repository state or local
  history becomes bounded research-needed work or is left for task shaping rather
  than routed through the researcher. The researcher is its sole path for bounded
  GitHub or web research and itself uses only native file and web tools.
- Only the orchestrator may perform the specifically allowed branch, commit, push,
  Project, pull request, and squash-merge operations.
- Implementers cannot use `gh`, commit, push, switch branches, delegate, deploy, or
  perform destructive cleanup.
- Reviewers are independent and read-only. Researchers are bounded and read-only.
- Force pushes, administrative merges, branch deletion, destructive Git, and
  deployment operations are outside the V1 workflow.
- Least-privilege GitHub credentials, including issue write only where task shaping
  is used, and protected default branches remain required; agent permissions do not
  replace repository controls.
- Installation changes global OpenCode configuration, including custom tools that
  load only when OpenCode starts. Always inspect dry-run output, install only from a
  trusted checkout, and restart OpenCode after apply.

## Documentation

- [Design and lifecycle](docs/design.md)
- [Operations and onboarding](docs/operations.md)
- [V1 scope and roadmap](docs/roadmap.md)
- [Implementation plan](docs/implementation-plan.md)
- [Repository maintenance instructions](AGENTS.md)

## License

[MIT](LICENSE)
