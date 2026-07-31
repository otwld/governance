---
name: setup-node-project
description: Use ONLY when bootstrapping or refreshing OpenCode governance files for an existing TypeScript or Node repository; do not use to design a new application, choose tooling, or invent missing scripts, CI, workspaces, or GitHub metadata.
---

# Set Up a Node Project

## Contract

Build the smallest governance setup justified by repository evidence. Inspect first,
edit files normally so every change is reviewable, validate the result, and stop.
Do not run a generator, copy a template tree blindly, or reorganize the project.

Ask only when the required verification command remains genuinely ambiguous after
inspection, or when multiple GitHub Projects plausibly match by name and local
files plus read-only GitHub metadata cannot disambiguate them. For other
uncertainty, preserve current behavior, omit an optional value, or report a blocker
rather than asking the user to design the repository during setup.

## 1. Inventory before editing

Find the repository root and read all applicable instruction files. Inspect,
without assuming any file exists:

- manifests: `package.json` files and package-manager configuration;
- lockfiles: `package-lock.json`, `npm-shrinkwrap.json`, `pnpm-lock.yaml`,
  `yarn.lock`, or `bun.lock`/`bun.lockb`;
- workspace evidence: root `workspaces`, `pnpm-workspace.yaml`, `nx.json`,
  project-level `project.json`, `lerna.json`, or `turbo.json`;
- TypeScript and runtime evidence: `tsconfig*.json`, Node engine constraints,
  `.nvmrc`, `.node-version`, and the `packageManager` field;
- CI: workflow and pipeline files, including package-manager setup and every
  exact command they execute;
- docs: `README*`, `CONTRIBUTING*`, existing `AGENTS.md`, architecture and
  decision records, test docs, and existing `.opencode` and `.github` files;
- Git remotes, repository settings, and read-only GitHub metadata when project
  mapping or merge policy is in scope;
- the distributed project schema, validator, `AGENTS.md`, issue template, and
  pull request template before using them.

Record facts separately from gaps and cite the file or metadata that establishes
each selected value. A command exists only when a manifest, CI file, instruction,
or repository document defines that exact command. Do not infer or compose a
command from convention.

If lockfiles conflict, use `packageManager`, CI, and recent repository instructions
to identify the active manager. Do not delete or regenerate a competing lockfile as
part of setup; report unresolved conflicts.

## 2. Create or update `.opencode/project.json`

Read the local approved schema, validator, and project template before editing.
Use the schema's exact version and field shapes. The approved model contains:

- `version: 1`;
- required `commands.verify` and optional `commands.install` strings;
- `documents`, whose entries are objects with `path` and `purpose` strings;
- optional `githubProject` metadata with `owner`, `number`, `statuses`, and
  optional `priorityField`;
- required `merge.method: "squash"` and boolean `merge.automatic`.

Populate `commands.verify` with the repository's documented complete verification
command. Include `commands.install` only when evidence defines a dependency
installation command. Preserve commands exactly, including package-manager and
arguments. Never substitute a familiar command such as `npm ci` or `npm test`. If
evidence supports several verification commands and no instruction establishes
which one is required, ask one narrow question. If no verification command is
defined, report it as a blocker; do not add a package script during setup.

List only repository-relative paths that exist after the edit and materially guide
agents. Each `purpose` must say when or why to inspect that path, based on its
actual contents. A document may be a file or a directory. Directory documents are
allowed when the directory as a whole is a maintained source of guidance, such as
an architecture decision directory; do not enumerate every child solely because
the directory is listed. Do not list generated, dependency, cache, or broad source
directories as documents.

Set `merge.method` to the schema-required `"squash"`. Derive `merge.automatic`
only from current repository settings or explicit policy; do not convert a
preferred workflow into claimed settings. If repository settings conflict with
the required squash method, report the conflict rather than hiding it. Preserve
schema-supported existing values unless newer evidence proves they are stale. Add
`$schema` only when its path is verified to resolve from
`.opencode/project.json`. Remove or rename fields only when the approved local
schema proves they are invalid.

## 3. Resolve optional GitHub Project metadata by name

Resolve the mapping during setup rather than carrying over an unverified owner or
number. Determine the intended Project name from explicit repository evidence or
the setup request, then query accessible GitHub Projects by that exact name. Verify
the selected Project's owner and number and inspect its fields and options.

Store `githubProject` only when the mapping is verified. Map the required status
keys `ready`, `active`, `review`, `done`, and `blocked` to the exact option names
GitHub reports. Record `priorityField`, when present, by its exact name. Store
names, not field or option IDs. Never derive a mapping from the repository name
alone, select the first list result, or guess capitalization.

If exactly one Project matches, use that mapping. If several plausible Projects
remain, present their names, owners, and numbers and ask which one. If no mapping
is verifiable and `githubProject` is optional, omit it and report the missing
evidence instead of asking a broader design question.

## 4. Create or update governance guidance and templates

Inspect each destination and its distributed template before editing. Create or
update `.opencode/project.json`, `AGENTS.md`,
`.github/ISSUE_TEMPLATE/agent-task.yml`, and
`.github/pull_request_template.md` through normal file edits. Do not use `cp`,
shell redirection, a setup script, or bulk replacement.

- If `AGENTS.md` is absent, add the minimal distributed guidance and replace
  placeholders only with verified commands or paths.
- If `AGENTS.md` exists, merge only missing governance clauses. Retain project
  instructions and resolve contradictions explicitly.
- Merge the distributed issue and pull request guidance into their conventional
  `.github` destinations. For an existing issue form, merge by semantic purpose so
  local wording and layout still cover outcome, grounded problem evidence,
  requirements, included and excluded scope, technical decisions and discretion,
  repository context, acceptance scenarios, validation, readiness, assumptions,
  and references. Preserve automation-sensitive field IDs, top-level metadata,
  labels, checklists, and integrations; do not rename IDs or replace metadata merely
  to match the distributed form. Add only missing semantics, retain the stronger
  local requiredness when fields overlap, and avoid duplicate fields or mandatory
  `N/A` responses for conditional sections.
- Include command, Project, or merge details in guidance only when the project file
  and evidence support them. Do not duplicate policy sections.

Review the resulting diff before validation. Placeholder text such as
`example-project`, invented commands, stale GitHub metadata, and duplicate policy
sections must not remain.

## 5. Validate and report

Run `governance validate-project` from the repository root after all edits. Then run
only formatting or schema checks that repository instructions require for the
edited files. Setup does not justify a dependency install or the full application
test suite unless those instructions require it for documentation or configuration
changes. Parse the generated JSON and review the final diff even when validation
passes.

Completion evidence must include:

- manifests, active lockfile, workspace configuration, CI, instructions, docs,
  schema, validator, and templates inspected;
- files created or updated, evidence for both commands and merge settings, and why
  each document path is listed;
- exact validation commands, exit status, and diagnostic count;
- the verified GitHub Project name, owner, number, status names, and priority field,
  or the precise reason optional metadata was omitted;
- confirmation that every referenced document file or directory exists;
- the final diff scope and any pre-existing unrelated changes left untouched.

## Anti-patterns

- Inferring `npm test`, `npm run build`, `npm ci`, or an Nx target because it is
  conventional.
- Creating a workspace, `tsconfig`, CI workflow, or package script during setup.
- Replacing an existing `AGENTS.md`, issue template, or pull request template with
  a generic template.
- Treating document paths as file-only or listing directories without a useful
  evidence-based purpose.
- Adding a `$schema` URL or relative path that was not verified to resolve.
- Reusing an old GitHub Project number without resolving the Project by name.
- Selecting the first GitHub Project returned by a list command or storing IDs in
  place of required names.
- Guessing `merge.automatic` from personal preference or changing the required
  squash method.
- Claiming setup is complete without running `governance validate-project`, parsing
  the JSON, and checking every referenced document exists.
