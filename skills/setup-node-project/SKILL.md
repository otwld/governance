---
name: setup-node-project
description: Use ONLY when bootstrapping or refreshing OpenCode governance files for an existing Node or TypeScript repository from verified local and GitHub evidence; do not invent scripts, CI, Project fields, or repository policy.
license: MIT
compatibility: OpenCode, Node.js 20 or later, Git
---

# Set Up a Node Project

Setup merges governance into an existing repository. It does not redesign the
project, create GitHub settings, or replace established guidance.

## Complete evidence inventory

Before editing, record evidence and source for:

- repository root, owner/name, remotes, default branch, worktree status;
- every applicable instruction file and existing `.opencode`/OpenCode config;
- root and package manifests, package-manager declaration and lockfiles;
- workspaces/packages, TypeScript/JavaScript configuration, Nx or other orchestrator;
- existing scripts and the exact non-mutating aggregate command required by docs/CI;
- exact lockfile install command, only when repository evidence requires installation;
- test, lint, typecheck, build, validation, and generated-code ownership;
- CI workflows, required-check names, contribution/release guidance;
- architecture, API, operations, security, and documentation sources agents must read;
- GitHub repository merge policy and, when requested, Project owner/number/node ID,
  Status field ID, exact Ready/Active/Review/Done/Blocked names and option IDs,
  Priority field, ordered priority option names/IDs, missing-priority placement,
  `includeDrafts: false`, `includeArchived: false`, and observed item behavior.
  Preserve GraphQL field/node evidence proving every configured ID belongs to the
  same Project; names alone are insufficient.
- trusted GitHub actor logins for issue approval/publication and durable workflow
  artifacts, proven from the repository's actual execution identities and least-
  privilege role assignment; record exact casing and do not infer from organization
  membership.

Conflicting lockfiles, missing required command, uncertain repository identity,
placeholder-only guidance, inaccessible Project metadata, or unsupported merge policy
is a blocker. Do not choose conventional defaults.

## Merge, do not overwrite

Inspect existing files and managed provenance. Add the smallest governance assets and
merge existing user guidance into configured semantic documents. Preserve providers,
MCPs, models, permissions, scripts, formatting, and unrelated OpenCode settings.
When existing guidance conflicts with governance safety or role separation, report
the conflict for explicit resolution; do not silently replace it.

`.opencode/project.json` must contain only evidence-backed values:

- exact `repository`;
- exact `trustedActors` from authenticated GitHub and repository governance evidence;
- exact `commands.verify` and optional exact `commands.install`;
- purposeful `documents` entries whose paths exist and whose purposes explain why
  every role should read them;
- optional `githubProject` names and IDs, including ordered `priorityOptions` objects
  shaped `{ "name": ..., "optionId": ... }`, missing-priority policy, and both include
  flags fixed false, only if directly read;
- observed squash `merge.method` and boolean `merge.automatic` policy.

Never leave example owner/repository, Project IDs, commands, or vague document
purposes in an applied config. A placeholder belongs in a preview with a blocker, not
in a validated setup.

## Agent handoff split

The setup coordinator owns repository/GitHub evidence, safe file placement, conflict
decisions, and final validation. Delegate bounded read-only research for external or
GitHub facts when needed. Delegate implementation only with exact allowed files,
existing content, merge rules, verified values, and no commit/push authority. Do not
ask an implementer to discover Project IDs, trusted actors, or invent command policy
while editing.

## Validation and output

Inspect the final diff for only intended governance files and merged guidance. Run:

1. `governance validate-project <root>` (or the repository's installed equivalent);
2. for Project-backed setup, call public read-only `governance_check` action `queue`
   without caller-supplied Project/items; it derives config and fetches authoritative
   Project data. Separately exercise public `approved-issue` on a known governed
   fixture when available to prove configured trust binding;
3. the configured `commands.verify` verbatim;
4. focused config loading/format validation required by the repository.

Confirm intended tests/targets executed and no required checks skipped. Do not run
install unless required and authorized; if needed, use `commands.install` verbatim.

Return created/merged files and provenance, complete evidence table, exact Project
names/IDs/statuses/priority, trusted actors and evidence, commands and outcomes,
unresolved placeholders (which
must block application), conflicts, restart/manual actions, and risks. Do not commit,
push, create Project fields, change branch protection/merge settings, or deploy.

## Anti-patterns

- Copying the template and leaving example IDs or assumed `npm` commands.
- Recording every doc rather than a purposeful semantic set.
- Replacing existing AGENTS/OpenCode config instead of merging it.
- Inferring required checks from package scripts without reading CI/guidance.
- Creating or renaming GitHub Project fields/statuses during setup.
- Conflating setup evidence collection with implementation authority.
