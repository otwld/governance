# Operations

## Prerequisites

- Node.js 20 or later for the CLI and validators.
- Git and a compatible OpenCode installation.
- GitHub CLI authenticated as a dedicated user or bot with least privilege.
- A GitHub repository with an identified default branch and remote.
- A linked GitHub Project with unambiguous Status and Priority fields.
- Repository-defined local checks and required CI that can be executed and observed.
- Squash merging enabled and default-branch protection configured.

Run `/setup-project` before onboarding or after material repository policy changes.
It inspects first, then delegates reviewable repository-file changes and obtains a
fresh review. It does not create Project fields or change repository settings.

## GitHub Project configuration

V1 requires one single-select `Status` field with options mapped to these semantics:

| Semantic state | Suggested option | Meaning |
| --- | --- | --- |
| Not selectable | Backlog | Incomplete, untriaged, or intentionally deferred work. |
| Ready | Ready | Open, actionable, accepted, and dependency-free work. |
| Active | In Progress | The one issue currently being processed. |
| Review | In Review | Implemented work undergoing independent review. |
| Done | Done | Work completed by a verified squash merge. |
| Blocked | Blocked | Work requiring a named human action or decision. |

When `githubProject` is configured, the project file maps ready, active, review,
done, and blocked options explicitly. The orchestrator must not invent or change
those mappings. On a runtime blocker it stops and reports the current evidence; an
operator decides whether to move the item. There must never be more than one active
item for a V1 backlog run.

Backlog mode also needs one single-select `Priority` field mapped by
`githubProject.priorityField`. Define and document the option ordering in the
Project. Selection uses that Priority order first and Project item order second;
issue number, creation date, and agent preference are not substitutes. Draft items
and issues without useful acceptance criteria are not ready.

## GitHub token permissions

Grant only the permissions required by the installed workflow and repository:

- repository metadata: read;
- contents: read and write for branches, commits, and pushes;
- issues: read for task context and state visibility;
- pull requests: read and write;
- checks/actions: read to observe required CI;
- the selected organization or user Project: read and write for item status.

For a classic token, this commonly corresponds to repository access plus `project`
and, for organization-owned Projects, the minimum organization read access needed by
the account. For a fine-grained token or GitHub App, grant the equivalent permissions
only to the pilot repository and selected Project. Verify actual access with the
read-only setup audit before use.

Do not grant administration, branch-protection bypass, workflow modification,
secret-management, deployment, package deletion, or force-push capability. Store
credentials outside the repository and never place a token in prompts, command
arguments, logs, issue bodies, or pull request text.

## Branch protection and merge settings

Protect the default branch with settings that match repository policy:

- require a pull request before merging;
- require the repository's named CI checks and require them to complete successfully;
- require unresolved review conversations to be addressed when that feature is used;
- disallow force pushes and branch deletion;
- do not allow the automation identity to bypass protection;
- enable squash merge and disable unsupported merge methods if a linear history is
  required;
- require an up-to-date branch when the repository's CI and merge policy depend on
  it.

The orchestrator's ordered explicit denies are defense in depth, not a replacement
for these server controls. Unknown shell commands run without approval prompts. A
mergeable API response does not override a missing required check or a failed
independent review.

## Repository onboarding

1. Inspect and set up the repository with `/setup-project`. Confirm the default branch, remote,
   Project identity, field option IDs and semantics, required checks, validation
   commands, merge policy, and any existing active work.
2. Add a concise `AGENTS.md` or merge missing clauses into the existing instructions.
   Replace template placeholders only with commands and context verified in the
   repository.
3. Add the agent-task issue form and pull request template when they fit existing
   contribution policy. Preserve automation-sensitive local fields.
4. Create `.opencode/project.json` with `version: 1`, verified commands, purposeful
   existing guidance paths, and squash merge policy. Add the optional Project
   mapping for backlog mode. Add `$schema` only if it resolves.
5. Configure the Project and branch protection as above. Put only accepted,
   actionable issues in the ready state.
6. Validate the repository:

   ```sh
   governance validate-project /path/to/repository
   ```

7. Run one supervised single task before enabling backlog mode.

## Using single-task mode

Invoke `/orchestrate` with one self-contained task or issue reference:

```text
/orchestrate <one task with acceptance criteria and constraints>
```

The workflow handles only that task and stops after merge or blocker. It does not
select another Project item. Use single mode for pilots, urgent bounded work, or any
repository whose Project ordering is not fully configured.

When `merge.automatic` is false, single mode stops at a green reviewed PR ready for
human merge rather than treating that policy as a blocker.

## Using backlog mode

Invoke `/orchestrate-loop` with enough context to identify exactly one Project:

```text
/orchestrate-loop <Project owner and number or other unambiguous context>
```

The workflow first resumes the one unambiguous active item, if present. Otherwise it
selects the next ready issue by Priority and item order. It completes implementation,
fresh review, verification, pull request, CI, and squash merge before selecting
another issue. It stops normally when no ready work remains and stops immediately on
any ambiguity or blocker.

Backlog mode requires `merge.automatic: true`; it cannot safely select another item
while the current reviewed PR remains unmerged.

Do not start two backlog runs for the same Project. V1 has no distributed lock or
parallel scheduler.

## Recovery and blockers

Never solve a blocker by widening permissions, bypassing protection, discarding
work, force pushing, skipping checks, or creating duplicate branches and pull
requests.

- Multiple or stale active items: stop, inspect their issues, branches, and pull
  requests, then have a human identify the single item to resume or reset.
- Dirty or diverged branch: preserve changes, identify ownership, and reconcile with
  the base branch before resuming.
- Missing or ambiguous acceptance criteria: update the issue; do not infer scope.
- Review findings: fix by stable ID and obtain a fresh review. Stop after three
  review-fix rounds.
- CI failure: distinguish actionable change failures from infrastructure failures.
  Stop after two CI-fix rounds or whenever required CI is skipped or ambiguous.
- Authentication, authorization, rate limit, or API outage: preserve the current
  state and retry only after access or service health is restored.
- Merge conflict or changed base: update safely under repository policy, then repeat
  affected local verification and independent review.
- Partial merge or Project automation failure: verify the pull request merge commit
  and issue state before changing the Project item manually.

A blocker report should include the issue, current lifecycle stage, branch and pull
request when present, exact evidence, retry counts, and the one human action or
decision needed. Resume from verified state rather than rerunning setup blindly.

## Updating the global installation

Use a trusted release or reviewed checkout. Before changing the global OpenCode
configuration, validate the source distribution and preview the installation:

```sh
npm run check
governance install-global
```

Review new, identical, and conflicting files. The installer never overwrites a
differing destination. Compare each conflict with the trusted source, preserve any
local customization, and have an operator reconcile the destination before running
a fresh dry run. If the conflict-free plan is expected, apply it:

```sh
governance install-global --apply
```

The installer does not change `opencode.json`. Merge the required values from
`templates/opencode.json` manually, preserve existing providers and MCP servers, and
keep the configured skill path aligned with the installation target.

Close or stop active OpenCode sessions before replacing the distribution. After
apply, restart OpenCode so it reloads agents, commands, skills, and permissions.
Run `/setup-project` again when an update changes Project expectations or repository
configuration. If apply is interrupted or reports a conflict, do not repeatedly
apply; preserve the output, run a fresh dry-run, and reconcile the target first.
