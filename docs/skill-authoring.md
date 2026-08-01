# Skill Authoring

Governance skills follow the open Agent Skills format and this repository's flexible development role model. Use the specification at <https://agentskills.io/specification> for file structure and metadata, and Anthropic's skill-authoring best practices at <https://docs.anthropic.com/en/docs/agents-and-tools/agent-skills/best-practices> for progressive disclosure, routing, and evaluation principles. These links were verified on 2026-08-01 and are references, not copied procedures.

## Review rubric

- Put one `SKILL.md` in a lowercase hyphenated directory; keep `name` stable and equal to the directory.
- Write a specific third-person `description` that states what the skill does and when it should load. Avoid overlap that makes routing ambiguous.
- Keep the top-level procedure concise. Move detailed examples or domain references into local files and link them with relative paths.
- State inputs, output contract, stop conditions, evidence requirements, safety boundaries, and failure behavior. Do not grant authority that the invoking agent lacks.
- Prefer repository evidence and focused behavior checks over conventional guesses. Test meaningful success and failure paths without building a policy test matrix around prompt wording.
- Do not duplicate lifecycle procedures across skills, agents, commands, or docs. Name one canonical source and link to it.
- Validate metadata, links, installation shape, routing prompts, and representative success and blocker cases.

## Provenance and license

Every distributed skill declares `license: MIT`. Original repository prose is covered by the root MIT license. Adapted text, examples, checklists, or code must identify the upstream project, stable source URL and revision or retrieval date, and upstream license in the skill or an adjacent provenance note. Confirm that the upstream license is compatible with MIT distribution, preserve required copyright and attribution notices, and distinguish adaptations from original work. Do not copy material merely because it is publicly readable; if license or provenance is unclear, link to it or write an original procedure instead.
