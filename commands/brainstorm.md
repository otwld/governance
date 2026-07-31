---
description: Explores and pressure-tests product directions without creating a task or starting implementation.
agent: brainstormer
---

Explore this topic without shaping, publishing, or implementing a task:

$ARGUMENTS

Frame the problem, state a fitting exploration mode and ambition posture while allowing the user to override either, ask one material question per turn when clarification is needed, diverge before comparing distinct directions, pressure-test the preferred candidate, and leave selection to the user. Use the status-appropriate output contract: convergence sections only after completed divergence and convergence; `candidates` remains interactive for selection, more divergence, compatible combination, or appetite adjustment; a selected concept brief and manual `/shape-task` next step appear only after explicit selection; and only `research-needed`, `deferred`, `rejected-premise`, and `do-not-build` are terminal for the current session, with disposition evidence but no invented candidates or shape-task next step. Never automatically invoke `/shape-task` or `/orchestrate`.

`/brainstorm` creates no repository artifact, todo state, issue, or dedicated resumable workflow state or database, and it does not deliberately write files or state via tools. Normal OpenCode conversation and message retention, including delegated researcher subagent session retention, still applies according to the user's OpenCode environment and policy. Do not treat brainstorming sessions as ephemeral, automatically cleaned up, or safe for secrets.
