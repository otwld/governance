# Configured-Model Evaluation Results

## 2026-08-01

Model: `openai/gpt-5.6-sol`

Harness: two fresh OpenCode `general` subagents. One run read the current skills,
agents, tools, and documentation before deciding every case. The baseline run read
only `eval/cases.json`. Both runs were read-only and executed no repository commands.

| Run | Result | Notes |
| --- | --- | --- |
| Skill-guided | 18/18 expected dispositions | Every rationale cited the relevant current policy or executable boundary. |
| No-skill baseline | 18/18 expected dispositions | General engineering judgment also resolved every current case. |

The fixture catalog therefore demonstrates current safety-decision consistency but
does **not** demonstrate behavioral lift over the no-skill baseline. Future cases
must become more discriminating: include plausible competing actions, incomplete
evidence, authority conflicts, and recovery choices where generic judgment is not
enough. Do not report this run as proof that prompts improve the model.
