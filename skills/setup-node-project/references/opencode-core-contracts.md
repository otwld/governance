# OpenCode Core Contracts

Create these assets only from verified repository evidence. Replace every placeholder;
an unresolved placeholder is `Blocked`, not a completed setup. Merge required keys into an
existing file instead of replacing unrelated configuration.

## Root OpenCode configuration

The active root `opencode.json` or `opencode.jsonc` must select `orchestrator`, make the
installed governance skills discoverable, and deny direct global use of custom tools whose
authority belongs to agents. Preserve all other providers, MCP servers, permissions,
plugins, comments, and settings.

```json
{
  "$schema": "https://opencode.ai/config.json",
  "default_agent": "orchestrator",
  "permission": {
    "issue_factory": "deny",
    "workflow_state": "deny",
    "governance_check": "deny",
    "dependency_update": "deny",
    "change_boundary": "deny"
  },
  "skills": {
    "paths": ["~/.config/opencode/skills"]
  }
}
```

Existing permission and skill-path entries are merged by key or unique path. Do not weaken
an existing denial, discard narrower permissions, or create both JSON and JSONC variants.

## Project governance configuration

`.opencode/project.json` must contain the verified repository identity, a non-empty trusted
artifact-author allow-list, exact supported commands, purposeful existing document paths,
and squash merge policy. Use the Project mapping only when Project-backed delivery was
requested and every field and option ID was read directly from GitHub.

```json
{
  "$schema": "https://raw.githubusercontent.com/OTWLD/governance/main/schemas/project.schema.json",
  "repository": "<owner>/<repository>",
  "trustedActors": ["<verified GitHub login>"],
  "commands": {
    "verify": "<exact supported verification command>"
  },
  "documents": [
    {
      "path": "<existing repository-relative path>",
      "purpose": "<why agents must read it>"
    }
  ],
  "merge": {
    "method": "squash",
    "automatic": false
  }
}
```

Add `commands.install` only for a verified supported lockfile install command. Never infer
trusted actors from contributors or review authors. Validate the finished asset with
`governance validate-project <root>` or the repository's installed equivalent, then run
the configured verification command.

## Project-backed delivery

When Project-backed delivery is explicitly requested, add this complete mapping. Read
every name and node or option ID from the selected GitHub Project. Preserve the configured
priority order from highest to lowest, choose the missing-priority placement explicitly,
and keep drafts and archived items excluded.

```json
{
  "githubProject": {
    "owner": "<verified Project owner>",
    "number": "<verified positive Project number>",
    "id": "<verified Project node ID>",
    "statusFieldId": "<verified Status field ID>",
    "statuses": {
      "ready": "<verified ready name>",
      "active": "<verified active name>",
      "review": "<verified review name>",
      "done": "<verified done name>",
      "blocked": "<verified blocked name>"
    },
    "statusOptionIds": {
      "ready": "<verified ready option ID>",
      "active": "<verified active option ID>",
      "review": "<verified review option ID>",
      "done": "<verified done option ID>",
      "blocked": "<verified blocked option ID>"
    },
    "priorityFieldId": "<verified Priority field ID>",
    "priorityOptions": [
      { "name": "<highest priority name>", "optionId": "<highest priority option ID>" },
      { "name": "<next priority name>", "optionId": "<next priority option ID>" }
    ],
    "missingPriority": "last",
    "includeDrafts": false,
    "includeArchived": false
  }
}
```

Replace `number` with a JSON integer rather than a quoted placeholder. Status names and
option IDs must be distinct, and each required status role must have exactly one mapping.
Do not create or rename Project fields or options during setup.
