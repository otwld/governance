---
name: setup-node-project
description: Use when adding or refreshing OpenCode governance in an existing Node or TypeScript repository from local and GitHub evidence.
license: MIT
compatibility: OpenCode, Node.js 20 or later, Git
---

# Set Up a Node Project

Set up the current repository directly. This workflow does not require a pre-existing
issue, plan, digest, or multi-agent handoff.

## Inspect

Read applicable instructions, existing OpenCode files, manifests, lockfiles, scripts,
CI, and the documentation that agents should know. Use normal `git` commands for
repository state and authenticated `gh` commands for private GitHub information.
`webfetch` is anonymous and should be used only for public sources.

Identify:

- repository owner/name and trusted GitHub actors;
- the real install and aggregate verification commands;
- useful repository documents and their purpose;
- optional GitHub Project fields when Project delivery is requested;
- observed merge policy and existing governance files.

Do not invent commands or Project IDs. If optional metadata is unavailable, omit it
unless the requested workflow requires it.

## Edit

Create or merge `.opencode/project.json`, `AGENTS.md`, OpenCode configuration, and
GitHub templates only where useful. Preserve providers, MCP servers, scripts,
repository-specific guidance, and unrelated work. Replace template placeholders with
verified values; do not copy an entire template tree blindly.

The orchestrator may edit directly or delegate a bounded implementation task. Keep
the workflow proportional to the repository instead of producing a separate setup
contract.

## Validate

Run `governance validate-project <root>` or the repository's installed equivalent,
then run the configured verification command. Inspect the final diff and report:

- files changed and values selected;
- commands run and outcomes;
- omitted optional metadata and remaining blockers;
- any restart or manual GitHub action still required.

Do not commit, push, publish, or change remote settings unless the user asks.
