# Asset Audit and Merge Criteria

## Inventory

Evaluate this inventory after discovery. An asset is applicable only when repository
evidence supports its purpose.

| Group | Asset | Ready when |
| --- | --- | --- |
| AI context | Root `AGENTS.md` | It accurately covers project purpose, structure, exact commands, patterns, constraints, CI, documents, and evidenced pitfalls. |
| AI context | Maintenance matrix in `AGENTS.md` | It maps evidence-backed change areas to dependent code, tests, generated outputs, and docs. |
| AI context | `.opencode/project.json` | It validates and every value is sourced from the repository or authenticated GitHub evidence. |
| AI context | Root `opencode.json` or `opencode.jsonc` | One applicable root config supplies or preserves the required OpenCode integration without conflicting configuration. |
| Dev workflow | PR-triggered CI | A workflow actually runs relevant verified checks on pull requests. |
| Dev workflow | Issue templates | Templates match the observed contribution and support workflow. |
| Dev workflow | PR template | It requests information reviewers demonstrably need. |
| Dev workflow | Dependabot | Assess the existing configuration and report it; never generate it speculatively. |
| Onboarding | README contributing guidance | It links to an existing guide or gives verified contribution and validation steps. |
| Onboarding | Changelog | It exists only when tags, releases, or an established release practice justify it. |
| Onboarding | Documentation | Project docs exist, or `Not applicable` is supported by repository evidence. |

`Ready` is complete and current. `Needs work` exists but is incomplete, stale, duplicated,
or contradicts current evidence. `Missing` is applicable and absent. `Not applicable` has
recorded evidence that it does not serve this repository. `Blocked` lacks needed evidence
or cannot safely be repaired. Score `Ready / applicable`, excluding only evidenced
`Not applicable` assets. A known-applicable `Blocked` asset remains in the denominator;
when applicability itself is blocked, report readiness as indeterminate instead of
improving the score by omission.

## Drift, duplicates, and preservation-first repair

Drift is a verified mismatch between an asset and current scripts, paths, runtime,
workspace structure, CI, release practice, or repeated review guidance. A duplicate is
two files or sections with the same responsibility, or competing config names, that can
give agents incompatible direction. Report both locations and the evidence; do not delete
or consolidate a duplicate without a safe, evidence-backed merge.

For an incomplete existing asset, retain its purpose, valid repository-specific text,
comments, ordering, and unrelated settings. Add only missing evidence-backed material;
replace a statement only when the replacement is proven necessary. Preserve malformed or
ambiguous content and mark it `Blocked` when a safe merge is impossible.

Before OpenCode config work, inspect both root `opencode.json` and `opencode.jsonc`. Do
not create a second config when either exists. When merging, preserve `$schema`, providers,
MCP entries, permissions, comments, and unrelated settings. Never create `.mcp.json` or
speculative MCP entries. Do not infer trusted actors, Project identifiers, commands, or
branch or merge policy for `.opencode/project.json`. Apply the required governance shape
from [OpenCode core contracts](opencode-core-contracts.md), then validate it.

## Evidence gates

Create or repair PR CI only from verified install and validation commands, following any
existing workflow conventions; use the detected branch only when a branch filter is
necessary, and never blindly add `paths-ignore`. Create issue and PR templates only when repository evidence
shows a contribution workflow and reviewer needs. Add README contributing guidance only
when README and exact contribution commands or a contributing guide exist. Add a changelog
only for an observed release practice. Add docs only for an evidenced documentation need;
otherwise record the reason for `Not applicable`. Never generate Dependabot.
