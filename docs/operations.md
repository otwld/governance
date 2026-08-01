# Operations

## Prerequisites

- Node.js 20 or later, Git, OpenCode, and authenticated GitHub CLI.
- Protected default branch with required checks and squash merge enabled.
- For Project runs, one unambiguous Status field, a configured Priority field, and no concurrent runner. Single-issue delivery does not require Priority.

Grant issue write only to the task-shaper's execution identity. Grant branch, pull request, check, and Project delivery permissions only to the orchestrator's identity. Do not grant administration, protection bypass, force push, deployment, secret management, or package publication.

## Installation

Run `governance install-global` and inspect every `write`, `identical`, `replace`, `remove`, or `conflict` status. Apply only a conflict-free plan. A conflict means the destination differs from both the desired asset and the previously recorded managed hash; preserve it and reconcile manually. After apply, merge `templates/opencode.json` into the active configuration without replacing providers or MCP settings, then restart OpenCode.

## Repository setup

Run `/setup-project`. Confirm the repository identity, exact commands, document paths, Project names and node IDs, Status field and option IDs, required checks, and squash policy from direct evidence. The setup must not create Project fields or repository settings. Validate with `governance validate-project <root>`.

## Daily flow

Use `/brainstorm` only when direction needs exploration. Use `/issue` for direct shaping or a selected concept. Use `/run-issue` for one approved issue and `/run-project` for an ordered Project queue. The detailed delivery policy is [the canonical lifecycle](../skills/deliver-issue/references/lifecycle.md).

On a blocker, preserve Git and GitHub state and report the issue, stage, evidence, attempted review or CI rounds, and exact human action. Never start a second Project runner, create a duplicate branch or issue, force push, bypass checks, or retry a partial publication without first verifying remote state.
